package admin

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

type ChannelHandler struct {
	channelService   *service.ChannelService
	auditService     *service.AuditService
	dashboardService *service.DashboardService
}

func NewChannelHandler(channelService *service.ChannelService, auditService *service.AuditService, dashboardService *service.DashboardService) *ChannelHandler {
	return &ChannelHandler{channelService: channelService, auditService: auditService, dashboardService: dashboardService}
}

// Create 创建渠道
// @Summary      创建渠道
// @Description  创建上游 AI 渠道
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateChannelRequest  true  "渠道信息"
// @Success      200   {object}  dto.Response{data=dto.ChannelInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels [post]
func (h *ChannelHandler) Create(c *gin.Context) {
	var req dto.CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	channel, err := h.channelService.CreateChannel(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordCreate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetChannel, channel.ID, channel,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToChannelInfo(channel)})
}

// List 渠道列表
// @Summary      获取渠道列表
// @Description  分页查询渠道，支持筛选
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Param        keyword    query     string  false  "搜索关键词"
// @Param        type       query     string  false  "渠道类型"
// @Param        status     query     int     false  "状态"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.ChannelInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels [get]
func (h *ChannelHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	keyword := c.Query("keyword")
	typeFilter := c.Query("type")
	statusFilter := -1
	if s := c.Query("status"); s != "" {
		v, err := strconv.Atoi(s)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid status"})
			return
		}
		statusFilter = v
	}

	channels, total, err := h.channelService.ListChannels(c.Request.Context(), page, pageSize, keyword, typeFilter, statusFilter)
	if err != nil {
		slog.Error("ListChannels failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: service.ChannelInfoList(channels),
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// Get 渠道详情
// @Summary      获取渠道详情
// @Description  根据 ID 获取单个渠道信息
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "渠道 ID"
// @Success      200  {object}  dto.Response{data=dto.ChannelInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id} [get]
func (h *ChannelHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	channel, err := h.channelService.GetChannel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToChannelInfo(channel)})
}

// Update 更新渠道
// @Summary      更新渠道信息
// @Description  管理员更新渠道配置
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id    path      int                      true  "渠道 ID"
// @Param        body  body      dto.UpdateChannelRequest  true  "渠道信息"
// @Success      200   {object}  dto.Response{data=dto.ChannelInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id} [put]
func (h *ChannelHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	var req dto.UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	oldChannel, getErr := h.channelService.GetChannel(c.Request.Context(), id)
	if getErr != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: "channel not found"})
		return
	}
	channel, err := h.channelService.UpdateChannel(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordUpdate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetChannel, id, oldChannel, channel,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToChannelInfo(channel)})
}

// Delete 删除渠道
// @Summary      删除渠道
// @Description  管理员删除渠道
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "渠道 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id} [delete]
func (h *ChannelHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	oldChannel, getErr := h.channelService.GetChannel(c.Request.Context(), id)
	if getErr != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: "channel not found"})
		return
	}
	if err := h.channelService.DeleteChannel(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordDelete(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetChannel, id, oldChannel,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

// Test 测试渠道
// @Summary      测试渠道连通性
// @Description  对指定渠道进行连通性探测
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "渠道 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id}/test [post]
func (h *ChannelHandler) Test(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	responseTimeMs, err := h.channelService.TestChannel(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadGateway, dto.Response{Code: 502, Message: "探测失败，请检查渠道配置"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok", Data: gin.H{"response_time_ms": responseTimeMs, "status": "ok"}})
}

// FetchModels 拉取上游模型
// @Summary      从上游拉取模型列表
// @Description  从渠道的上游 API 拉取可用模型列表
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "渠道 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id}/fetch-models [post]
func (h *ChannelHandler) FetchModels(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	resp, err := h.channelService.FetchUpstreamModels(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "internal server error"
		switch {
		case errors.Is(err, service.ErrChannelNotFound):
			status = http.StatusNotFound
			msg = "channel not found"
		case errors.Is(err, service.ErrUnsupportedChannelType),
			errors.Is(err, service.ErrChannelBaseURLEmpty),
			errors.Is(err, service.ErrChannelKeysEmpty):
			status = http.StatusBadRequest
			msg = err.Error()
		case errors.Is(err, service.ErrUpstreamUnreachable),
			errors.Is(err, service.ErrUpstreamStatus),
			errors.Is(err, service.ErrInvalidUpstreamResponse):
			status = http.StatusBadGateway
			msg = err.Error()
		}
		c.JSON(status, dto.Response{Code: status, Message: msg})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: resp})
}

// PreviewModels 预览上游模型
// @Summary      预览上游模型
// @Description  预览渠道上游的模型列表
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "渠道 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id}/preview-models [post]
func (h *ChannelHandler) PreviewModels(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	resp, err := h.channelService.PreviewUpstreamModels(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "internal server error"
		switch {
		case errors.Is(err, service.ErrChannelNotFound):
			status = http.StatusNotFound
			msg = "channel not found"
		case errors.Is(err, service.ErrUnsupportedChannelType),
			errors.Is(err, service.ErrChannelBaseURLEmpty),
			errors.Is(err, service.ErrChannelKeysEmpty):
			status = http.StatusBadRequest
			msg = err.Error()
		case errors.Is(err, service.ErrUpstreamUnreachable),
			errors.Is(err, service.ErrUpstreamStatus),
			errors.Is(err, service.ErrInvalidUpstreamResponse):
			status = http.StatusBadGateway
			msg = err.Error()
		}
		c.JSON(status, dto.Response{Code: status, Message: msg})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: resp})
}

// SyncModels 同步上游模型
// @Summary      同步上游模型到本地
// @Description  将上游模型同步到本地模型库
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        id    path      int                              true  "渠道 ID"
// @Param        body  body      dto.SyncUpstreamModelsRequest     true  "同步配置"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Failure      404   {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/{id}/sync-models [post]
func (h *ChannelHandler) SyncModels(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	var req dto.SyncUpstreamModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	resp, err := h.channelService.SyncUpstreamModels(c.Request.Context(), id, &req)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "internal server error"
		switch {
		case errors.Is(err, service.ErrChannelNotFound):
			status = http.StatusNotFound
			msg = "channel not found"
		case errors.Is(err, service.ErrUnsupportedChannelType),
			errors.Is(err, service.ErrEmptyModelName),
			errors.Is(err, service.ErrDuplicateModelName):
			status = http.StatusBadRequest
			msg = err.Error()
		}
		c.JSON(status, dto.Response{Code: 400, Message: msg})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: resp})
}

