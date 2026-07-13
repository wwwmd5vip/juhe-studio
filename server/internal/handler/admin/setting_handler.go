package admin

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/common/email"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

type SettingHandler struct {
	settingService *service.SettingService
	auditService   *service.AuditService
	emailSender    *email.Sender
}

func NewSettingHandler(settingService *service.SettingService, auditService *service.AuditService, emailSender *email.Sender) *SettingHandler {
	return &SettingHandler{settingService: settingService, auditService: auditService, emailSender: emailSender}
}

// Upsert 创建或更新系统设置
// @Summary      创建或更新系统设置
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Param        body  body      dto.UpsertSettingRequest  true  "设置信息"
// @Success      200   {object}  dto.Response{data=dto.SettingInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/settings [post]
func (h *SettingHandler) Upsert(c *gin.Context) {
	var req dto.UpsertSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	oldSt, _ := h.settingService.Get(c.Request.Context(), req.Key)
	st, err := h.settingService.Set(c.Request.Context(), req.Key, req.Value, req.Type, req.Category, req.Description)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if oldSt == nil {
		h.auditService.RecordCreate(
			middleware.CurrentUserID(c), middleware.CurrentUsername(c),
			domain.AuditTargetSetting, st.ID, st,
		)
	} else {
		h.auditService.RecordUpdate(
			middleware.CurrentUserID(c), middleware.CurrentUsername(c),
			domain.AuditTargetSetting, st.ID, oldSt, st,
		)
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: ToSettingInfo(st)})
}

// Get 获取设置
// @Summary      根据 Key 获取系统设置
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Param        key  path      string  true  "设置 Key"
// @Success      200  {object}  dto.Response{data=dto.SettingInfo}
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/settings/{key} [get]
func (h *SettingHandler) Get(c *gin.Context) {
	key := c.Param("key")
	st, err := h.settingService.Get(c.Request.Context(), key)
	if err != nil {
		if errors.Is(err, service.ErrSettingNotFound) {
			c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
			return
		}
		slog.Error("failed to get setting", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: ToSettingInfo(st)})
}

// Delete 删除设置
// @Summary      删除系统设置
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Param        key  path      string  true  "设置 Key"
// @Success      200  {object}  dto.Response
// @Failure      500  {object}  dto.Response
// @Security     Bearer
// @Router       /api/settings/{key} [delete]
func (h *SettingHandler) Delete(c *gin.Context) {
	key := c.Param("key")
	oldSt, _ := h.settingService.Get(c.Request.Context(), key)
	if err := h.settingService.Delete(c.Request.Context(), key); err != nil {
		slog.Error("failed to delete setting", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	h.auditService.RecordDelete(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetSetting, 0, oldSt,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0})
}

// List 设置列表，支持 category 筛选
// @Summary      获取所有系统设置列表
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Param        category   query     string false "分类筛选"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.SettingInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/settings [get]
func (h *SettingHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	categoryFilter := c.Query("category")
	list, total, err := h.settingService.List(c.Request.Context(), page, pageSize, categoryFilter)
	if err != nil {
		slog.Error("failed to list settings", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	result := make([]dto.SettingInfo, 0, len(list))
	for i := range list {
		result = append(result, ToSettingInfo(&list[i]))
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data: result,
		Pagination: dto.Pagination{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
		},
	}})
}

// ListCategorized 按分类分组返回所有设置
// @Summary      获取按分类分组的系统设置
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response{data=map[string][]dto.SettingInfo}
// @Security     Bearer
// @Router       /api/settings/categorized [get]
func (h *SettingHandler) ListCategorized(c *gin.Context) {
	grouped, err := h.settingService.ListCategorized(c.Request.Context())
	if err != nil {
		slog.Error("failed to list categorized settings", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	result := make(map[string][]dto.SettingInfo)
	for cat, list := range grouped {
		infos := make([]dto.SettingInfo, len(list))
		for i := range list {
			infos[i] = ToSettingInfo(&list[i])
		}
		result[cat] = infos
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: result})
}

func ToSettingInfo(s *domain.Setting) dto.SettingInfo {
	return dto.SettingInfo{
		ID:          s.ID,
		Key:         s.Key,
		Value:       s.Value,
		Type:        s.Type,
		Category:    s.Category,
		Description: s.Description,
		CreatedAt:   s.CreatedAt,
		UpdatedAt:   s.UpdatedAt,
	}
}

// BulkUpsert 批量创建或更新设置
// @Summary      批量创建或更新系统设置
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Param        body  body      dto.BulkUpsertSettingRequest  true  "设置列表"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/settings/bulk [put]
func (h *SettingHandler) BulkUpsert(c *gin.Context) {
	var req dto.BulkUpsertSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if err := h.settingService.BulkSet(c.Request.Context(), req.Settings); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0})
}

func RegisterSettingRoutes(r *gin.RouterGroup, h *SettingHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	g := r.Group("/settings", auth, admin)
	{
		g.POST("", h.Upsert)
		g.PUT("/bulk", h.BulkUpsert)
		g.GET("", h.List)
		g.GET("/categorized", h.ListCategorized)
		g.POST("/test-email", h.TestEmail)
		g.GET("/:key", h.Get)
		g.DELETE("/:key", h.Delete)
	}
}

// TestEmail 用当前 settings 中的 SMTP 配置发送测试邮件
// @Summary      发送测试邮件
// @Tags         Settings
// @Accept       json
// @Produce      json
// @Param        body  body      dto.TestEmailRequest  true  "目标邮箱"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/settings/test-email [post]
func (h *SettingHandler) TestEmail(c *gin.Context) {
	var req dto.TestEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if err := h.emailSender.SendTestEmail(c.Request.Context(), req.Email); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "邮件发送失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "测试邮件已发送到 " + req.Email})
}
