package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
)

type PromptTemplateHandler struct {
	repo *repository.PromptTemplateRepository
}

func NewPromptTemplateHandler(repo *repository.PromptTemplateRepository) *PromptTemplateHandler {
	return &PromptTemplateHandler{repo: repo}
}

// List 提示词模板列表
// @Summary      获取提示词模板列表
// @Description  分页查询提示词模板，支持分类和关键词筛选
// @Tags         PromptTemplates
// @Accept       json
// @Produce      json
// @Param        category  query     string  false  "分类: coding/writing/analysis/creative/business"
// @Param        keyword   query     string  false  "搜索关键词"
// @Param        page      query     int     false  "页码"        default(1)
// @Param        page_size query     int     false  "每页数量"    default(50)
// @Success      200       {object}  dto.Response{data=dto.PagedResponse}
// @Failure      500       {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompt-templates [get]
func (h *PromptTemplateHandler) List(c *gin.Context) {
	category := c.Query("category")
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	templates, total, err := h.repo.List(c.Request.Context(), category, keyword, page, pageSize)
	if err != nil {
		slog.Error("list prompt templates failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: templates,
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// IncrementUsage 增加模板使用次数
// @Summary      增加模板使用次数
// @Description  使用模板时调用，增加 usage_count
// @Tags         PromptTemplates
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "模板 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Failure      500  {object}  dto.Response
// @Security     Bearer
// @Router       /api/prompt-templates/:id/use [post]
func (h *PromptTemplateHandler) IncrementUsage(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid template id"})
		return
	}

	if err := h.repo.IncrementUsage(c.Request.Context(), id); err != nil {
		slog.Error("increment prompt template usage failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}

func RegisterPromptTemplateRoutes(r *gin.RouterGroup, h *PromptTemplateHandler, auth gin.HandlerFunc) {
	g := r.Group("/prompt-templates", auth)
	{
		g.GET("", h.List)
		g.POST("/:id/use", h.IncrementUsage)
	}
}
