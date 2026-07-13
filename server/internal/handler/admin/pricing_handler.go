package admin

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

type PricingHandler struct {
	pricingService *service.PricingService
	channelRepo    *repository.ChannelRepository
	modelRepo      *repository.ModelRepository
	auditService   *service.AuditService
}

func NewPricingHandler(pricingService *service.PricingService, channelRepo *repository.ChannelRepository, modelRepo *repository.ModelRepository, auditService *service.AuditService) *PricingHandler {
	return &PricingHandler{pricingService: pricingService, channelRepo: channelRepo, modelRepo: modelRepo, auditService: auditService}
}

// Create 创建定价
// @Summary      创建定价
// @Description  为模型创建定价规则
// @Tags         Pricing
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreatePricingRequest  true  "定价信息"
// @Success      200   {object}  dto.Response{data=dto.PricingInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/pricing [post]
func (h *PricingHandler) Create(c *gin.Context) {
	var req dto.CreatePricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if req.FixedPriceCents != nil && *req.FixedPriceCents < 0 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "fixed_price_cents cannot be negative"})
		return
	}

	pricing, err := h.pricingService.CreatePricing(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordCreate(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetPricing, pricing.ID, pricing)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPricingInfo(pricing)})
}

// List 定价列表
// @Summary      获取定价列表
// @Description  分页查询定价规则
// @Tags         Pricing
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Param        model_name query     string  false  "模型名称"
// @Param        group      query     string  false  "分组"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.PricingInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/pricing [get]
func (h *PricingHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	modelName := c.Query("model_name")
	group := c.Query("group")

	pricings, total, err := h.pricingService.ListPricing(c.Request.Context(), page, pageSize, modelName, group)
	if err != nil {
		slog.Error("list pricing failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: service.PricingInfoList(pricings),
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// Get 定价详情
// @Summary      获取定价详情
// @Description  根据 ID 获取单个定价规则
// @Tags         Pricing
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "定价 ID"
// @Success      200  {object}  dto.Response{data=dto.PricingInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/pricing/{id} [get]
func (h *PricingHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid pricing id"})
		return
	}

	pricing, err := h.pricingService.GetPricing(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPricingInfo(pricing)})
}

// Update 更新定价
// @Summary      更新定价规则
// @Description  更新定价配置
// @Tags         Pricing
// @Accept       json
// @Produce      json
// @Param        id    path      int                      true  "定价 ID"
// @Param        body  body      dto.UpdatePricingRequest  true  "定价信息"
// @Success      200   {object}  dto.Response{data=dto.PricingInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/pricing/{id} [put]
func (h *PricingHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid pricing id"})
		return
	}

	var req dto.UpdatePricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if req.FixedPriceCents != nil && *req.FixedPriceCents < 0 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "fixed_price_cents cannot be negative"})
		return
	}

	oldPricing, err := h.pricingService.GetPricing(c.Request.Context(), id)
	if err != nil {
		slog.Warn("failed to fetch old pricing for audit", "id", id, "error", err)
	}

	pricing, err := h.pricingService.UpdatePricing(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordUpdate(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetPricing, id, oldPricing, pricing)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPricingInfo(pricing)})
}

