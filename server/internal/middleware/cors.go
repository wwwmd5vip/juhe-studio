package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/config"
)

// CORS returns a middleware that configures Cross-Origin Resource Sharing headers.
// Allowed origins are read from the centralized Config struct (CORSAllowedOrigins).
// When set to "*" (the default), a literal "*" is sent as Access-Control-Allow-Origin
// (rather than echoing the request's Origin, which is a security best practice).
// Multiple origins can be specified as a comma-separated list.
func CORS(cfg *config.Config) gin.HandlerFunc {
	allowedOrigins := cfg.CORSAllowedOrigins
	if allowedOrigins == "" {
		allowedOrigins = "*"
	}
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowOrigin := ""

		if allowedOrigins == "*" {
			allowOrigin = "*"
		} else {
			for _, allowed := range strings.Split(allowedOrigins, ",") {
				allowed = strings.TrimSpace(allowed)
				if allowed == origin {
					allowOrigin = origin
					break
				}
			}
		}

		c.Header("Access-Control-Allow-Origin", allowOrigin)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		c.Header("Access-Control-Expose-Headers", "X-Request-Id")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
