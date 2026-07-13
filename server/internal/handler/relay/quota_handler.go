package relay

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

type QuotaHandler struct {
	cfg                 *config.Config
	topUpService        *service.TopUpService
	userService         *service.UserService
	redemptionService   *service.RedemptionService
	packageService      *service.QuotaPackageService
	billingService      *service.BillingService
	subscriptionService *service.SubscriptionService
}

func NewQuotaHandler(cfg *config.Config, topUpService *service.TopUpService, userService *service.UserService, redemptionService *service.RedemptionService, packageService *service.QuotaPackageService, billingService *service.BillingService, subscriptionService *service.SubscriptionService) *QuotaHandler {
	return &QuotaHandler{
		cfg:                 cfg,
		topUpService:        topUpService,
		userService:         userService,
		redemptionService:   redemptionService,
		packageService:      packageService,
		billingService:      billingService,
		subscriptionService: subscriptionService,
	}
}

// GetQuota 查询额度
// @Summary      查询当前用户额度
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response{data=dto.QuotaInfo}
// @Failure      500  {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/quota [get]
func (h *QuotaHandler) GetQuota(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	user, err := h.userService.GetUser(c.Request.Context(), userID)
	if err != nil {
		slog.Error("GetQuota failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.QuotaInfo{Quota: user.Quota, UsedQuota: user.UsedQuota}})
}

// CreateTopUp 创建充值订单
// @Summary      创建充值订单
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreatePackageOrderRequest  true  "充值信息"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/topups [post]
func (h *QuotaHandler) CreateTopUp(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req dto.CreatePackageOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	topUp, err := h.topUpService.CreatePackageOrder(c.Request.Context(), userID, req.PackageID, req.PaymentMethod)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: gin.H{
		"id":             topUp.ID,
		"quota_granted":  topUp.QuotaGranted,
		"payment_status": topUp.PaymentStatus,
		"checkout_url":   "https://example.com/pay/PLACEHOLDER",
	}})
}

// Redeem 兑换码兑换
// @Summary      兑换码兑换
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        body  body      dto.RedeemRequest  true  "兑换信息"
// @Success      200   {object}  dto.Response{data=dto.RedemptionInfo}
// @Failure      400   {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/redemptions/redeem [post]
func (h *QuotaHandler) Redeem(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req dto.RedeemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	rd, err := h.redemptionService.Redeem(c.Request.Context(), userID, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToRedemptionInfo(rd)})
}

func parsePagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}

func buildRelayPagination(page, pageSize int, total int64) dto.Pagination {
	totalPages := 0
	if pageSize > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}
	return dto.Pagination{
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	}
}

// ListPackages 额度包列表
// @Summary      获取可购买的额度包列表
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.QuotaPackageInfo}}
// @Failure      500        {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/quota-packages [get]
func (h *QuotaHandler) ListPackages(c *gin.Context) {
	page, pageSize := parsePagination(c)
	packages, total, err := h.packageService.List(c.Request.Context(), page, pageSize, true, "")
	if err != nil {
		slog.Error("ListPackages failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToQuotaPackageInfoList(packages),
		Pagination: buildRelayPagination(page, pageSize, total),
	}})
}

// ListTransactions 额度流水列表
// @Summary      获取额度变动流水
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.QuotaTransactionInfo}}
// @Failure      500        {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/quota-transactions [get]
func (h *QuotaHandler) ListTransactions(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	page, pageSize := parsePagination(c)
	list, total, err := h.billingService.ListTransactions(c.Request.Context(), userID, page, pageSize)
	if err != nil {
		slog.Error("ListTransactions failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToQuotaTransactionInfoList(list),
		Pagination: buildRelayPagination(page, pageSize, total),
	}})
}

// ListDailyBills 日账单列表
// @Summary      获取日账单
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        start_date query     string  true  "开始日期 YYYY-MM-DD"
// @Param        end_date   query     string  true  "结束日期 YYYY-MM-DD"
// @Param        page       query     int     false "页码"      default(1)
// @Param        page_size  query     int     false "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.DailyBillInfo}}
// @Failure      400        {object}  dto.Response
// @Failure      500        {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/daily-bills [get]
func (h *QuotaHandler) ListDailyBills(c *gin.Context) {
	userID := middleware.CurrentUserID(c)

	start, err := time.Parse("2006-01-02", c.Query("start_date"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid start_date, expected YYYY-MM-DD"})
		return
	}
	end, err := time.Parse("2006-01-02", c.Query("end_date"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid end_date, expected YYYY-MM-DD"})
		return
	}
	end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 999999999, time.UTC)

	page, pageSize := parsePagination(c)

	list, total, err := h.billingService.ListDailyBills(c.Request.Context(), userID, start, end, page, pageSize)
	if err != nil {
		slog.Error("ListDailyBills failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToDailyBillInfoList(list),
		Pagination: buildRelayPagination(page, pageSize, total),
	}})
}