// Delete 删除定价
// @Summary      删除定价规则
// @Description  删除指定的定价规则
// @Tags         Pricing
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "定价 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/pricing/{id} [delete]
func (h *PricingHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid pricing id"})
		return
	}

	oldPricing, err := h.pricingService.GetPricing(c.Request.Context(), id)
	if err != nil {
		slog.Warn("failed to fetch old pricing for audit", "id", id, "error", err)
	}

	if err := h.pricingService.DeletePricing(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordDelete(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetPricing, id, oldPricing)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

type BatchPricingRequest struct {
	ModelName string                 `json:"model_name" binding:"required"`
	Items     []dto.BatchPricingItem `json:"items" binding:"required,min=1"`
	Overwrite bool                   `json:"overwrite"`
}

// BatchCreateOrUpdate 批量创建/更新定价
// @Summary      批量创建或更新定价
// @Description  批量 upsert 定价规则
// @Tags         Pricing
// @Accept       json
// @Produce      json
// @Param        body  body      BatchPricingRequest  true  "批量定价信息"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/pricing/batch [post]
func (h *PricingHandler) BatchCreateOrUpdate(c *gin.Context) {
	var req BatchPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	for i, item := range req.Items {
		if item.FixedPriceCents != nil && *item.FixedPriceCents < 0 {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: fmt.Sprintf("items[%d].fixed_price_cents cannot be negative", i)})
			return
		}
	}

	pricingItems := make([]dto.CreatePricingRequest, len(req.Items))
	for i, item := range req.Items {
		pricingItems[i] = dto.CreatePricingRequest{
			ModelName:       req.ModelName,
			Group:           item.Group,
			BillingMode:     item.BillingMode,
			ModelRatio:      item.ModelRatio,
			CompletionRatio: item.CompletionRatio,
			FixedPriceCents: item.FixedPriceCents,
			ImageRatio:      item.ImageRatio,
			TieredExpr:      item.TieredExpr,
			EffectiveFrom:   item.EffectiveFrom,
		}
	}
	count, err := h.pricingService.BatchUpsertPricing(c.Request.Context(), req.ModelName, pricingItems, req.Overwrite)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: map[string]int64{"affected": count}})
}

// SyncUpstreamPricing 从上游渠道拉取定价并同步到本地（仅本地已有模型）
func (h *PricingHandler) SyncUpstreamPricing(c *gin.Context) {
	var req dto.SyncUpstreamPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	// Get channel for baseURL
	channel, err := h.channelRepo.FindByID(c.Request.Context(), req.ChannelID)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: "渠道不存在"})
		return
	}
	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = *channel.BaseURL
	}

	// Pick first key from channel Keys (newline-separated)
	key := channel.Keys
	if idx := strings.IndexRune(key, '\n'); idx >= 0 {
		key = key[:idx]
	}
	key = strings.TrimSpace(key)

	// Get all local model names
	models, _, err := h.modelRepo.List(c.Request.Context(), 1, 99999, "", "")
	if err != nil {
		slog.Error("get model list failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	modelNames := make([]string, len(models))
	for i, m := range models {
		modelNames[i] = m.ModelName
	}

	count, err := h.pricingService.SyncUpstreamPricing(c.Request.Context(), baseURL, key, modelNames)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: fmt.Sprintf("成功同步 %d 条定价", count), Data: map[string]int{"synced": count}})
}

// SyncPresetPricing 从预设来源（models.dev 等）同步定价
func (h *PricingHandler) SyncPresetPricing(c *gin.Context) {
	var req dto.SyncPresetPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	// 查找对应的预设
	var preset *service.PresetPricingSource
	for _, p := range service.PresetPricingSources {
		if strings.Contains(p.BaseURL, req.Preset) || strings.EqualFold(p.Name, req.Preset) {
			preset = &p
			break
		}
	}
	if preset == nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "未知预设来源: " + req.Preset + "，可用: models.dev"})
		return
	}

	// Get all local model names
	models, _, err := h.modelRepo.List(c.Request.Context(), 1, 99999, "", "")
	if err != nil {
		slog.Error("get model list failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	modelNames := make([]string, len(models))
	for i, m := range models {
		modelNames[i] = m.ModelName
	}

	count, err := h.pricingService.SyncPresetPricing(c.Request.Context(), *preset, modelNames)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: fmt.Sprintf("成功同步 %d 条定价", count), Data: map[string]int{"synced": count}})
}

func RegisterPricingRoutes(r *gin.RouterGroup, h *PricingHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	g := r.Group("/pricing", auth, admin)
	{
		g.POST("", h.Create)
		g.POST("/batch", h.BatchCreateOrUpdate)
		g.POST("/sync-upstream", h.SyncUpstreamPricing)
		g.POST("/sync-preset", h.SyncPresetPricing)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
	}
}
