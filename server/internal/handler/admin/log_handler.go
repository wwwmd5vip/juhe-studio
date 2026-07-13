package admin

import (
	"encoding/csv"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

type LogHandler struct {
	logService *service.LogService
}

func NewLogHandler(logService *service.LogService) *LogHandler {
	return &LogHandler{logService: logService}
}

// List 消费日志列表
// @Summary      获取消费日志列表
// @Description  分页查询消费日志，支持多条件筛选
// @Tags         Logs
// @Accept       json
// @Produce      json
// @Param        page        query     int     false  "页码"          default(1)
// @Param        page_size   query     int     false  "每页数量"      default(20)
// @Param        user_id     query     int     false  "用户 ID"
// @Param        token_id    query     int     false  "Token ID"
// @Param        model_name  query     string  false  "模型名称"
// @Param        keyword     query     string  false  "关键词搜索（请求内容/响应内容/错误信息）"
// @Param        type        query     string  false  "日志类型"
// @Param        status_code query     int     false  "HTTP 状态码"
// @Param        channel_id  query     int     false  "渠道 ID"
// @Param        ip_address  query     string  false  "IP 地址"
// @Param        start_date  query     string  false  "开始日期 YYYY-MM-DD"
// @Param        end_date    query     string  false  "结束日期 YYYY-MM-DD"
// @Success      200         {object}  dto.Response{data=dto.PagedResponse{data=[]dto.LogInfo}}
// @Failure      400         {object}  dto.Response
// @Failure      500         {object}  dto.Response
// @Security     Bearer
// @Router       /api/logs [get]
func (h *LogHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	filter := repository.LogFilter{}
	if uid := c.Query("user_id"); uid != "" {
		id, err := strconv.ParseUint(uid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user_id"})
			return
		}
		filter.UserID = id
	}
	if tid := c.Query("token_id"); tid != "" {
		id, err := strconv.ParseUint(tid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid token_id"})
			return
		}
		filter.TokenID = id
	}
	filter.ModelName = c.Query("model_name")
	filter.Keyword = c.Query("keyword")
	filter.Type = c.Query("type")
	if code := c.Query("status_code"); code != "" {
		v, err := strconv.Atoi(code)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid status_code"})
			return
		}
		filter.StatusCode = v
	}
	if ch := c.Query("channel_id"); ch != "" {
		id, err := strconv.ParseUint(ch, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel_id"})
			return
		}
		filter.ChannelID = id
	}
	filter.IPAddress = c.Query("ip_address")
	filter.StartDate = c.Query("start_date")
	filter.EndDate = c.Query("end_date")

	logs, total, err := h.logService.ListWithFilters(c.Request.Context(), filter, page, pageSize)
	if err != nil {
		slog.Error("list logs failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToLogInfoList(logs),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// ExportCSV 导出消费日志为 CSV
// @Summary      导出消费日志 CSV
// @Description  按筛选条件导出消费日志为 CSV 文件
// @Tags         Logs
// @Accept       json
// @Produce      text/csv
// @Param        user_id     query     int     false  "用户 ID"
// @Param        token_id    query     int     false  "Token ID"
// @Param        model_name  query     string  false  "模型名称"
// @Param        keyword     query     string  false  "关键词搜索"
// @Param        type        query     string  false  "日志类型"
// @Param        status_code query     int     false  "HTTP 状态码"
// @Param        channel_id  query     int     false  "渠道 ID"
// @Param        ip_address  query     string  false  "IP 地址"
// @Param        start_date  query     string  false  "开始日期 YYYY-MM-DD"
// @Param        end_date    query     string  false  "结束日期 YYYY-MM-DD"
// @Success      200         {file}   text/csv
// @Failure      400         {object}  dto.Response
// @Failure      500         {object}  dto.Response
// @Security     Bearer
// @Router       /api/logs/export/csv [get]
func (h *LogHandler) ExportCSV(c *gin.Context) {
	filter := repository.LogFilter{}
	if uid := c.Query("user_id"); uid != "" {
		id, err := strconv.ParseUint(uid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user_id"})
			return
		}
		filter.UserID = id
	}
	if tid := c.Query("token_id"); tid != "" {
		id, err := strconv.ParseUint(tid, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid token_id"})
			return
		}
		filter.TokenID = id
	}
	filter.ModelName = c.Query("model_name")
	filter.Keyword = c.Query("keyword")
	filter.Type = c.Query("type")
	if code := c.Query("status_code"); code != "" {
		v, err := strconv.Atoi(code)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid status_code"})
			return
		}
		filter.StatusCode = v
	}
	if ch := c.Query("channel_id"); ch != "" {
		id, err := strconv.ParseUint(ch, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid channel_id"})
			return
		}
		filter.ChannelID = id
	}
	filter.IPAddress = c.Query("ip_address")
	filter.StartDate = c.Query("start_date")
	filter.EndDate = c.Query("end_date")

	// 取最多 50000 条用于导出
	logs, _, err := h.logService.ListWithFilters(c.Request.Context(), filter, 1, 50000)
	if err != nil {
		slog.Error("export logs CSV failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	filename := fmt.Sprintf("juhe-logs-%s.csv", time.Now().Format("20060102-150405"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	// 写入 UTF-8 BOM 使 Excel 正确识别中文
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	headers := []string{
		"ID", "用户ID", "TokenID", "渠道ID", "模型名称", "请求ID",
		"类型", "模式", "PromptTokens", "CompletionTokens", "TotalTokens",
		"图片数量", "额度消耗(分)", "预扣额度(分)", "状态码", "上游状态",
		"IP地址", "UserAgent", "错误信息", "耗时(ms)", "创建时间",
	}
	writer.Write(headers)

	for _, log := range logs {
		info := service.ToLogInfo(&log)
		row := []string{
			fmt.Sprintf("%d", info.ID),
			fmt.Sprintf("%d", info.UserID),
			formatUint64(info.TokenID),
			formatUint64(info.ChannelID),
			info.ModelName,
			info.RequestID,
			info.Type,
			info.Mode,
			fmt.Sprintf("%d", info.PromptTokens),
			fmt.Sprintf("%d", info.CompletionTokens),
			fmt.Sprintf("%d", info.TotalTokens),
			fmt.Sprintf("%d", info.ImageN),
			fmt.Sprintf("%d", info.QuotaUsed),
			fmt.Sprintf("%d", info.QuotaPreConsumed),
			fmt.Sprintf("%d", info.StatusCode),
			formatStrPtr(info.UpstreamStatus),
			info.IPAddress,
			info.UserAgent,
			info.ErrorMessage,
			fmt.Sprintf("%d", info.UseTimeMs),
			info.CreatedAt.Format("2006-01-02 15:04:05"),
		}
		writer.Write(row)
	}
	writer.Flush()
}

func formatUint64(v *uint64) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%d", *v)
}

func formatStrPtr(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func RegisterLogRoutes(r *gin.RouterGroup, h *LogHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/logs", auth, admin)
	{
		g.GET("", h.List)
		g.GET("/export/csv", h.ExportCSV)
	}
}
