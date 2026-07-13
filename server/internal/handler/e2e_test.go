package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/bootstrap"
	"github.com/juhe-management/server/internal/common/captcha"
	"github.com/juhe-management/server/internal/common/email"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	adminHandler "github.com/juhe-management/server/internal/handler/admin"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// SetupTestApp creates a fully-wired Gin engine backed by an in-memory SQLite database.
// It mirrors the wiring in cmd/server/main.go but omits /v1 relay routes that are not
// needed for these E2E tests.
func SetupTestApp(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Channel{},
		&domain.Model{},
		&domain.Vendor{},
		&domain.Pricing{},
		&domain.Ability{},
		&domain.Log{},
		&domain.PromptCategory{},
		&domain.Prompt{},
		&domain.PromptVersion{},
		&domain.PromptPackageItem{},
		&domain.QuotaTransaction{},
		&domain.TopUp{},
		&domain.Redemption{},
		&domain.QuotaPackage{},
		&domain.DailyBill{},
		&domain.SubscriptionPlan{},
		&domain.UserSubscription{},
		&domain.Setting{},
		&domain.AdminAuditLog{},
		&domain.ChannelTestLog{},
	)
	require.NoError(t, err)

	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret: "test-jwt-secret",
		},
		BcryptCost:       4,
		MinPasswordLength: 6,
		ChannelRetry: config.ChannelRetryConfig{
			MaxAttempts: 2,
		},
		HealthCheck: config.HealthCheckConfig{
			Threshold: 3,
		},
	}

	os.Setenv("ROOT_PASSWORD", "juhe123456")
	bootstrap.SeedRootUser(db, cfg.BcryptCost)

	// --- Repositories ---
	userRepo := repository.NewUserRepository(db)
	tokenRepo := repository.NewTokenRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	pricingRepo := repository.NewPricingRepository(db)
	logRepo := repository.NewLogRepository(db)
	transactionRepo := repository.NewQuotaTransactionRepository(db)
	dailyBillRepo := repository.NewDailyBillRepository(db)
	auditRepo := repository.NewAdminAuditLogRepository(db)
	channelTestLogRepo := repository.NewChannelTestLogRepository(db)
	emailVerificationRepo := repository.NewEmailVerificationRepository(db)

	settingRepo := repository.NewSettingRepository(db)
	settingService := service.NewSettingService(settingRepo)

	emailSender := email.NewSender(email.NewStaticConfigProvider(email.Config{}))

	// --- Services ---
	auditService := service.NewAuditService(auditRepo)
	authService := service.NewAuthService(cfg, db, userRepo, emailVerificationRepo, emailSender, settingService)
	billingService := service.NewBillingService(db, pricingRepo, userRepo, tokenRepo, logRepo, transactionRepo, dailyBillRepo, nil, nil)
	userService := service.NewUserService(cfg, db, userRepo, billingService)
	channelService := service.NewChannelService(channelRepo, modelRepo, channelTestLogRepo, nil)
	dashboardService := service.NewDashboardService(db)

	// --- Handlers ---
	testCaptchaStore = captcha.NewStore()
	authHandler := adminHandler.NewAuthHandler(authService, userService, testCaptchaStore)
	userHandler := adminHandler.NewUserHandler(userService, auditService)
	channelHandler := adminHandler.NewChannelHandler(channelService, auditService, nil)
	dashboardHandler := adminHandler.NewDashboardHandler(dashboardService)

	// --- Router ---
	r := gin.New()
	r.Use(middleware.CORS(&config.Config{CORSAllowedOrigins: "*"}))
	r.Use(middleware.RequestID())
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	publicGroup := r.Group("")
	publicGroup.Use(middleware.RateLimiter(settingRepo))
	{
		publicGroup.GET("/api/public/status", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"service": "juhe-management",
				"version": "0.1.0",
			})
		})

		publicGroup.POST("/api/auth/login", authHandler.Login)
	}

	api := r.Group("/api")
	api.Use(middleware.JWTAuth(cfg, userRepo))
	api.Use(middleware.RateLimiter(settingRepo))
	{
		api.GET("/auth/me", userHandler.Me)
		api.PUT("/auth/password", authHandler.UpdatePassword)
		adminHandler.RegisterUserRoutes(api, userHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterChannelRoutes(api, channelHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterDashboardRoutes(api, dashboardHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
	}

	return r
}

// testCaptchaStore holds the captcha store for test login helpers.
var testCaptchaStore *captcha.Store

// loginHelper performs a login request and returns the JWT token.
func loginHelper(t *testing.T, r *gin.Engine, username, password string) string {
	t.Helper()

	// Generate a valid captcha to pass verification
	captchaID, captchaCode, _ := testCaptchaStore.Generate()

	body, _ := json.Marshal(dto.LoginRequest{
		Username:    username,
		Password:    password,
		CaptchaID:   captchaID,
		CaptchaCode: captchaCode,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "login failed: %s", w.Body.String())

	var resp dto.Response
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.Equal(t, 0, resp.Code)

	dataJSON, err := json.Marshal(resp.Data)
	require.NoError(t, err)
	var loginResp dto.LoginResponse
	require.NoError(t, json.Unmarshal(dataJSON, &loginResp))
	require.NotEmpty(t, loginResp.Token)
	return loginResp.Token
}
// doRequest is a small helper to issue an HTTP request against the test engine.
func doRequest(t *testing.T, r *gin.Engine, method, path string, body io.Reader, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, body)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// decodeResp unmarshals the JSON body into dto.Response.
func decodeResp(t *testing.T, w *httptest.ResponseRecorder) dto.Response {
	t.Helper()
	var resp dto.Response
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	return resp
}

// ---------------------------------------------------------------------------
// Test: Public Status
// ---------------------------------------------------------------------------

func TestE2E_PublicStatus(t *testing.T) {
	r := SetupTestApp(t)

	w := doRequest(t, r, http.MethodGet, "/api/public/status", nil, "")
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "ok", body["status"])
	assert.Equal(t, "juhe-management", body["service"])
}

// ---------------------------------------------------------------------------
// Test: Login Flow
// ---------------------------------------------------------------------------

func TestE2E_LoginFlow(t *testing.T) {
	r := SetupTestApp(t)

	t.Run("login_with_valid_credentials", func(t *testing.T) {
		captchaID, captchaCode, _ := testCaptchaStore.Generate()
		body, _ := json.Marshal(dto.LoginRequest{
			Username:    "root",
			Password:    "juhe123456",
			CaptchaID:   captchaID,
			CaptchaCode: captchaCode,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var loginResp dto.LoginResponse
		require.NoError(t, json.Unmarshal(dataJSON, &loginResp))
		assert.NotEmpty(t, loginResp.Token)
		assert.Equal(t, "root", loginResp.User.Username)
		assert.Equal(t, int(domain.RoleRoot), loginResp.User.Role)
	})

	t.Run("login_with_invalid_credentials", func(t *testing.T) {
		captchaID, captchaCode, _ := testCaptchaStore.Generate()
		body, _ := json.Marshal(dto.LoginRequest{
			Username:    "root",
			Password:    "wrong-password",
			CaptchaID:   captchaID,
			CaptchaCode: captchaCode,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 401, resp.Code)
	})

	t.Run("use_token_for_auth_me", func(t *testing.T) {
		token := loginHelper(t, r, "root", "juhe123456")

		w := doRequest(t, r, http.MethodGet, "/api/auth/me", nil, token)
		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var userInfo dto.UserInfo
		require.NoError(t, json.Unmarshal(dataJSON, &userInfo))
		assert.Equal(t, "root", userInfo.Username)
		assert.Equal(t, int(domain.RoleRoot), userInfo.Role)
	})
}

// ---------------------------------------------------------------------------
// Test: Admin Dashboard
// ---------------------------------------------------------------------------

func TestE2E_AdminDashboard(t *testing.T) {
	r := SetupTestApp(t)
	token := loginHelper(t, r, "root", "juhe123456")

	t.Run("dashboard_stats_returns_200", func(t *testing.T) {
		w := doRequest(t, r, http.MethodGet, "/api/dashboard/stats", nil, token)
		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var stats dto.DashboardStats
		require.NoError(t, json.Unmarshal(dataJSON, &stats))
		// After seeding root user, user_count should be at least 1
		assert.GreaterOrEqual(t, stats.UserCount, int64(1))
	})

	// NOTE: /api/dashboard/trends uses MySQL-specific SQL (CURDATE, DATE_SUB) that
	// does not translate to SQLite. The stats endpoint uses portable COUNT queries
	// and is the primary dashboard contract verified above.
}

// ---------------------------------------------------------------------------
// Test: Unauthorized Access
// ---------------------------------------------------------------------------

func TestE2E_UnauthorizedAccess(t *testing.T) {
	r := SetupTestApp(t)

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"dashboard_stats", http.MethodGet, "/api/dashboard/stats"},
		{"auth_me", http.MethodGet, "/api/auth/me"},
		{"list_channels", http.MethodGet, "/api/channels"},
		{"create_channel", http.MethodPost, "/api/channels"},
	}

	for _, tt := range tests {
		t.Run(tt.name+"_no_token", func(t *testing.T) {
			w := doRequest(t, r, tt.method, tt.path, nil, "")
			assert.Equal(t, http.StatusUnauthorized, w.Code)
			resp := decodeResp(t, w)
			assert.Equal(t, 401, resp.Code)
		})

		t.Run(tt.name+"_invalid_token", func(t *testing.T) {
			w := doRequest(t, r, tt.method, tt.path, nil, "not-a-valid-token")
			assert.Equal(t, http.StatusUnauthorized, w.Code)
			resp := decodeResp(t, w)
			assert.Equal(t, 401, resp.Code)
		})
	}
}

// ---------------------------------------------------------------------------
// Test: Channel CRUD Cycle
// ---------------------------------------------------------------------------

func TestE2E_ChannelCRUDCycle(t *testing.T) {
	r := SetupTestApp(t)
	token := loginHelper(t, r, "root", "juhe123456")

	var channelID uint64

	t.Run("create_channel", func(t *testing.T) {
		req := dto.CreateChannelRequest{
			Type:   string(domain.ChannelTypeOpenAICompatible),
			Name:   "e2e-test-channel",
			Keys:   "sk-test-key",
			Models: "gpt-4o,gpt-4o-mini",
		}
		body, _ := json.Marshal(req)
		w := doRequest(t, r, http.MethodPost, "/api/channels", bytes.NewReader(body), token)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var channel dto.ChannelInfo
		require.NoError(t, json.Unmarshal(dataJSON, &channel))
		assert.Equal(t, req.Name, channel.Name)
		assert.Equal(t, req.Type, channel.Type)
		assert.Equal(t, req.Models, channel.Models)
		assert.NotZero(t, channel.ID)
		channelID = channel.ID
	})

	t.Run("list_channels_contains_created", func(t *testing.T) {
		w := doRequest(t, r, http.MethodGet, "/api/channels?page=1&page_size=50", nil, token)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var paged dto.PagedResponse
		require.NoError(t, json.Unmarshal(dataJSON, &paged))
		assert.GreaterOrEqual(t, paged.Pagination.Total, int64(1))

		channelsJSON, err := json.Marshal(paged.Data)
		require.NoError(t, err)
		var channels []dto.ChannelInfo
		require.NoError(t, json.Unmarshal(channelsJSON, &channels))

		found := false
		for _, ch := range channels {
			if ch.ID == channelID {
				found = true
				assert.Equal(t, "e2e-test-channel", ch.Name)
				break
			}
		}
		assert.True(t, found, "created channel should appear in list")
	})

	t.Run("update_channel", func(t *testing.T) {
		newName := "e2e-test-channel-updated"
		// Build request JSON manually since UpdateChannelRequest has pointer fields
		updateBody := strings.NewReader(`{"name":"` + newName + `"}`)
		w := doRequest(t, r, http.MethodPut, "/api/channels/"+formatUint(channelID), updateBody, token)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var channel dto.ChannelInfo
		require.NoError(t, json.Unmarshal(dataJSON, &channel))
		assert.Equal(t, newName, channel.Name)
	})

	t.Run("get_channel_reflects_update", func(t *testing.T) {
		w := doRequest(t, r, http.MethodGet, "/api/channels/"+formatUint(channelID), nil, token)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)

		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var channel dto.ChannelInfo
		require.NoError(t, json.Unmarshal(dataJSON, &channel))
		assert.Equal(t, "e2e-test-channel-updated", channel.Name)
	})

	t.Run("delete_channel", func(t *testing.T) {
		w := doRequest(t, r, http.MethodDelete, "/api/channels/"+formatUint(channelID), nil, token)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 0, resp.Code)
		assert.Equal(t, "deleted", resp.Message)
	})

	t.Run("get_deleted_channel_returns_404", func(t *testing.T) {
		w := doRequest(t, r, http.MethodGet, "/api/channels/"+formatUint(channelID), nil, token)

		assert.Equal(t, http.StatusNotFound, w.Code)
		resp := decodeResp(t, w)
		assert.Equal(t, 404, resp.Code)
	})

	t.Run("verify_not_in_list", func(t *testing.T) {
		w := doRequest(t, r, http.MethodGet, "/api/channels?page=1&page_size=50", nil, token)

		require.Equal(t, http.StatusOK, w.Code)
		resp := decodeResp(t, w)
		dataJSON, err := json.Marshal(resp.Data)
		require.NoError(t, err)
		var paged dto.PagedResponse
		require.NoError(t, json.Unmarshal(dataJSON, &paged))

		channelsJSON, err := json.Marshal(paged.Data)
		require.NoError(t, err)
		var channels []dto.ChannelInfo
		require.NoError(t, json.Unmarshal(channelsJSON, &channels))

		for _, ch := range channels {
			assert.NotEqual(t, channelID, ch.ID, "deleted channel should not appear in list")
		}
	})
}

// formatUint is a tiny helper to convert uint64 to string without importing strconv
// in every sub-test.
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
