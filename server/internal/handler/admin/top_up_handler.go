package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type TopUpHandler struct {
	topUpService *service.TopUpService
	auditService *service.AuditService
}

func NewTopUpHandler(topUpService *service.TopUpService, auditService *service.AuditService) *TopUpHandler {
	return &TopUpHandler{topUpService: topUpService, auditService: auditService}
}

// Create 创建充值订单（手动）
// @Summary      创建充值订单
// @Description  管理员手动为用户创建充值订单
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateTopUpRequest  true  "充值信息"
// @Success      200   {object}  dto.Response{data=dto.TopUpInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups [post]
func (h *TopUpHandler) Create(c *gin.Context) {
	var req dto.CreateTopUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	topUp, err := h.topUpService.CreateManualTopUp(c.Request.Context(), req.UserID, uint64(req.QuotaGranted))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTopUpInfo(topUp)})
}

// List 充值订单列表
// @Summary      获取充值订单列表
// @Description  分页查询充值订单，支持筛选
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"          default(1)
// @Param        page_size  query     int     false  "每页数量"      default(20)
// @Param        user_id    query     int     false  "用户 ID"
// @Param        status     query     string  false  "订单状态"
// @Param        start_date query     string  false  "开始日期 YYYY-MM-DD"
// @Param        end_date   query     string  false  "结束日期 YYYY-MM-DD"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.TopUpInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups [get]
func (h *TopUpHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var userID *uint64
	if uid := c.Query("user_id"); uid != "" {
		if id, err := strconv.ParseUint(uid, 10, 64); err == nil {
			userID = &id
		}
	}
	status := c.Query("status")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	topUps, total, err := h.topUpService.List(c.Request.Context(), userID, page, pageSize, status, startDate, endDate)
	if err != nil {
		slog.Error("list top-ups failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToTopUpInfoList(topUps),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// Get 充值订单详情
// @Summary      获取充值订单详情
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "订单 ID"
// @Success      200  {object}  dto.Response{data=dto.TopUpInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups/{id} [get]
func (h *TopUpHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid topup id"})
		return
	}
	topUp, err := h.topUpService.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTopUpInfo(topUp)})
}

// MarkPaid 标记为已支付
// @Summary      标记订单为已支付
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        id             path      int     true  "订单 ID"
// @Param        transaction_id query     string  false "交易流水号"
// @Success      200            {object}  dto.Response{data=dto.TopUpInfo}
// @Failure      400            {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups/{id}/paid [post]
func (h *TopUpHandler) MarkPaid(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid topup id"})
		return
	}
	topUp, err := h.topUpService.MarkPaid(c.Request.Context(), id, c.Query("transaction_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTopUpInfo(topUp)})
}

// MarkFailed 标记为失败
// @Summary      标记订单为失败
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "订单 ID"
// @Success      200  {object}  dto.Response{data=dto.TopUpInfo}
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups/{id}/failed [post]
func (h *TopUpHandler) MarkFailed(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid topup id"})
		return
	}
	topUp, err := h.topUpService.MarkFailed(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTopUpInfo(topUp)})
}

// Refund 退款
// @Summary      退款
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "订单 ID"
// @Success      200  {object}  dto.Response{data=dto.TopUpInfo}
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups/{id}/refund [post]
func (h *TopUpHandler) Refund(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid topup id"})
		return
	}
	topUp, err := h.topUpService.RefundOrder(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTopUpInfo(topUp)})
}

func buildPagination(page, pageSize int, total int64) dto.Pagination {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return dto.Pagination{
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
	}
}

type BatchUpdateTopUpStatusRequest struct {
	IDs    []uint64 `json:"ids" binding:"required,min=1"`
	Status string   `json:"status" binding:"required,oneof=paid failed"`
}

// BatchUpdateStatus 批量更新状态
// @Summary      批量更新充值订单状态
// @Tags         TopUps
// @Accept       json
// @Produce      json
// @Param        body  body      BatchUpdateTopUpStatusRequest  true  "批量状态更新"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/topups/batch-status [post]
func (h *TopUpHandler) BatchUpdateStatus(c *gin.Context) {
	var req BatchUpdateTopUpStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	affected, err := h.topUpService.BatchUpdateStatus(c.Request.Context(), req.IDs, req.Status)
	if err != nil {
		slog.Error("batch update top-up status failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok", Data: map[string]int{"affected": affected}})
}

func RegisterTopUpRoutes(r *gin.RouterGroup, h *TopUpHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/topups", auth, admin)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.POST("/batch-status", h.BatchUpdateStatus)
		g.GET("/:id", h.Get)
		g.POST("/:id/paid", h.MarkPaid)
		g.POST("/:id/failed", h.MarkFailed)
		g.POST("/:id/refund", h.Refund)
	}
}