// ListMonthlyBills 月账单列表
// @Summary      获取月账单
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        start_month query     string  true  "开始月份 YYYY-MM"
// @Param        end_month   query     string  true  "结束月份 YYYY-MM"
// @Param        page        query     int     false "页码"      default(1)
// @Param        page_size   query     int     false "每页数量"  default(20)
// @Success      200         {object}  dto.Response{data=dto.PagedResponse}
// @Failure      400         {object}  dto.Response
// @Failure      500         {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/daily-bills/monthly [get]
func (h *QuotaHandler) ListMonthlyBills(c *gin.Context) {
	userID := middleware.CurrentUserID(c)

	startMonth := c.Query("start_month")
	endMonth := c.Query("end_month")
	if startMonth == "" || endMonth == "" {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "start_month and end_month are required (YYYY-MM)"})
		return
	}

	start, err := time.Parse("2006-01", startMonth)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid start_month, expected YYYY-MM"})
		return
	}
	end, err := time.Parse("2006-01", endMonth)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid end_month, expected YYYY-MM"})
		return
	}

	monthsDiff := (end.Year()-start.Year())*12 + int(end.Month()-start.Month())
	if monthsDiff < 0 || monthsDiff > 24 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "date range must not exceed 24 months"})
		return
	}

	page, pageSize := parsePagination(c)

	list, total, err := h.billingService.ListMonthlyBills(c.Request.Context(), userID, startMonth, endMonth, page, pageSize)
	if err != nil {
		slog.Error("ListMonthlyBills failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       list,
		Pagination: buildRelayPagination(page, pageSize, total),
	}})
}

// ListSubscriptionPlans 订阅套餐列表
// @Summary      获取订阅套餐列表
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.SubscriptionPlanInfo}}
// @Failure      500        {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/subscription-plans [get]
func (h *QuotaHandler) ListSubscriptionPlans(c *gin.Context) {
	page, pageSize := parsePagination(c)
	plans, total, err := h.subscriptionService.ListPlans(c.Request.Context(), true, page, pageSize)
	if err != nil {
		slog.Error("ListSubscriptionPlans failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToSubscriptionPlanInfoList(plans),
		Pagination: buildRelayPagination(page, pageSize, total),
	}})
}

