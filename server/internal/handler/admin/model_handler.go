package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

type ModelHandler struct {
	modelService *service.ModelService
	auditService *service.AuditService
	channelRepo  *repository.ChannelRepository
	pricingRepo  *repository.PricingRepository
}

func NewModelHandler(modelService *service.ModelService, auditService *service.AuditService, channelRepo *repository.ChannelRepository, pricingRepo *repository.PricingRepository) *ModelHandler {
	return &ModelHandler{modelService: modelService, auditService: auditService, channelRepo: channelRepo, pricingRepo: pricingRepo}
}

// Create 创建模型
// @Summary      创建模型
// @Description  创建 AI 模型并关联渠道
// @Tags         Models
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateModelRequest  true  "模型信息"
// @Success      200   {object}  dto.Response{data=dto.ModelInfo}
// @Failure      400   {object}  dto.Response
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/models [post]
func (h *ModelHandler) Create(c *gin.Context) {
	var req dto.CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	model, err := h.modelService.CreateModel(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if len(req.ChannelIDs) > 0 {
		if ch, cerr := h.channelRepo.FindByID(c.Request.Context(), req.ChannelIDs[0]); cerr == nil {
			mt, caps := service.InferModelCapabilities(ch.Type, model.ModelName)
			if mt != "" {
				_ = h.modelService.PatchModelType(c.Request.Context(), model.ID, mt, caps)
			}
		}
		if err := h.channelRepo.SyncModelAbilities(c.Request.Context(), model.ModelName, req.ChannelIDs); err != nil {
			// Cleanup: delete the model that was already created to avoid partial state
			_ = h.modelService.DeleteModel(c.Request.Context(), model.ID)
			slog.Error("failed to sync model abilities on create", "error", err)
			c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
			return
		}
	}

	operatorID := middleware.CurrentUserID(c)
	operatorName := ""
	if u := middleware.CurrentUser(c); u != nil {
		operatorName = u.Username
	}
	h.auditService.RecordCreate(
		operatorID, operatorName,
		domain.AuditTargetModel, model.ID, model,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToModelInfo(model)})
}

// List 模型列表
// @Summary      获取模型列表
// @Description  分页查询模型，支持筛选
// @Tags         Models
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Param        keyword    query     string  false  "搜索关键词"
// @Param        type       query     string  false  "模型类型"
// @Param        channel_id query     int     false  "渠道 ID"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.ModelInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/models [get]
func (h *ModelHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	keyword := c.Query("keyword")
	typeFilter := c.Query("type")
	channelID, _ := strconv.ParseUint(c.Query("channel_id"), 10, 64)

	var models []domain.Model
	var total int64
	var err error
	if channelID > 0 {
		models, total, err = h.modelService.ListModelsByChannel(c.Request.Context(), page, pageSize, keyword, channelID)
	} else {
		models, total, err = h.modelService.ListModels(c.Request.Context(), page, pageSize, keyword, typeFilter)
	}
	if err != nil {
		slog.Error("failed to list models", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	// 查出已定价的模型名，标记 has_pricing
	pricedSet, _ := h.pricingRepo.GetPricedModelNames(c.Request.Context())
	list := service.ModelInfoList(models)
	if pricedSet != nil {
		for i := range list {
			list[i].HasPricing = pricedSet[list[i].ModelName]
		}
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: list,
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// Get 模型详情
// @Summary      获取模型详情
// @Description  根据 ID 获取单个模型信息
// @Tags         Models
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "模型 ID"
// @Success      200  {object}  dto.Response{data=dto.ModelInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/models/{id} [get]
func (h *ModelHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid model id"})
		return
	}

	model, err := h.modelService.GetModel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToModelInfo(model)})
}

// Update 更新模型
// @Summary      更新模型信息
// @Description  更新模型配置
// @Tags         Models
// @Accept       json
// @Produce      json
// @Param        id    path      int                    true  "模型 ID"
// @Param        body  body      dto.UpdateModelRequest  true  "模型信息"
// @Success      200   {object}  dto.Response{data=dto.ModelInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/models/{id} [put]
func (h *ModelHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid model id"})
		return
	}

	var req dto.UpdateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	oldModel, _ := h.modelService.GetModel(c.Request.Context(), id)
	model, err := h.modelService.UpdateModel(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if len(req.ChannelIDs) > 0 {
		if ch, cerr := h.channelRepo.FindByID(c.Request.Context(), req.ChannelIDs[0]); cerr == nil {
			mt, caps := service.InferModelCapabilities(ch.Type, model.ModelName)
			if mt != "" {
				_ = h.modelService.PatchModelType(c.Request.Context(), model.ID, mt, caps)
			}
		}
		if err := h.channelRepo.SyncModelAbilities(c.Request.Context(), model.ModelName, req.ChannelIDs); err != nil {
			slog.Error("failed to sync model abilities on update", "error", err)
			c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
			return
		}
	}

	operatorID := middleware.CurrentUserID(c)
	operatorName := ""
	if u := middleware.CurrentUser(c); u != nil {
		operatorName = u.Username
	}
	h.auditService.RecordUpdate(
		operatorID, operatorName,
		domain.AuditTargetModel, id, oldModel, model,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToModelInfo(model)})
}

// Channels 获取模型关联的渠道
// @Summary      获取模型关联的渠道列表
// @Description  查看某个模型关联的所有渠道
// @Tags         Models
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "模型 ID"
// @Success      200  {object}  dto.Response{data=[]dto.ModelChannelInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/models/{id}/channels [get]
func (h *ModelHandler) Channels(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid model id"})
		return
	}

	model, err := h.modelService.GetModel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	rows, err := h.channelRepo.FindByModelID(c.Request.Context(), model.ModelName)
	if err != nil {
		slog.Error("failed to get model channels", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	result := make([]dto.ModelChannelInfo, len(rows))
	for i, r := range rows {
		result[i] = dto.ModelChannelInfo{
			ID:      r.ID,
			Name:    r.Name,
			Type:    r.Type,
			Status:  r.Status,
			BaseURL: r.BaseURL,
			Group:   r.Group,
		}
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: result})
}

// Delete 删除模型
// @Summary      删除模型
// @Description  删除指定的模型
// @Tags         Models
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "模型 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/models/{id} [delete]
func (h *ModelHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid model id"})
		return
	}

	oldModel, _ := h.modelService.GetModel(c.Request.Context(), id)
	if err := h.modelService.DeleteModel(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordDelete(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetModel, id, oldModel,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

func RegisterModelRoutes(r *gin.RouterGroup, h *ModelHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	// Read routes: all authenticated users can list/get models
	r.GET("/models", auth, h.List)
	r.GET("/models/:id", auth, h.Get)
	r.GET("/models/:id/channels", auth, h.Channels)
	// Write routes: admin only
	adminGroup := r.Group("/models", auth, admin)
	{
		adminGroup.POST("", h.Create)
		adminGroup.PUT("/:id", h.Update)
		adminGroup.DELETE("/:id", h.Delete)
	}
}
