package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type QuotaTransactionHandler struct {
	billingService *service.BillingService
}

func NewQuotaTransactionHandler(billingService *service.BillingService) *QuotaTransactionHandler {
	return &QuotaTransactionHandler{billingService: billingService}
}

// List 额度流水列表
// @Summary      获取额度变动流水列表
// @Tags         QuotaTransactions
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"          default(1)
// @Param        page_size  query     int     false  "每页数量"      default(20)
// @Param        user_id    query     int     false  "用户 ID"
// @Param        type       query     string  false  "流水类型"
// @Param        start_date query     string  false  "开始日期 YYYY-MM-DD"
// @Param        end_date   query     string  false  "结束日期 YYYY-MM-DD"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.QuotaTransactionInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-transactions [get]
func (h *QuotaTransactionHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	userID, _ := strconv.ParseUint(c.Query("user_id"), 10, 64)
	trType := c.Query("type")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	list, total, err := h.billingService.ListFilteredTransactions(c.Request.Context(), page, pageSize, userID, trType, startDate, endDate)
	if err != nil {
		slog.Error("list quota transactions failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       list,
		Pagination: buildPagination(page, pageSize, total),
	}})
}

func RegisterQuotaTransactionRoutes(r *gin.RouterGroup, h *QuotaTransactionHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/quota-transactions", auth, admin)
	{
		g.GET("", h.List)
	}
}