// PreviewModelsFromConfig 从配置预览模型
// @Summary      从配置参数预览上游模型
// @Description  不创建渠道，直接根据配置参数预览上游模型列表
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        body  body      dto.PreviewModelsFromConfigRequest  true  "渠道配置参数"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/preview-models-direct [post]
func (h *ChannelHandler) PreviewModelsFromConfig(c *gin.Context) {
	var req dto.PreviewModelsFromConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	resp, err := h.channelService.PreviewUpstreamModelsFromConfig(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "internal server error"
		switch {
		case errors.Is(err, service.ErrUnsupportedChannelType),
			errors.Is(err, service.ErrChannelBaseURLEmpty):
			status = http.StatusBadRequest
			msg = err.Error()
		case errors.Is(err, service.ErrChannelKeysEmpty):
			status = http.StatusBadRequest
			msg = "请填写至少一个 API Key 后再拉取模型"
		case errors.Is(err, service.ErrUpstreamUnreachable),
			errors.Is(err, service.ErrUpstreamStatus),
			errors.Is(err, service.ErrInvalidUpstreamResponse):
			status = http.StatusBadGateway
			msg = err.Error()
		}
		c.JSON(status, dto.Response{Code: status, Message: msg})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: resp})
}

// TestFromConfig 从配置测试渠道
// @Summary      从配置参数测试渠道连通性
// @Description  不创建渠道，直接根据配置参数测试连通性
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Param        body  body      dto.TestChannelFromConfigRequest  true  "渠道配置参数"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/test-direct [post]
func (h *ChannelHandler) TestFromConfig(c *gin.Context) {
	var req dto.TestChannelFromConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	resp, err := h.channelService.TestChannelFromConfig(c.Request.Context(), &req)
	if err != nil {
		status := http.StatusInternalServerError
		msg := "internal server error"
		switch {
		case errors.Is(err, service.ErrUnsupportedChannelType):
			status = http.StatusBadRequest
			msg = "不支持的渠道类型"
		case errors.Is(err, service.ErrChannelBaseURLEmpty):
			status = http.StatusBadRequest
			msg = "请填写 Base URL"
		}
		c.JSON(status, dto.Response{Code: 400, Message: msg})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: resp, Message: "channel is reachable"})
}

// GetGroups 获取所有分组
// @Summary      获取所有渠道分组
// @Description  获取所有已使用的渠道分组名称列表
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response
// @Failure      500  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/groups [get]
func (h *ChannelHandler) GetGroups(c *gin.Context) {
	groups, err := h.channelService.GetDistinctGroups(c.Request.Context())
	if err != nil {
		slog.Error("GetDistinctGroups failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: groups})
}

// ListTypes 获取渠道类型列表
// @Summary      获取渠道类型列表
// @Description  获取所有支持的渠道类型
// @Tags         Channels
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response
// @Security     Bearer
// @Router       /api/channels/types [get]
func (h *ChannelHandler) ListTypes(c *gin.Context) {
	types := h.channelService.GetChannelTypes()
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: types})
}

// LoadOverview 渠道负载总览
func (h *ChannelHandler) LoadOverview(c *gin.Context) {
	items, err := h.dashboardService.GetChannelLoadOverview(c.Request.Context())
	if err != nil {
		slog.Error("GetChannelLoadOverview failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: gin.H{"channels": items}})
}

// ListTestLogs 获取渠道测试历史
func (h *ChannelHandler) ListTestLogs(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel id"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := h.channelService.ListTestLogs(c.Request.Context(), id, page, pageSize)
	if err != nil {
		slog.Error("ListTestLogs failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data: logs,
		Pagination: dto.Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
		},
	}})
}

func RegisterChannelRoutes(r *gin.RouterGroup, h *ChannelHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	g := r.Group("/channels", auth, admin)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/types", h.ListTypes)
		g.GET("/groups", h.GetGroups)
		g.POST("/preview-models-direct", h.PreviewModelsFromConfig)
		g.POST("/test-direct", h.TestFromConfig)
		g.GET("/load-overview", h.LoadOverview)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
		g.POST("/:id/test", h.Test)
		g.POST("/:id/fetch-models", h.FetchModels)
		g.POST("/:id/preview-models", h.PreviewModels)
		g.POST("/:id/sync-models", h.SyncModels)
		g.GET("/:id/test-logs", h.ListTestLogs)
	}
}
