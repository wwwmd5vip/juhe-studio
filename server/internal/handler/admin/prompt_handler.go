package admin

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

type PromptHandler struct {
	promptService *service.PromptService
	auditService  *service.AuditService
}

func NewPromptHandler(promptService *service.PromptService, auditService *service.AuditService) *PromptHandler {
	return &PromptHandler{promptService: promptService, auditService: auditService}
}

// CreateCategory 创建分类
// @Summary      创建提示词分类
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        type  query     string                   true  "提示词类型: image/agent/package"
// @Param        body  body      dto.CreateCategoryRequest true  "分类信息"
// @Success      200   {object}  dto.Response{data=dto.CategoryInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/categories [post]
func (h *PromptHandler) CreateCategory(c *gin.Context) {
	promptType, err := h.parsePromptType(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	cat, err := h.promptService.CreateCategory(c.Request.Context(), promptType, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.auditService.RecordCreate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetPrompt, cat.ID, cat,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToCategoryInfo(cat)})
}

// ListCategories 分类列表
// @Summary      获取提示词分类列表
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        type       query     string  false  "提示词类型"  default(image)
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.CategoryInfo}}
// @Failure      400        {object}  dto.Response
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/categories [get]
func (h *PromptHandler) ListCategories(c *gin.Context) {
	promptType, err := h.parsePromptType(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	page, pageSize, err := h.parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	cats, total, err := h.promptService.ListCategories(c.Request.Context(), promptType, page, pageSize)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.CategoryInfoList(cats),
		Pagination: h.buildPagination(page, pageSize, total),
	}})
}

// GetCategory 分类详情
// @Summary      获取分类详情
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "分类 ID"
// @Success      200  {object}  dto.Response{data=dto.CategoryInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/categories/{id} [get]
func (h *PromptHandler) GetCategory(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	cat, err := h.promptService.GetCategory(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToCategoryInfo(cat)})
}

// UpdateCategory 更新分类
// @Summary      更新分类
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id    path      int                       true  "分类 ID"
// @Param        body  body      dto.UpdateCategoryRequest  true  "分类信息"
// @Success      200   {object}  dto.Response{data=dto.CategoryInfo}
// @Failure      400   {object}  dto.Response
// @Failure      404   {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/categories/{id} [put]
func (h *PromptHandler) UpdateCategory(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	oldCat, _ := h.promptService.GetCategory(c.Request.Context(), id)
	cat, err := h.promptService.UpdateCategory(c.Request.Context(), id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.auditService.RecordUpdate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetPrompt, id, oldCat, cat,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToCategoryInfo(cat)})
}

// DeleteCategory 删除分类
// @Summary      删除分类
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "分类 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/categories/{id} [delete]
func (h *PromptHandler) DeleteCategory(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	oldCat, _ := h.promptService.GetCategory(c.Request.Context(), id)
	if err := h.promptService.DeleteCategory(c.Request.Context(), id); err != nil {
		h.handleError(c, err)
		return
	}
	h.auditService.RecordDelete(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetPrompt, id, oldCat,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0})
}

// CreatePrompt 创建提示词
// @Summary      创建提示词
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        type  query     string                  true  "提示词类型: image/agent/package"
// @Param        body  body      dto.CreatePromptRequest true  "提示词信息"
// @Success      200   {object}  dto.Response{data=dto.PromptInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts [post]
func (h *PromptHandler) CreatePrompt(c *gin.Context) {
	promptType, err := h.parsePromptType(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.CreatePromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	authorID := middleware.CurrentUserID(c)
	p, err := h.promptService.CreatePrompt(c.Request.Context(), authorID, promptType, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.auditService.RecordCreate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetPrompt, p.ID, p,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPromptInfo(p)})
}

