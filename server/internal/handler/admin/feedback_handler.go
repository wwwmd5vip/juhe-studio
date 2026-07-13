package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

type FeedbackHandler struct {
	service *service.FeedbackService
}

func NewFeedbackHandler(svc *service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{service: svc}
}

// List 反馈列表
// @Summary      获取反馈列表
// @Description  分页查询反馈，支持按类型和日期筛选
// @Tags         Feedbacks
// @Accept       json
// @Produce      json
// @Param        page        query     int     false  "页码"          default(1)
// @Param        page_size   query     int     false  "每页数量"      default(20)
// @Param        type        query     string  false  "反馈类型 (bug/feature/other)"
// @Param        start_date  query     string  false  "开始日期 YYYY-MM-DD"
// @Param        end_date    query     string  false  "结束日期 YYYY-MM-DD"
// @Success      200         {object}  dto.Response{data=dto.PagedResponse{data=[]domain.Feedback}}
// @Failure      500         {object}  dto.Response
// @Security     Bearer
// @Router       /api/feedbacks [get]
func (h *FeedbackHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := repository.FeedbackFilter{
		Type:      c.Query("type"),
		StartDate: c.Query("start_date"),
		EndDate:   c.Query("end_date"),
	}

	feedbacks, total, err := h.service.List(c.Request.Context(), filter, page, pageSize)
	if err != nil {
		slog.Error("failed to list feedbacks", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       feedbacks,
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// Delete 删除反馈
// @Summary      删除反馈
// @Description  根据 ID 删除单条反馈
// @Tags         Feedbacks
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "反馈 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Failure      500  {object}  dto.Response
// @Security     Bearer
// @Router       /api/feedbacks/{id} [delete]
func (h *FeedbackHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid feedback id"})
		return
	}

	if err := h.service.Delete(c.Request.Context(), uint(id)); err != nil {
		slog.Error("failed to delete feedback", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}

// RegisterFeedbackRoutes 注册反馈管理路由
func RegisterFeedbackRoutes(r *gin.RouterGroup, h *FeedbackHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/feedbacks", auth, admin)
	{
		g.GET("", h.List)
		g.DELETE("/:id", h.Delete)
	}
}
