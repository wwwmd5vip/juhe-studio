package middleware

import (
	"log"
	"net/http"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"golang.org/x/time/rate"
)

var limiters sync.Map

// limiterEntry wraps a rate.Limiter with a last-access timestamp for GC.
type limiterEntry struct {
	limiter    *rate.Limiter
	lastAccess int64 // unix nano, updated on every Allow() check
}

func init() {
	go cleanupLimiters()
}

// cleanupLimiters runs a periodic sweep that deletes limiters not accessed in the last 10 minutes.
// It fires every 5 minutes.
func cleanupLimiters() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in rate limiter cleanup goroutine: %v", r)
		}
	}()
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now().UnixNano()
		threshold := now - int64(10*time.Minute)
		limiters.Range(func(key, value any) bool {
			entry, ok := value.(*limiterEntry)
			if !ok {
				limiters.Delete(key)
				return true
			}
			if atomic.LoadInt64(&entry.lastAccess) < threshold {
				limiters.Delete(key)
			}
			return true
		})
	}
}

// getLimiter returns a rate.Limiter for the given key.
// If rps (requests per minute) is <= 0, default 60 is used.
func getLimiter(key string, rpm int) *rate.Limiter {
	if rpm <= 0 {
		rpm = 60
	}
	lookupKey := key
	if v, ok := limiters.Load(lookupKey); ok {
		entry, ok := v.(*limiterEntry)
		if !ok {
			limiters.Delete(lookupKey)
		} else {
			atomic.StoreInt64(&entry.lastAccess, time.Now().UnixNano())
			return entry.limiter
		}
	}
	burst := rpm / 6
	if burst < 1 {
		burst = 1
	}
	l := rate.NewLimiter(rate.Limit(float64(rpm)/60.0), burst)
	entry := &limiterEntry{
		limiter:    l,
		lastAccess: time.Now().UnixNano(),
	}
	actual, _ := limiters.LoadOrStore(lookupKey, entry)
	if e, ok := actual.(*limiterEntry); ok {
		return e.limiter
	}
	return entry.limiter
}

// RateLimiter returns a Gin middleware that limits requests per API key, user, or client IP.
// It reads the token from context (set by TokenAuth) for per-token rate limits,
// falls back to user_id (set by JWTAuth), then falls back to c.ClientIP().
// settingRepo is used to dynamically read the global rate_limit_rpm setting (cached with TTL).
func RateLimiter(settingRepo *repository.SettingRepository) gin.HandlerFunc {
	var (
		cachedRPM     atomic.Int64
		cachedExpiry  atomic.Int64 // unix nano
		rpmCacheTTL   = int64(30 * time.Second)
	)

	return func(c *gin.Context) {
		key := ""
		rpm := 60 // default 60 requests per minute

		// Read global rate limit from settings (with 30s cache)
		now := time.Now().UnixNano()
		if cachedExpiry.Load() < now {
			if s, err := settingRepo.FindByKey(c.Request.Context(), "rate_limit_rpm"); err == nil && s != nil {
				if v, err := strconv.Atoi(s.Value); err == nil && v > 0 {
					cachedRPM.Store(int64(v))
				}
				cachedExpiry.Store(now + rpmCacheTTL)
			}
			// If DB query fails, don't update cachedExpiry — retry on next request
		}
		rpm = int(cachedRPM.Load())

		// Try per-token rate limit (set by TokenAuth)
		token, tokOK := c.Get(ContextTokenKey)
		if tokOK {
			if t, ok := token.(*domain.Token); ok {
				key = t.KeyMask
				if t.RateLimit > 0 {
					rpm = t.RateLimit
				}
			}
		}

		// Fallback: use token_key string
		if key == "" {
			key = c.GetString("token_key")
		}

		// Fallback: use user_id from JWT auth
		if key == "" {
			userID := c.GetString(ContextUserIDKey)
			if userID == "" {
				if id, ok := c.Get(ContextUserIDKey); ok {
					if v, ok := id.(uint64); ok {
						key = "u:" + formatUint(v)
					}
				}
			} else {
				key = "u:" + userID
			}
		}

		// Fallback: use client IP
		if key == "" {
			key = c.ClientIP()
		}

		limiter := getLimiter(key, rpm)
		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, dto.Response{
				Code:    429,
				Message: "请求过于频繁，请稍后再试",
			})
			return
		}

		c.Next()
	}
}

func formatUint(v uint64) string {
	if v == 0 {
		return "0"
	}
	buf := make([]byte, 20)
	i := len(buf)
	for v > 0 {
		i--
		buf[i] = byte('0' + v%10)
		v /= 10
	}
	return string(buf[i:])
}