// ListPrompts 提示词列表
// @Summary      获取提示词列表
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        type        query     string  false  "提示词类型"  default(image)
// @Param        page        query     int     false  "页码"        default(1)
// @Param        page_size   query     int     false  "每页数量"    default(20)
// @Param        category_id query     int     false  "分类 ID"
// @Param        tag         query     string  false  "标签"
// @Param        keyword     query     string  false  "关键词"
// @Param        status      query     int     false  "状态"
// @Success      200         {object}  dto.Response{data=dto.PagedResponse}
// @Failure      400         {object}  dto.Response
// @Failure      500         {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts [get]
func (h *PromptHandler) ListPrompts(c *gin.Context) {
	promptType, err := h.parsePromptType(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	page, pageSize, err := h.parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var categoryID *uint64
	if cid := c.Query("category_id"); cid != "" {
		if id, err := strconv.ParseUint(cid, 10, 64); err == nil {
			categoryID = &id
		}
	}
	var status *int
	if s := c.Query("status"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			status = &v
		}
	}
	prompts, total, err := h.promptService.ListPrompts(
		c.Request.Context(),
		promptType,
		page, pageSize,
		categoryID,
		c.Query("tag"),
		c.Query("keyword"),
		status,
	)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.PromptListItemList(prompts),
		Pagination: h.buildPagination(page, pageSize, total),
	}})
}

// GetPrompt 提示词详情
// @Summary      获取提示词详情
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "提示词 ID"
// @Success      200  {object}  dto.Response{data=dto.PromptInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id} [get]
func (h *PromptHandler) GetPrompt(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	p, err := h.promptService.GetPrompt(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPromptInfo(p)})
}

// UpdatePrompt 更新提示词
// @Summary      更新提示词
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id    path      int                     true  "提示词 ID"
// @Param        body  body      dto.UpdatePromptRequest true  "提示词信息"
// @Success      200   {object}  dto.Response{data=dto.PromptInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id} [put]
func (h *PromptHandler) UpdatePrompt(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.UpdatePromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	oldP, _ := h.promptService.GetPrompt(c.Request.Context(), id)
	p, err := h.promptService.UpdatePrompt(c.Request.Context(), id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.auditService.RecordUpdate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetPrompt, id, oldP, p,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPromptInfo(p)})
}

// DeletePrompt 删除提示词
// @Summary      删除提示词
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "提示词 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id} [delete]
func (h *PromptHandler) DeletePrompt(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	oldP, _ := h.promptService.GetPrompt(c.Request.Context(), id)
	if err := h.promptService.DeletePrompt(c.Request.Context(), id); err != nil {
		h.handleError(c, err)
		return
	}
	h.auditService.RecordDelete(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetPrompt, id, oldP,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0})
}

// PublishPrompt 发布提示词
// @Summary      发布提示词
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "提示词 ID"
// @Success      200  {object}  dto.Response{data=dto.PromptInfo}
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id}/publish [post]
func (h *PromptHandler) PublishPrompt(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	p, err := h.promptService.PublishPrompt(c.Request.Context(), id, middleware.CurrentUserID(c))
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPromptInfo(p)})
}

// ListPromptVersions 版本历史
// @Summary      获取提示词版本历史
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id         path      int  true  "提示词 ID"
// @Param        page       query     int  false "页码"      default(1)
// @Param        page_size  query     int  false "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.PromptVersionInfo}}
// @Failure      400        {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id}/versions [get]
func (h *PromptHandler) ListPromptVersions(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	page, pageSize, err := h.parsePagination(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	versions, total, err := h.promptService.ListPromptVersions(c.Request.Context(), id, page, pageSize)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.PromptVersionInfoList(versions),
		Pagination: h.buildPagination(page, pageSize, total),
	}})
}

// RollbackPrompt 回滚提示词
// @Summary      回滚提示词到指定版本
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id          path      int  true  "提示词 ID"
// @Param        version_id  path      int  true  "目标版本 ID"
// @Success      200         {object}  dto.Response{data=dto.PromptInfo}
// @Failure      400         {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id}/rollback/{version_id} [post]
func (h *PromptHandler) RollbackPrompt(c *gin.Context) {
	promptID, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	versionID, err := strconv.ParseUint(c.Param("version_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid version id"})
		return
	}
	p, err := h.promptService.RollbackPrompt(c.Request.Context(), promptID, versionID, middleware.CurrentUserID(c))
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPromptInfo(p)})
}

