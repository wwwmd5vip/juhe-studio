// @title           Juhe Management API
// @version         1.0
// @description     Juhe Studio AI 管理中台 API — OpenAI 兼容接口、多渠道转发、提示词管理、计费财务
// @termsOfService  https://juhe.studio/terms

// @contact.name   Juhe Studio
// @contact.url    https://juhe.studio
// @contact.email  support@juhe.studio

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:7075
// @BasePath  /

// @securityDefinitions.apikey  Bearer
// @in                          header
// @name                        Authorization
// @description                 JWT Bearer token for admin API. Prefix with "Bearer ".

// @securityDefinitions.apikey  ApiKeyAuth
// @in                          header
// @name                        Authorization
// @description                 API Key for relay endpoints. Prefix with "Bearer ".

package main

import (
	"context"
	"fmt"
	_ "github.com/juhe-management/server/docs" // generated swagger docs
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/bootstrap"
	"github.com/juhe-management/server/internal/common/captcha"
	"github.com/juhe-management/server/internal/common/email"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/handler"
	adminHandler "github.com/juhe-management/server/internal/handler/admin"
	relayHandler "github.com/juhe-management/server/internal/handler/relay"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/relay"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/scheduler"
	"github.com/juhe-management/server/internal/service"
	"github.com/juhe-management/server/internal/ws"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	cfg := config.Load()

	startTime := time.Now()

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	db := bootstrap.NewDB(cfg)

	if err := db.AutoMigrate(
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
		&domain.EmailVerification{},
		&domain.PromptTemplate{},
		&domain.Feedback{},
		&domain.Release{},
	); err != nil {
		log.Fatalf("failed to migrate: %v", err)
	}
	log.Println("database migration completed")

	bootstrap.SeedRootUser(db, cfg.BcryptCost)
	bootstrap.SeedDefaultSettings(db)
	bootstrap.SeedPromptTemplates(db)
	bootstrap.SeedChannelFailures(db)
	bootstrap.SeedImageCapabilities(db)
	log.Println("seed data applied")

	userRepo := repository.NewUserRepository(db)
	tokenRepo := repository.NewTokenRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	pricingRepo := repository.NewPricingRepository(db)
	logRepo := repository.NewLogRepository(db)
	promptRepo := repository.NewPromptRepository(db)
	promptVersionRepo := repository.NewPromptVersionRepository(db)
	promptPackageItemRepo := repository.NewPromptPackageItemRepository(db)
	topUpRepo := repository.NewTopUpRepository(db)
	packageRepo := repository.NewQuotaPackageRepository(db)
	redemptionRepo := repository.NewRedemptionRepository(db)
	transactionRepo := repository.NewQuotaTransactionRepository(db)
	dailyBillRepo := repository.NewDailyBillRepository(db)
	subscriptionPlanRepo := repository.NewSubscriptionPlanRepository(db)
	userSubscriptionRepo := repository.NewUserSubscriptionRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	vendorRepo := repository.NewVendorRepository(db)
	auditRepo := repository.NewAdminAuditLogRepository(db)
	channelTestLogRepo := repository.NewChannelTestLogRepository(db)
	emailVerificationRepo := repository.NewEmailVerificationRepository(db)
	promptTemplateRepo := repository.NewPromptTemplateRepository(db)

	// settingService 提前创建，供 emailSender 动态读取 SMTP 配置
	settingService := service.NewSettingService(settingRepo)

	// 邮件发送器：每次发送时从 settings 表读取最新 SMTP 配置
	emailSender := email.NewSender(&smtpConfigProvider{settingService: settingService})

	auditService := service.NewAuditService(auditRepo)
	auditLogService := service.NewAdminAuditLogService(auditRepo)
	authService := service.NewAuthService(cfg, db, userRepo, emailVerificationRepo, emailSender, settingService)
	wsHub := ws.NewHub(settingRepo)

	billingService := service.NewBillingService(db, pricingRepo, userRepo, tokenRepo, logRepo, transactionRepo, dailyBillRepo, settingRepo, wsHub)
	userService := service.NewUserService(cfg, db, userRepo, billingService)
	tokenService := service.NewTokenService(tokenRepo, userRepo, logRepo)
	channelService := service.NewChannelService(channelRepo, modelRepo, channelTestLogRepo, wsHub)
	modelService := service.NewModelService(modelRepo)
	pricingService := service.NewPricingService(pricingRepo)
	dispatcher := relay.NewDispatcher(channelRepo)
	relayService := service.NewRelayService(dispatcher, billingService, channelRepo, pricingRepo, modelRepo, channelService, cfg.ChannelRetry.MaxAttempts, cfg.HealthCheck.Threshold)
	promptService := service.NewPromptService(db, promptRepo, promptVersionRepo, promptPackageItemRepo)
	topUpService := service.NewTopUpService(db, topUpRepo, packageRepo, billingService)
	redemptionService := service.NewRedemptionService(db, redemptionRepo, billingService)
	packageService := service.NewQuotaPackageService(db, packageRepo)
	subscriptionService := service.NewSubscriptionService(db, subscriptionPlanRepo, userSubscriptionRepo, topUpRepo, billingService)
	userFinanceService := service.NewUserFinanceService(db, userRepo, transactionRepo, dailyBillRepo, userSubscriptionRepo)
	// settingService already created above
	sensitiveWordService := service.NewSensitiveWordService(settingService)
	vendorService := service.NewVendorService(db, vendorRepo)
	feedbackRepo := repository.NewFeedbackRepository(db)
	feedbackService := service.NewFeedbackService(feedbackRepo)
	feedbackHandler := handler.NewFeedbackHandler(feedbackService)

	releaseRepo := repository.NewReleaseRepository(db)
	releaseService := service.NewReleaseService(releaseRepo)
	releaseHandler := handler.NewReleaseHandler(releaseService, auditService)

	captchaStore := captcha.NewStore()
	authHandler := adminHandler.NewAuthHandler(authService, userService, captchaStore)
	userHandler := adminHandler.NewUserHandler(userService, auditService)
	tokenHandler := adminHandler.NewTokenHandler(tokenService, auditService)
	dashboardService := service.NewDashboardService(db)
	modelHandler := adminHandler.NewModelHandler(modelService, auditService, channelRepo, pricingRepo)
	pricingHandler := adminHandler.NewPricingHandler(pricingService, channelRepo, modelRepo, auditService)
	promptHandler := adminHandler.NewPromptHandler(promptService, auditService)
	topUpHandler := adminHandler.NewTopUpHandler(topUpService, auditService)
	redemptionHandler := adminHandler.NewRedemptionHandler(redemptionService)
	quotaPackageHandler := adminHandler.NewQuotaPackageHandler(packageService, auditService)
	quotaTransactionHandler := adminHandler.NewQuotaTransactionHandler(billingService)
	dailyBillHandler := adminHandler.NewDailyBillHandler(billingService)
	subscriptionHandler := adminHandler.NewSubscriptionHandler(subscriptionService)
	settingHandler := adminHandler.NewSettingHandler(settingService, auditService, emailSender)
	logService := service.NewLogService(logRepo)
	logHandler := adminHandler.NewLogHandler(logService)
	channelHandler := adminHandler.NewChannelHandler(channelService, auditService, dashboardService)
	dashboardHandler := adminHandler.NewDashboardHandler(dashboardService)
	vendorHandler := adminHandler.NewVendorHandler(vendorService, auditService)
	auditLogHandler := adminHandler.NewAdminAuditHandler(auditLogService)
	userFinanceHandler := adminHandler.NewUserFinanceHandler(userFinanceService)
	importHandler := adminHandler.NewImportHandler(userService, tokenService, channelService)
	promptTemplateHandler := adminHandler.NewPromptTemplateHandler(promptTemplateRepo)
	quotaHandler := relayHandler.NewQuotaHandler(cfg, topUpService, userService, redemptionService, packageService, billingService, subscriptionService)
	relayPromptHandler := relayHandler.NewPromptHandler(promptService)
	relayH := relayHandler.NewRelayHandler(relayService, settingRepo, userRepo, cfg)
	playgroundHandler := adminHandler.NewPlaygroundHandler(relayService, settingRepo, userRepo, tokenRepo, cfg)
	feedbackAdminHandler := adminHandler.NewFeedbackHandler(feedbackService)

	sched := scheduler.New(cfg, settingRepo, billingService, subscriptionService, channelService, logRepo, log.Default(), wsHub)
	if err := sched.Start(); err != nil {
		log.Fatalf("failed to start scheduler: %v", err)
	}

	r := gin.New()
	// Disable trusted proxies to prevent rate-limiter bypass via X-Forwarded-For spoofing.
	// If behind a reverse proxy, configure SetTrustedProxies with the proxy's IP instead.
	r.SetTrustedProxies(nil)
	// Limit multipart form size for CSV imports (10 MB)
	r.MaxMultipartMemory = 10 << 20
	r.Use(middleware.RequestID())
	r.Use(middleware.CORS(cfg))
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	publicGroup := r.Group("")
	publicGroup.Use(middleware.RateLimiter(settingRepo))
	{
		publicGroup.GET("/api/public/status", func(c *gin.Context) {
			var m runtime.MemStats
			runtime.ReadMemStats(&m)

			dbStatus := "ok"
			sqlDB, err := db.DB()
			if err != nil {
				dbStatus = "error"
			} else if err := sqlDB.Ping(); err != nil {
				dbStatus = "error"
			}

			status := gin.H{
				"status":          "ok",
				"service":         "juhe-management",
				"version":         "0.1.0",
				"uptime_seconds":  int(time.Since(startTime).Seconds()),
				"go_version":      runtime.Version(),
				"goroutine_count": runtime.NumGoroutine(),
				"memory_mb":       float64(m.Alloc) / 1024 / 1024,
				"db_status":       dbStatus,
			}
			if dbStatus == "error" {
				c.JSON(http.StatusServiceUnavailable, status)
				return
			}
			c.JSON(http.StatusOK, status)
		})

		publicGroup.POST("/api/auth/login", authHandler.Login)
		publicGroup.GET("/api/auth/captcha", authHandler.Captcha)
		publicGroup.POST("/api/auth/register", authHandler.Register)
		publicGroup.GET("/api/auth/verify-email", authHandler.VerifyEmail)
		publicGroup.POST("/api/auth/resend-verification", authHandler.ResendVerification)
		publicGroup.POST("/api/public/feedback", feedbackHandler.Submit)
		publicGroup.GET("/api/public/releases/latest", releaseHandler.GetLatest)
		// 公开查询：服务端推荐的图像识别模型
		publicGroup.GET("/api/public/setting/default-vision-model", func(c *gin.Context) {
			model, err := settingService.GetString(c.Request.Context(), "DEFAULT_VISION_MODEL")
			if err != nil || model == "" {
				c.JSON(http.StatusOK, dto.Response{Code: 0, Data: map[string]string{"default_vision_model": ""}})
				return
			}
			c.JSON(http.StatusOK, dto.Response{Code: 0, Data: map[string]string{"default_vision_model": model}})
		})
		// 公开查询：服务端推荐的 LLM 文本模型
		publicGroup.GET("/api/public/setting/default-llm-model", func(c *gin.Context) {
			model, err := settingService.GetString(c.Request.Context(), "DEFAULT_LLM_MODEL")
			if err != nil || model == "" {
				c.JSON(http.StatusOK, dto.Response{Code: 0, Data: map[string]string{"default_llm_model": ""}})
				return
			}
			c.JSON(http.StatusOK, dto.Response{Code: 0, Data: map[string]string{"default_llm_model": model}})
		})
	}

	api := r.Group("/api")
	api.Use(middleware.JWTAuth(cfg, userRepo))
	api.Use(middleware.RateLimiter(settingRepo))
	{
		api.GET("/auth/me", userHandler.Me)
		api.PUT("/auth/password", authHandler.UpdatePassword)
		api.POST("/auth/verify-password", authHandler.VerifyPassword)
		adminHandler.RegisterUserRoutes(api, userHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterTokenRoutes(api, tokenHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterChannelRoutes(api, channelHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterModelRoutes(api, modelHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterPricingRoutes(api, pricingHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterPromptRoutes(api, promptHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterTopUpRoutes(api, topUpHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterRedemptionRoutes(api, redemptionHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterQuotaPackageRoutes(api, quotaPackageHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterQuotaTransactionRoutes(api, quotaTransactionHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterDailyBillRoutes(api, dailyBillHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterSubscriptionRoutes(api, subscriptionHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterSettingRoutes(api, settingHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterLogRoutes(api, logHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterDashboardRoutes(api, dashboardHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterVendorRoutes(api, vendorHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		handler.RegisterReleaseRoutes(api, releaseHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterUserFinanceRoutes(api, userFinanceHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterAuditLogRoutes(api, auditLogHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		adminHandler.RegisterPromptTemplateRoutes(api, promptTemplateHandler, middleware.JWTAuth(cfg, userRepo))
		adminHandler.RegisterPlaygroundRoutes(api, playgroundHandler, middleware.JWTAuth(cfg, userRepo))
		adminHandler.RegisterFeedbackRoutes(api, feedbackAdminHandler, middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())

		// CSV 批量导入
		importGroup := api.Group("/import", middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
		{
			importGroup.POST("/users", importHandler.ImportUsers)
			importGroup.POST("/tokens", importHandler.ImportTokens)
			importGroup.POST("/channels", importHandler.ImportChannels)
		}

		api.GET("/scheduler/status", middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth(), func(c *gin.Context) {
			c.JSON(http.StatusOK, dto.Response{Code: 0, Data: gin.H{"jobs": sched.GetJobsStatus()}})
		})

		// WebSocket
		api.GET("/ws", middleware.JWTAuth(cfg, userRepo), ws.HandleWebSocket(wsHub, cfg.Env, cfg.CORSAllowedOrigins))
	}

	// Swagger — only accessible in non-production or with auth
	swaggerGroup := r.Group("/api/swagger")
	if cfg.Env == "production" {
		swaggerGroup.Use(middleware.JWTAuth(cfg, userRepo), middleware.AdminAuth())
	}
	swaggerGroup.GET("", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/api/swagger/index.html")
	})
	swaggerGroup.GET("/*any", ginSwagger.WrapHandler(swaggerFiles.Handler,
		ginSwagger.URL("/api/swagger/doc.json"),
		ginSwagger.DefaultModelsExpandDepth(-1),
	))

	v1 := r.Group("/v1")
	v1.Use(middleware.TokenAuth(tokenService, userRepo, cfg, false))
	v1.Use(middleware.RateLimiter(settingRepo))
	v1.Use(middleware.SensitiveWordFilter(sensitiveWordService, cfg.MaxRequestBodyBytes))
	{
		v1.GET("/models", relayH.ListModels)
		v1.POST("/chat/completions", relayH.ChatCompletions)
		v1.POST("/images/generations", relayH.ImageGenerations)
		v1.POST("/embeddings", relayH.Embeddings)
		v1.POST("/audio/speech", relayH.AudioSpeech)
		v1.POST("/audio/transcriptions", relayH.AudioTranscriptions)
		v1.GET("/prompts", relayPromptHandler.ListPrompts)
		v1.GET("/prompts/categories", relayPromptHandler.ListCategories)
		v1.GET("/prompts/:id", relayPromptHandler.GetPrompt)
		v1.POST("/prompts/:id/render", relayPromptHandler.RenderPrompt)
		v1.POST("/prompts/:id/render-package", relayPromptHandler.RenderPackage)
	}

	// User account routes under /v1 — allow JWT fallback for admin web users
	v1Account := r.Group("/v1")
	v1Account.Use(middleware.TokenAuth(tokenService, userRepo, cfg, true))
	v1Account.Use(middleware.RateLimiter(settingRepo))
	{
		v1Account.GET("/quota", quotaHandler.GetQuota)
		v1Account.POST("/topups", quotaHandler.CreateTopUp)
		v1Account.POST("/redemptions/redeem", quotaHandler.Redeem)
		v1Account.GET("/quota-packages", quotaHandler.ListPackages)
		v1Account.GET("/quota-transactions", quotaHandler.ListTransactions)
		v1Account.GET("/daily-bills", quotaHandler.ListDailyBills)
		v1Account.GET("/daily-bills/monthly", quotaHandler.ListMonthlyBills)
		v1Account.GET("/subscription-plans", quotaHandler.ListSubscriptionPlans)
		v1Account.POST("/subscriptions", quotaHandler.Subscribe)
		v1Account.DELETE("/subscriptions/:id", quotaHandler.CancelSubscription)
		v1Account.GET("/subscriptions", quotaHandler.ListMySubscriptions)
	}

	// Public webhook endpoint (rate-limited, no JWT/API key auth)
	// Webhook secret validation is handled inside the handler
	webhookGroup := r.Group("/v1/webhooks")
	webhookGroup.Use(middleware.RateLimiter(settingRepo))
	{
		webhookGroup.POST("/:provider", quotaHandler.Webhook)
	}

	// pprof debug endpoint (non-production only)
	if cfg.Env != "production" {
		// pprof is registered on http.DefaultServeMux by the import
		r.Any("/debug/pprof/*any", gin.WrapH(http.DefaultServeMux))
	}

	log.Printf("routes registered, listening on :%s", cfg.Port)
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadTimeout:       time.Duration(cfg.HTTPServer.ReadTimeout) * time.Second,
		WriteTimeout:      time.Duration(cfg.HTTPServer.WriteTimeout) * time.Second,
		IdleTimeout:       time.Duration(cfg.HTTPServer.IdleTimeout) * time.Second,
		ReadHeaderTimeout: time.Duration(cfg.HTTPServer.ReadHeaderTimeout) * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Juhe Management server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("server failed: %v", err)
			// Send signal to trigger graceful shutdown instead of os.Exit
			// which would skip all cleanup (WS close, scheduler stop, audit flush, DB close).
			p, _ := os.FindProcess(os.Getpid())
			_ = p.Signal(syscall.SIGTERM)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("received signal %v, shutting down...", sig)

	// Stop background services
	sched.Stop()
	captchaStore.Close()

	// Graceful HTTP server shutdown first (stop accepting new connections, let in-flight finish)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("server forced to shutdown: %v", err)
	}

	// Flush WebSocket clients after HTTP shutdown (no new WS connections arrive)
	<-wsHub.Shutdown()

	// Wait for pending audit log writes to complete
	auditService.Close()

	// Close database
	sqlDB, err := db.DB()
	if err == nil {
		if err := sqlDB.Close(); err != nil {
			log.Printf("error closing database: %v", err)
		}
	}

	log.Println("server exited gracefully")
}

// smtpConfigProvider 实现 email.ConfigProvider 接口，
// 从 settings 表动态读取 SMTP 配置。
//
// SECURITY: SMTP password is stored as plain text in the settings table.
// For production, consider using the SMTP_PASSWORD environment variable directly
// instead of reading from DB, or encrypt the value at rest.
type smtpConfigProvider struct {
	settingService *service.SettingService
}

func (p *smtpConfigProvider) SMTPConfig(ctx context.Context) email.Config {
	host, _ := p.settingService.GetString(ctx, "smtp_host")
	port, _ := p.settingService.GetString(ctx, "smtp_port")
	username, _ := p.settingService.GetString(ctx, "smtp_username")
	password, _ := p.settingService.GetString(ctx, "smtp_password")
	from, _ := p.settingService.GetString(ctx, "smtp_from")
	return email.Config{Host: host, Port: port, Username: username, Password: password, From: from}
}
