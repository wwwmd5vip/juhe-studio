package relay

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type PromptHandler struct {
	promptService *service.PromptService
}

func NewPromptHandler(promptService *service.PromptService) *PromptHandler {
	return &PromptHandler{promptService: promptService}
}

// ListPrompts 提示词列表
// @Summary      获取已发布的提示词列表
// @Tags         RelayPrompts
// @Accept       json
// @Produce      json
// @Param        type        query     string  false  "提示词类型: image/agent/package"  default(image)
// @Param        page        query     int     false  "页码"      default(1)
// @Param        page_size   query     int     false  "每页数量"  default(20)
// @Param        category_id query     int     false  "分类 ID"
// @Param        tag         query     string  false  "标签"
// @Param        keyword     query     string  false  "搜索关键词"
// @Success      200         {object}  dto.Response{data=dto.PagedResponse}
// @Failure      400         {object}  dto.Response
// @Failure      500         {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/prompts [get]
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
	status := int(domain.PromptStatusPublished)
	prompts, total, err := h.promptService.ListPrompts(
		c.Request.Context(),
		promptType,
		page, pageSize,
		categoryID,
		c.Query("tag"),
		c.Query("keyword"),
		&status,
	)
	if err != nil {
		slog.Error("list prompts failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.PromptListItemList(prompts),
		Pagination: h.buildPagination(page, pageSize, total),
	}})
}

// GetPrompt 提示词详情
// @Summary      获取提示词详情
// @Tags         RelayPrompts
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "提示词 ID"
// @Success      200  {object}  dto.Response{data=dto.PromptInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/prompts/{id} [get]
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
	if p.Status != domain.PromptStatusPublished {
		h.handleError(c, service.ErrPromptNotPublished)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToPromptInfo(p)})
}

// RenderPrompt 渲染提示词
// @Summary      渲染提示词（替换变量）
// @Tags         RelayPrompts
// @Accept       json
// @Produce      json
// @Param        id    path      int                       true  "提示词 ID"
// @Param        body  body      dto.RenderPromptRequest   true  "变量值"
// @Success      200   {object}  dto.Response{data=dto.RenderPromptResponse}
// @Failure      400   {object}  dto.Response
// @Failure      404   {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/prompts/{id}/render [post]
func (h *PromptHandler) RenderPrompt(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.RenderPromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if req.Variables == nil {
		req.Variables = map[string]string{}
	}
	content, err := h.promptService.RenderPrompt(c.Request.Context(), id, req.Variables)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.RenderPromptResponse{Content: content}})
}

// RenderPackage 渲染封装
// @Summary      渲染封装（多步骤提示词）
// @Tags         RelayPrompts
// @Accept       json
// @Produce      json
// @Param        id    path      int                       true  "封装 ID"
// @Param        body  body      dto.RenderPromptRequest   true  "变量值"
// @Success      200   {object}  dto.Response{data=dto.RenderPackageResponse}
// @Failure      400   {object}  dto.Response
// @Failure      404   {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/prompts/{id}/render-package [post]
func (h *PromptHandler) RenderPackage(c *gin.Context) {
	id, err := h.parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	var req dto.RenderPromptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if req.Variables == nil {
		req.Variables = map[string]string{}
	}
	results, err := h.promptService.RenderPackage(c.Request.Context(), id, req.Variables)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.RenderPackageResponse{Results: results}})
}

// ListCategories 提示词分类列表
// @Summary      获取提示词分类列表
// @Tags         RelayPrompts
// @Accept       json
// @Produce      json
// @Param        type       query     string  false  "提示词类型"  default(image)
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse}
// @Failure      400        {object}  dto.Response
// @Failure      500        {object}  dto.Response
// @Security     ApiKeyAuth
// @Router       /v1/prompts/categories [get]
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
	categories, total, err := h.promptService.ListCategories(c.Request.Context(), promptType, page, pageSize)
	if err != nil {
		slog.Error("list categories failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       categories,
		Pagination: h.buildPagination(page, pageSize, total),
	}})
}

func (h *PromptHandler) handleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrPromptNotFound),
		errors.Is(err, service.ErrPromptNotPublished),
		errors.Is(err, service.ErrPromptVersionNotFound),
		errors.Is(err, service.ErrPromptPackageItemNotFound):
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
	case errors.Is(err, service.ErrPromptNotPackage):
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
	case errors.Is(err, service.ErrVariableMissing),
		errors.Is(err, service.ErrInvalidVariableKey),
		errors.Is(err, service.ErrInvalidVariableType):
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
	default:
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
