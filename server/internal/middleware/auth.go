package middleware

import (
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

const (
	ContextUserIDKey = "user_id"
	ContextRoleKey   = "role"
	ContextTokenKey  = "token"
	ContextUserKey   = "user"
)

func JWTAuth(cfg *config.Config, userRepo *repository.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "missing authorization header"})
			return
		}

		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid authorization header"})
			return
		}

		claims, err := utils.ParseJWT(cfg.JWT.Secret, parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid or expired token"})
			return
		}

		// Re-verify that the user still exists and is active.
		// This prevents a JWT issued before account deactivation from remaining valid.
		user, err := userRepo.FindByID(c.Request.Context(), claims.UserID)
		if err != nil || user.Status != domain.UserActive {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid or expired token"})
			return
		}

		c.Set(ContextUserKey, user)
		c.Set(ContextUserIDKey, claims.UserID)
		c.Set(ContextRoleKey, domain.Role(claims.Role))
		c.Next()
	}
}

func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(ContextRoleKey)
		roleVal, ok := role.(domain.Role)
		if !exists || !ok || roleVal < domain.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, dto.Response{Code: 403, Message: "admin required"})
			return
		}
		c.Next()
	}
}

func TokenAuth(tokenService *service.TokenService, userRepo *repository.UserRepository, cfg *config.Config, allowJWT bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "missing authorization header"})
			return
		}

		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid authorization header"})
			return
		}

		token, user, err := tokenService.ValidateToken(c.Request.Context(), parts[1])
		if err != nil {
			// Fallback: try JWT auth (only on /api routes, not /v1 relay routes)
			if allowJWT {
				if claims, jwtErr := utils.ParseJWT(cfg.JWT.Secret, parts[1]); jwtErr == nil {
					user, err := userRepo.FindByID(c.Request.Context(), claims.UserID)
					if err != nil || user.Status != domain.UserActive {
						c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "user not found or inactive"})
						return
					}
					c.Set(ContextUserKey, user)
					c.Set(ContextUserIDKey, claims.UserID)
					c.Set(ContextRoleKey, domain.Role(claims.Role))
					c.Next()
					return
				}
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid api key"})
			return
		}

		// Update last used timestamp
		_ = tokenService.UpdateLastUsedAt(c.Request.Context(), token.ID)

		// Check AllowedIPs whitelist
		if token.AllowedIPs != nil && *token.AllowedIPs != "" {
			if !matchAllowedIP(*token.AllowedIPs, c.ClientIP()) {
				c.AbortWithStatusJSON(http.StatusForbidden, dto.Response{Code: 403, Message: "IP 不在白名单中"})
				return
			}
		}

		c.Set(ContextTokenKey, token)
		c.Set(ContextUserIDKey, user.ID)
		c.Set(ContextRoleKey, user.Role)
		c.Set(ContextUserKey, user)
		c.Next()
	}
}

func CurrentUser(c *gin.Context) *domain.User {
	user, _ := c.Get(ContextUserKey)
	if v, ok := user.(*domain.User); ok {
		return v
	}
	return nil
}

func CurrentUserID(c *gin.Context) uint64 {
	id, _ := c.Get(ContextUserIDKey)
	if v, ok := id.(uint64); ok {
		return v
	}
	return 0
}

func CurrentUsername(c *gin.Context) string {
	if u := CurrentUser(c); u != nil {
		return u.Username
	}
	return ""
}

func CurrentRole(c *gin.Context) domain.Role {
	role, _ := c.Get(ContextRoleKey)
	if v, ok := role.(domain.Role); ok {
		return v
	}
	return domain.RoleUser
}

func CurrentToken(c *gin.Context) *domain.Token {
	token, _ := c.Get(ContextTokenKey)
	if v, ok := token.(*domain.Token); ok {
		return v
	}
	return nil
}

// matchAllowedIP checks if clientIP matches any entry in the allowed IP/CIDR list.
// The allowedIPs string is newline or comma-separated IP addresses or CIDR notations.
func matchAllowedIP(allowedIPs string, clientIP string) bool {
	entries := splitAllowedIPs(allowedIPs)
	client := net.ParseIP(clientIP)
	if client == nil {
		return false
	}

	for _, entry := range entries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}

		// Try CIDR matching
		if strings.Contains(entry, "/") {
			_, cidr, err := net.ParseCIDR(entry)
			if err != nil {
				continue
			}
			if cidr.Contains(client) {
				return true
			}
			continue
		}

		// Exact IP match
		if entry == clientIP {
			return true
		}
	}

	return false
}

// splitAllowedIPs splits a string by newlines, commas, or semicolons.
func splitAllowedIPs(s string) []string {
	s = strings.NewReplacer("\r\n", "\n", "\r", "\n").Replace(s)
	// Replace commas and semicolons with newlines, then split by newline
	s = strings.NewReplacer(",", "\n", ";", "\n").Replace(s)
	return strings.Split(s, "\n")
}
