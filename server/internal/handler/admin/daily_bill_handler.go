package admin

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type DailyBillHandler struct {
	billingService *service.BillingService
}

func NewDailyBillHandler(billingService *service.BillingService) *DailyBillHandler {
	return &DailyBillHandler{billingService: billingService}
}

// Aggregate 聚合日账单
// @Summary      手动聚合日账单
// @Tags         DailyBills
// @Accept       json
// @Produce      json
// @Param        date  query     string  true  "日期 YYYY-MM-DD"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/daily-bills/aggregate [post]
func (h *DailyBillHandler) Aggregate(c *gin.Context) {
	dateStr := c.Query("date")
	if dateStr == "" {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "date is required (YYYY-MM-DD)"})
		return
	}
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid date format, expected YYYY-MM-DD"})
		return
	}
	if err := h.billingService.AggregateDailyBill(c.Request.Context(), date); err != nil {
		slog.Error("aggregate daily bill failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "aggregated"})
}

// ListDaily 日账单列表
// @Summary      获取日账单列表
// @Tags         DailyBills
// @Accept       json
// @Produce      json
// @Param        user_id    query     int     false  "用户 ID"
// @Param        start_date query     string  true   "开始日期 YYYY-MM-DD"
// @Param        end_date   query     string  true   "结束日期 YYYY-MM-DD"
// @Param        page       query     int     false  "页码"      default(1)
// @Param        page_size  query     int     false  "每页数量"  default(20)
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.DailyBillInfo}}
// @Failure      400        {object}  dto.Response
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/daily-bills [get]
func (h *DailyBillHandler) ListDaily(c *gin.Context) {
	var userID uint64
	if uid := c.Query("user_id"); uid != "" {
		id, err := strconv.ParseUint(uid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user_id"})
			return
		}
		userID = id
	}

	start, err := time.Parse("2006-01-02", c.Query("start_date"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid start_date, expected YYYY-MM-DD"})
		return
	}
	end, err := time.Parse("2006-01-02", c.Query("end_date"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid end_date, expected YYYY-MM-DD"})
		return
	}
	end = time.Date(end.Year(), end.Month(), end.Day(), 23, 59, 59, 999999999, time.UTC)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	list, total, err := h.billingService.ListDailyBills(c.Request.Context(), userID, start, end, page, pageSize)
	if err != nil {
		slog.Error("list daily bills failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToDailyBillInfoList(list),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// ListMonthly 月账单列表
// @Summary      获取月账单列表
// @Tags         DailyBills
// @Accept       json
// @Produce      json
// @Param        user_id     query     int     false  "用户 ID"
// @Param        start_month query     string  true   "开始月份 YYYY-MM"
// @Param        end_month   query     string  true   "结束月份 YYYY-MM"
// @Param        page        query     int     false  "页码"      default(1)
// @Param        page_size   query     int     false  "每页数量"  default(20)
// @Success      200         {object}  dto.Response{data=dto.PagedResponse}
// @Failure      400         {object}  dto.Response
// @Failure      500         {object}  dto.Response
// @Security     Bearer
// @Router       /api/daily-bills/monthly [get]
func (h *DailyBillHandler) ListMonthly(c *gin.Context) {
	var userID uint64
	if uid := c.Query("user_id"); uid != "" {
		id, err := strconv.ParseUint(uid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user_id"})
			return
		}
		userID = id
	}

	startMonth := c.Query("start_month")
	endMonth := c.Query("end_month")
	if startMonth == "" || endMonth == "" {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "start_month and end_month are required (YYYY-MM)"})
		return
	}

	start, err := time.Parse("2006-01", startMonth)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid start_month, expected YYYY-MM"})
		return
	}
	end, err := time.Parse("2006-01", endMonth)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid end_month, expected YYYY-MM"})
		return
	}

	monthsDiff := (end.Year()-start.Year())*12 + int(end.Month()-start.Month())
	if monthsDiff < 0 || monthsDiff > 24 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "date range must not exceed 24 months"})
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

	list, total, err := h.billingService.ListMonthlyBills(c.Request.Context(), userID, startMonth, endMonth, page, pageSize)
	if err != nil {
		slog.Error("list monthly bills failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       list,
		Pagination: buildPagination(page, pageSize, total),
	}})
}

func RegisterDailyBillRoutes(r *gin.RouterGroup, h *DailyBillHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/daily-bills", auth, admin)
	{
		g.POST("/aggregate", h.Aggregate)
		g.GET("", h.ListDaily)
		g.GET("/monthly", h.ListMonthly)
	}
}
