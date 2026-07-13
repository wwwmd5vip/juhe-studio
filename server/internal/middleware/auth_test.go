package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newJWTAuthTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.User{}))
	return db
}

func setupJWTAuthTest(t *testing.T) (*gin.Engine, string, *domain.User) {
	gin.SetMode(gin.TestMode)

	db := newJWTAuthTestDB(t)
	userRepo := repository.NewUserRepository(db)

	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret: "test-secret-key-for-testing-only-32chars!!",
		},
	}

	// Create an active test user
	user := &domain.User{
		ID:           1,
		Username:     "testuser",
		PasswordHash: "$2a$10$placeholder",
		Role:         10, // admin role (10) for JWTAuth role tracking
		Status:       domain.UserActive,
	}
	require.NoError(t, userRepo.Create(t.Context(), user))

	// Generate a valid JWT for this user
	token, err := utils.GenerateJWT(cfg.JWT.Secret, user.ID, int(user.Role), 1*time.Hour)
	require.NoError(t, err)

	r := gin.New()
	r.Use(JWTAuth(cfg, userRepo))
	r.GET("/test", func(c *gin.Context) {
		userID, _ := c.Get(ContextUserIDKey)
		role, _ := c.Get(ContextRoleKey)
		c.JSON(http.StatusOK, gin.H{
			"user_id": userID,
			"role":    role,
		})
	})

	return r, token, user
}

func TestJWTAuth_ValidToken(t *testing.T) {
	r, token, expectedUser := setupJWTAuthTest(t)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, float64(expectedUser.ID), body["user_id"])
}

func TestJWTAuth_NoAuthorizationHeader(t *testing.T) {
	r, _, _ := setupJWTAuthTest(t)

	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var resp dto.Response
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 401, resp.Code)
	assert.Equal(t, "missing authorization header", resp.Message)
}

func TestJWTAuth_InvalidBearerFormat(t *testing.T) {
	r, _, _ := setupJWTAuthTest(t)

	tests := []struct {
		name  string
		header string
	}{
		{"no bearer prefix", "NotBearer token"},
		{"no space", "BearerToken"},
		{"empty token", "Bearer "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", tt.header)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			assert.Equal(t, http.StatusUnauthorized, w.Code, "header: %s", tt.header)

			var resp dto.Response
			require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
			assert.Equal(t, 401, resp.Code)
		})
	}
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	r, _, _ := setupJWTAuthTest(t)

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token-string")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var resp dto.Response
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 401, resp.Code)
	assert.Equal(t, "invalid or expired token", resp.Message)
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	db := newJWTAuthTestDB(t)
	userRepo := repository.NewUserRepository(db)

	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret: "test-secret-key-for-testing-only-32chars!!",
		},
	}

	user := &domain.User{
		ID:           2,
		Username:     "expireduser",
		PasswordHash: "$2a$10$placeholder",
		Role:         1,
		Status:       domain.UserActive,
	}
	require.NoError(t, userRepo.Create(t.Context(), user))

	// Generate a token that has already expired
	expiredToken, err := utils.GenerateJWT(cfg.JWT.Secret, user.ID, int(user.Role), -1*time.Hour)
	require.NoError(t, err)

	r := gin.New()
	r.Use(JWTAuth(cfg, userRepo))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+expiredToken)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTAuth_UserNotFoundOrInactive(t *testing.T) {
	// Create a JWT for a user that doesn't exist in the DB
	db := newJWTAuthTestDB(t)
	userRepo := repository.NewUserRepository(db)

	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret: "test-secret-key-for-testing-only-32chars!!",
		},
	}

	// Generate a valid JWT but the user doesn't exist in DB
	token, err := utils.GenerateJWT(cfg.JWT.Secret, 999, 1, 1*time.Hour)
	require.NoError(t, err)

	r := gin.New()
	r.Use(JWTAuth(cfg, userRepo))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)

	var resp dto.Response
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 401, resp.Code)
}

func TestAdminAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("admin role passes", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set(ContextRoleKey, domain.RoleAdmin)
			c.Next()
		})
		r.Use(AdminAuth())
		r.GET("/admin", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		req, _ := http.NewRequest("GET", "/admin", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("user role rejected", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set(ContextRoleKey, domain.RoleUser)
			c.Next()
		})
		r.Use(AdminAuth())
		r.GET("/admin", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		req, _ := http.NewRequest("GET", "/admin", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("missing role rejected", func(t *testing.T) {
		r := gin.New()
		r.Use(AdminAuth())
		r.GET("/admin", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		req, _ := http.NewRequest("GET", "/admin", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("root role passes", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set(ContextRoleKey, domain.RoleRoot)
			c.Next()
		})
		r.Use(AdminAuth())
		r.GET("/admin", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"ok": true})
		})

		req, _ := http.NewRequest("GET", "/admin", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestCurrentUser_Helpers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	user := &domain.User{
		ID:       42,
		Username: "helperuser",
		Role:     domain.RoleAdmin,
	}

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set(ContextUserKey, user)
		c.Set(ContextUserIDKey, user.ID)
		c.Set(ContextRoleKey, user.Role)
		c.Next()
	})
	r.GET("/helpers", func(c *gin.Context) {
		u := CurrentUser(c)
		id := CurrentUserID(c)
		name := CurrentUsername(c)
		role := CurrentRole(c)

		c.JSON(http.StatusOK, gin.H{
			"user_id":  id,
			"username": name,
			"role":     int(role),
			"user_ok":  u != nil,
		})
	})

	req, _ := http.NewRequest("GET", "/helpers", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, float64(42), body["user_id"])
	assert.Equal(t, "helperuser", body["username"])
	assert.Equal(t, float64(10), body["role"])
	assert.Equal(t, true, body["user_ok"])
}
