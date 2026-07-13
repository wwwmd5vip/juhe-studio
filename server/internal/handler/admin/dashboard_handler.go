package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type DashboardHandler struct {
	dashboardService *service.DashboardService
}

func NewDashboardHandler(dashboardService *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboardService: dashboardService}
}

// Stats 仪表盘统计
// @Summary      获取仪表盘统计数据
// @Description  获取系统概览统计数据
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response{data=dto.DashboardStats}
// @Failure      500  {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/stats [get]
func (h *DashboardHandler) Stats(c *gin.Context) {
	stats, err := h.dashboardService.GetStats(c.Request.Context())
	if err != nil {
		slog.Error("failed to get dashboard stats", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: stats})
}

// Trends 趋势数据
// @Summary      获取趋势数据
// @Description  获取消费趋势数据（可用于图表）
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Param        days    query     int   false  "天数范围"   default(30)
// @Param        user_id query     int   false  "用户 ID（可选）"
// @Success      200     {object}  dto.Response{data=[]dto.DashboardTrendItem}
// @Failure      500     {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/trends [get]
func (h *DashboardHandler) Trends(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days < 1 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	userID, _ := strconv.ParseUint(c.DefaultQuery("user_id", "0"), 10, 64)

	trends, err := h.dashboardService.GetTrends(c.Request.Context(), userID, days)
	if err != nil {
		slog.Error("failed to get dashboard trends", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: trends})
}

// ModelCapabilityStats 模型能力分布统计
// @Summary      获取模型能力分布
// @Description  获取所有模型的能力标签分布统计
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response{data=map[string]int}
// @Failure      500  {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/model-capability-stats [get]
func (h *DashboardHandler) ModelCapabilityStats(c *gin.Context) {
	stats, err := h.dashboardService.GetModelCapabilityStats(c.Request.Context())
	if err != nil {
		slog.Error("failed to get model capability stats", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: stats})
}

// UsageHeatmap 模型使用热力图
// @Summary      获取模型使用热力图
// @Description  获取24小时×模型的使用热力图矩阵
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Param        days  query     int   false  "天数范围"   default(7)
// @Success      200   {object}  dto.Response{data=[]dto.UsageHeatmapItem}
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/usage-heatmap [get]
func (h *DashboardHandler) UsageHeatmap(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	if days < 1 {
		days = 7
	}
	if days > 365 {
		days = 365
	}
	data, err := h.dashboardService.GetUsageHeatmap(c.Request.Context(), days)
	if err != nil {
		slog.Error("failed to get usage heatmap", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: data})
}

// TopUsers 用户消费排行
// @Summary      获取用户消费 Top N
// @Description  获取指定天数内消费最高的用户排行
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Param        days   query     int   false  "天数范围"   default(30)
// @Param        limit  query     int   false  "返回条数"   default(10)
// @Success      200    {object}  dto.Response{data=[]dto.TopUserItem}
// @Failure      500    {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/top-users [get]
func (h *DashboardHandler) TopUsers(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days < 1 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit < 1 || limit > 100 {
		limit = 10
	}
	data, err := h.dashboardService.GetTopUsers(c.Request.Context(), days, limit)
	if err != nil {
		slog.Error("failed to get top users", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: data})
}

// TopTokens Token 消费排行
// @Summary      获取 Token 消费 Top N
// @Description  获取指定天数内消费最高的 Token 排行
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Param        days   query     int   false  "天数范围"   default(30)
// @Param        limit  query     int   false  "返回条数"   default(10)
// @Success      200    {object}  dto.Response{data=[]dto.TopTokenItem}
// @Failure      500    {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/top-tokens [get]
func (h *DashboardHandler) TopTokens(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days < 1 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit < 1 || limit > 100 {
		limit = 10
	}
	data, err := h.dashboardService.GetTopTokens(c.Request.Context(), days, limit)
	if err != nil {
		slog.Error("failed to get top tokens", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: data})
}

// ErrorRate 错误率统计
// @Summary      获取 API 错误率
// @Description  获取渠道和模型维度的错误率统计
// @Tags         Dashboard
// @Accept       json
// @Produce      json
// @Param        days  query     int   false  "天数范围"   default(7)
// @Success      200   {object}  dto.Response{data=dto.ErrorRateResponse}
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/dashboard/error-rate [get]
func (h *DashboardHandler) ErrorRate(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	if days < 1 {
		days = 7
	}
	if days > 365 {
		days = 365
	}
	data, err := h.dashboardService.GetErrorRate(c.Request.Context(), days)
	if err != nil {
		slog.Error("failed to get error rate", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: data})
}


// QuotaForecast 获取配额使用预测
func (h *DashboardHandler) QuotaForecast(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Query("user_id"), 10, 64)
	if err != nil || userID == 0 {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user_id"})
		return
	}

	forecast, err := h.dashboardService.GetQuotaForecast(c.Request.Context(), userID)
	if err != nil {
		slog.Error("failed to get quota forecast", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: forecast})
}

func RegisterDashboardRoutes(r *gin.RouterGroup, h *DashboardHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/dashboard", auth, admin)
	{
		g.GET("/stats", h.Stats)
		g.GET("/trends", h.Trends)
		g.GET("/model-capability-stats", h.ModelCapabilityStats)
		g.GET("/usage-heatmap", h.UsageHeatmap)
		g.GET("/top-users", h.TopUsers)
		g.GET("/top-tokens", h.TopTokens)
		g.GET("/error-rate", h.ErrorRate)
		g.GET("/quota-forecast", h.QuotaForecast)
	}
}