// SetPackageItems 设置封装步骤
// @Summary      设置封装步骤
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id    path      int                         true  "封装 ID"
// @Param        body  body      dto.SetPackageItemsRequest  true  "步骤列表"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id}/package-items [post]
func (h *PromptHandler) SetPackageItems(c *gin.Context) {
	packageID, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.SetPackageItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	items := make([]struct {
		PromptID  uint64
		SortOrder int
	}, len(req.Items))
	for i, it := range req.Items {
		items[i] = struct {
			PromptID  uint64
			SortOrder int
		}{PromptID: it.PromptID, SortOrder: it.SortOrder}
	}
	if err := h.promptService.SetPackageItems(c.Request.Context(), packageID, items); err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0})
}

// ListPackageItems 获取封装步骤列表
// @Summary      获取封装步骤列表
// @Tags         Prompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "封装 ID"
// @Success      200  {object}  dto.Response{data=[]dto.PromptPackageItemInfo}
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompts/{id}/package-items [get]
func (h *PromptHandler) ListPackageItems(c *gin.Context) {
	packageID, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	items, err := h.promptService.ListPackageItems(c.Request.Context(), packageID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.PromptPackageItemInfoList(items)})
}

func (h *PromptHandler) handleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrPromptNotFound),
		errors.Is(err, service.ErrPromptNotPublished),
		errors.Is(err, service.ErrPromptVersionNotFound),
		errors.Is(err, service.ErrPromptPackageItemNotFound),
		errors.Is(err, service.ErrCategoryNotFound):
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
	case errors.Is(err, service.ErrPromptNotPackage):
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
	case errors.Is(err, service.ErrCategoryNameExists),
		errors.Is(err, service.ErrCategoryHasPrompts):
		c.JSON(http.StatusConflict, dto.Response{Code: 409, Message: err.Error()})
	case errors.Is(err, service.ErrVariableMissing),
		errors.Is(err, service.ErrInvalidVariableKey),
		errors.Is(err, service.ErrInvalidVariableType):
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
	default:
		slog.Error("prompt handler error", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
	}
}

func (h *PromptHandler) parseID(c *gin.Context) (uint64, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid prompt id")
	}
	return id, nil
}

func (h *PromptHandler) parsePromptType(c *gin.Context) (string, error) {
	pt := c.DefaultQuery("type", domain.PromptTypeImage)
	if pt == domain.PromptTypeImage ||
		pt == domain.PromptTypeAgent ||
		pt == domain.PromptTypePackage {
		return pt, nil
	}
	return "", fmt.Errorf("invalid prompt type: %s", pt)
}

func (h *PromptHandler) parsePagination(c *gin.Context) (int, int, error) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		return 0, 0, fmt.Errorf("invalid page")
	}
	pageSize, err := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if err != nil || pageSize < 1 || pageSize > 100 {
		return 0, 0, fmt.Errorf("invalid page_size")
	}
	return page, pageSize, nil
}

func (h *PromptHandler) buildPagination(page, pageSize int, total int64) dto.Pagination {
	return dto.Pagination{
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
	}
}

func RegisterPromptRoutes(r *gin.RouterGroup, h *PromptHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	cats := r.Group("/prompts/categories", auth, admin)
	{
		cats.GET("", h.ListCategories)
		cats.POST("", h.CreateCategory)
		cats.GET("/:id", h.GetCategory)
		cats.PUT("/:id", h.UpdateCategory)
		cats.DELETE("/:id", h.DeleteCategory)
	}
	prompts := r.Group("/prompts", auth, admin)
	{
		prompts.GET("", h.ListPrompts)
		prompts.POST("", h.CreatePrompt)
		prompts.GET("/:id", h.GetPrompt)
		prompts.PUT("/:id", h.UpdatePrompt)
		prompts.DELETE("/:id", h.DeletePrompt)
		prompts.POST("/:id/publish", h.PublishPrompt)
		prompts.GET("/:id/versions", h.ListPromptVersions)
		prompts.POST("/:id/rollback/:version_id", h.RollbackPrompt)
		prompts.POST("/:id/package-items", h.SetPackageItems)
		prompts.GET("/:id/package-items", h.ListPackageItems)
	}
}
