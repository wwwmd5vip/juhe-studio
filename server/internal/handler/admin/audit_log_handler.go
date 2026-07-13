package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type AdminAuditHandler struct {
	auditLogService *service.AdminAuditLogService
}

func NewAdminAuditHandler(auditLogService *service.AdminAuditLogService) *AdminAuditHandler {
	return &AdminAuditHandler{auditLogService: auditLogService}
}

// List 审计日志列表
// @Summary      获取管理操作审计日志
// @Tags         AuditLogs
// @Accept       json
// @Produce      json
// @Param        page          query     int     false  "页码"          default(1)
// @Param        page_size     query     int     false  "每页数量"      default(20)
// @Param        operator_id   query     int     false  "操作人 ID"
// @Param        operator_name query     string  false  "操作人用户名"
// @Param        action        query     string  false  "操作类型"
// @Param        target_type   query     string  false  "目标类型"
// @Param        start_date    query     string  false  "开始日期 YYYY-MM-DD"
// @Param        end_date      query     string  false  "结束日期 YYYY-MM-DD"
// @Success      200           {object}  dto.Response{data=dto.PagedResponse}
// @Failure      500           {object}  dto.Response
// @Security     Bearer
// @Router       /api/audit-logs [get]
func (h *AdminAuditHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 { page = 1 }
	if pageSize < 1 || pageSize > 100 { pageSize = 20 }
	operatorID, _ := strconv.ParseUint(c.Query("operator_id"), 10, 64)
	operatorName := c.Query("operator_name")
	action := c.Query("action")
	targetType := c.Query("target_type")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	list, total, err := h.auditLogService.List(c.Request.Context(), page, pageSize, operatorID, operatorName, action, targetType, startDate, endDate)
	if err != nil {
		slog.Error("list audit logs failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data:       list,
			Pagination: buildPagination(page, pageSize, total),
		},
	})
}

func RegisterAuditLogRoutes(r *gin.RouterGroup, h *AdminAuditHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	r.GET("/audit-logs", auth, admin, h.List)
}