// Subscribe 订阅套餐
// @Summary      订阅套餐
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        body  body      object{plan_id=int}  true  "订阅信息"
// @Success      200   {object}  dto.Response{data=dto.UserSubscriptionInfo}
// @Failure      400   {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/subscriptions [post]
func (h *QuotaHandler) Subscribe(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req struct {
		PlanID uint64 `json:"plan_id" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	sub, err := h.subscriptionService.Subscribe(c.Request.Context(), userID, req.PlanID)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserSubscriptionInfo(sub)})
}

// CancelSubscription 取消订阅
// @Summary      取消订阅
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "订阅 ID"
// @Success      200  {object}  dto.Response{data=dto.UserSubscriptionInfo}
// @Failure      400  {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/subscriptions/{id} [delete]
func (h *QuotaHandler) CancelSubscription(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid subscription id"})
		return
	}
	sub, err := h.subscriptionService.Cancel(c.Request.Context(), userID, id)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserSubscriptionInfo(sub)})
}

// ListMySubscriptions 我的订阅列表
// @Summary      获取我的订阅列表
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.UserSubscriptionInfo}}
// @Failure      500        {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/subscriptions [get]
func (h *QuotaHandler) ListMySubscriptions(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	page, pageSize := parsePagination(c)
	list, total, err := h.subscriptionService.ListByUser(c.Request.Context(), userID, page, pageSize)
	if err != nil {
		slog.Error("ListMySubscriptions failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToUserSubscriptionInfoList(list),
		Pagination: buildRelayPagination(page, pageSize, total),
	}})
}

// Webhook 支付回调
// @Summary      第三方支付回调 Webhook
// @Description  无需认证，第三方支付平台回调接口
// @Tags         RelayQuota
// @Accept       json
// @Produce      json
// @Param        provider  path      string  true  "支付提供商"
// @Param        body      body      object  true  "回调 payload"
// @Success      200       {object}  dto.Response
// @Failure      400       {object}  dto.Response
// @Failure      401       {object}  dto.Response
// @Router       /v1/webhooks/{provider} [post]
func (h *QuotaHandler) Webhook(c *gin.Context) {
	if h.cfg.WebhookSecret == "" {
		c.JSON(http.StatusServiceUnavailable, dto.Response{Code: 503, Message: "webhook not configured"})
		return
	}

	// Timing-safe secret comparison
	headerSecret := c.GetHeader("X-Webhook-Secret")
	if subtle.ConstantTimeCompare([]byte(headerSecret), []byte(h.cfg.WebhookSecret)) != 1 {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid webhook secret"})
		return
	}

	// Replay protection: reject requests with a timestamp older than 5 minutes
	timestampStr := c.GetHeader("X-Webhook-Timestamp")
	if timestampStr == "" {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "missing webhook timestamp"})
		return
	}
	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil || time.Now().Unix()-ts > 300 || ts-time.Now().Unix() > 300 {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid webhook timestamp"})
		return
	}

	// Limit body size to prevent memory exhaustion (1MB)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)

	// Read raw body for HMAC signature verification
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "cannot read body"})
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(rawBody))

	// HMAC-SHA256 signature verification (if X-Webhook-Signature header present)
	if sigHeader := c.GetHeader("X-Webhook-Signature"); sigHeader != "" {
		mac := hmac.New(sha256.New, []byte(h.cfg.WebhookSecret))
		mac.Write(rawBody)
		expectedSig := hex.EncodeToString(mac.Sum(nil))
		if subtle.ConstantTimeCompare([]byte(sigHeader), []byte(expectedSig)) != 1 {
			c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "invalid webhook signature"})
			return
		}
	}

	provider := c.Param("provider")
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid payload"})
		return
	}

	// Robust order ID parsing: handles string, float64, int types
	orderID := parseOrderID(payload)

	slog.Info("webhook received", "provider", provider, "order_id", orderID)

	if orderID == 0 {
		c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ignored"})
		return
	}

	// First, look up the order to verify the amount BEFORE marking as paid
	topUp, err := h.topUpService.Get(c.Request.Context(), orderID)
	if err != nil {
		slog.Error("webhook order not found", "order_id", orderID, "error", err)
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "order not found"})
		return
	}

	// Verify payment amount matches the order BEFORE marking as paid
	if err := verifyPaymentAmount(payload, topUp.AmountCents); err != nil {
		slog.Error("webhook amount mismatch", "order_id", orderID, "error", err)
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "amount mismatch"})
		return
	}

	topUp, err = h.topUpService.MarkPaid(c.Request.Context(), orderID, provider+"-"+strconv.FormatUint(orderID, 10))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTopUpInfo(topUp)})
}

// parseOrderID extracts the order ID from webhook payload, supporting multiple
// field names and types (string, float64, int) to handle various payment gateways.
func parseOrderID(payload map[string]interface{}) uint64 {
	// Try common field names
	for _, key := range []string{"out_trade_no", "order_id", "merchant_order_id"} {
		if raw, ok := payload[key]; ok {
			switch v := raw.(type) {
			case string:
				if v != "" {
					if id, err := strconv.ParseUint(v, 10, 64); err == nil {
						return id
					}
				}
			case float64:
				if v > 0 && v < 1<<53 { // within safe integer range
					return uint64(v)
				}
			case int64:
				if v > 0 {
					return uint64(v)
				}
			case uint64:
				return v
			}
		}
	}
	return 0
}

// verifyPaymentAmount checks that the webhook-reported amount matches the order amount.
// Returns nil if the amounts match or if no amount is present in the payload.
func verifyPaymentAmount(payload map[string]interface{}, expectedCents int64) error {
	var actualCents int64

	// Try common amount field names (amount in cents/fen)
	for _, key := range []string{"amount", "total_amount", "total_fee", "pay_amount"} {
		if raw, ok := payload[key]; ok {
			switch v := raw.(type) {
			case float64:
				actualCents = int64(v)
			case int64:
				actualCents = v
			case string:
				if parsed, err := strconv.ParseInt(v, 10, 64); err == nil {
					actualCents = parsed
				}
			}
			if actualCents > 0 {
				break
			}
		}
	}

	if actualCents > 0 && actualCents != expectedCents {
		return errors.New("payment amount mismatch")
	}
	return nil
}
