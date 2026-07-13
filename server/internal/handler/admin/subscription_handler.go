package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type SubscriptionHandler struct {
	subscriptionService *service.SubscriptionService
}

func NewSubscriptionHandler(subscriptionService *service.SubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{subscriptionService: subscriptionService}
}

// CreatePlan 创建订阅套餐
// @Summary      创建订阅套餐
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateSubscriptionPlanRequest  true  "套餐信息"
// @Success      200   {object}  dto.Response{data=dto.SubscriptionPlanInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/subscriptions/plans [post]
func (h *SubscriptionHandler) CreatePlan(c *gin.Context) {
	var req dto.CreateSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if req.PriceCents <= 0 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "price_cents must be positive"})
		return
	}
	if req.QuotaValue <= 0 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "quota_value must be positive"})
		return
	}
	plan, err := h.subscriptionService.CreatePlan(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToSubscriptionPlanInfo(plan)})
}

// ListPlans 订阅套餐列表
// @Summary      获取订阅套餐列表
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.SubscriptionPlanInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/subscriptions/plans [get]
func (h *SubscriptionHandler) ListPlans(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	plans, total, err := h.subscriptionService.ListPlans(c.Request.Context(), false, page, pageSize)
	if err != nil {
		slog.Error("failed to list subscription plans", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToSubscriptionPlanInfoList(plans),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// ListUserSubscriptions 用户订阅列表
// @Summary      获取用户订阅列表
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Param        user_id    query     int  false  "用户 ID"
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.UserSubscriptionInfo}}
// @Failure      400        {object}  dto.Response
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/subscriptions [get]
func (h *SubscriptionHandler) ListUserSubscriptions(c *gin.Context) {
	var userID uint64
	if uid := c.Query("user_id"); uid != "" {
		id, err := strconv.ParseUint(uid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user_id"})
			return
		}
		userID = id
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	list, total, err := h.subscriptionService.ListByUser(c.Request.Context(), userID, page, pageSize)
	if err != nil {
		slog.Error("failed to list user subscriptions", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToUserSubscriptionInfoList(list),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// UpdatePlan 更新订阅套餐
// @Summary      更新订阅套餐
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Param        id    path      int                               true  "套餐 ID"
// @Param        body  body      dto.UpdateSubscriptionPlanRequest  true  "套餐信息"
// @Success      200   {object}  dto.Response{data=dto.SubscriptionPlanInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/subscriptions/plans/{id} [put]
func (h *SubscriptionHandler) UpdatePlan(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid id"})
		return
	}
	var req dto.UpdateSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	plan, err := h.subscriptionService.UpdatePlan(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToSubscriptionPlanInfo(plan)})
}

// DeletePlan 删除订阅套餐
// @Summary      删除订阅套餐
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "套餐 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/subscriptions/plans/{id} [delete]
func (h *SubscriptionHandler) DeletePlan(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid id"})
		return
	}
	if err := h.subscriptionService.DeletePlan(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}

// SubscribeUser 为用户订阅
// @Summary      管理员为用户订阅套餐
// @Tags         Subscriptions
// @Accept       json
// @Produce      json
// @Param        body  body      object{user_id=int,plan_id=int}  true  "订阅信息"
// @Success      200   {object}  dto.Response{data=dto.UserSubscriptionInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/subscriptions [post]
func (h *SubscriptionHandler) SubscribeUser(c *gin.Context) {
	var req struct {
		UserID uint64 `json:"user_id" binding:"required,gt=0"`
		PlanID uint64 `json:"plan_id" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	sub, err := h.subscriptionService.Subscribe(c.Request.Context(), req.UserID, req.PlanID)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserSubscriptionInfo(sub)})
}

func RegisterSubscriptionRoutes(r *gin.RouterGroup, h *SubscriptionHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/subscriptions", auth, admin)
	{
		g.POST("/plans", h.CreatePlan)
		g.GET("/plans", h.ListPlans)
		g.PUT("/plans/:id", h.UpdatePlan)
		g.DELETE("/plans/:id", h.DeletePlan)
		g.GET("", h.ListUserSubscriptions)
			g.POST("", h.SubscribeUser)
	}
}
