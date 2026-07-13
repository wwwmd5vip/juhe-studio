package admin

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type QuotaPackageHandler struct {
	packageService *service.QuotaPackageService
	auditService   *service.AuditService
}

func NewQuotaPackageHandler(packageService *service.QuotaPackageService, auditService *service.AuditService) *QuotaPackageHandler {
	return &QuotaPackageHandler{packageService: packageService, auditService: auditService}
}

// Create 创建额度包
// @Summary      创建额度包
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateQuotaPackageRequest  true  "额度包信息"
// @Success      200   {object}  dto.Response{data=dto.QuotaPackageInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages [post]
func (h *QuotaPackageHandler) Create(c *gin.Context) {
	var req dto.CreateQuotaPackageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	pkg, err := h.packageService.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToQuotaPackageInfo(pkg)})
}

// List 额度包列表
// @Summary      获取额度包列表
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Param        keyword    query     string  false  "搜索关键词"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.QuotaPackageInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages [get]
func (h *QuotaPackageHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	keyword := c.Query("keyword")
	list, total, err := h.packageService.List(c.Request.Context(), page, pageSize, false, keyword)
	if err != nil {
		slog.Error("list quota packages failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToQuotaPackageInfoList(list),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// Get 额度包详情
// @Summary      获取额度包详情
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "额度包 ID"
// @Success      200  {object}  dto.Response{data=dto.QuotaPackageInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages/{id} [get]
func (h *QuotaPackageHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid quota package id"})
		return
	}
	pkg, err := h.packageService.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrQuotaPackageNotFound) {
			c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
			return
		}
		slog.Error("get quota package failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToQuotaPackageInfo(pkg)})
}

// Update 更新额度包
// @Summary      更新额度包
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        id    path      int                          true  "额度包 ID"
// @Param        body  body      dto.UpdateQuotaPackageRequest true  "额度包信息"
// @Success      200   {object}  dto.Response{data=dto.QuotaPackageInfo}
// @Failure      400   {object}  dto.Response
// @Failure      404   {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages/{id} [put]
func (h *QuotaPackageHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid quota package id"})
		return
	}
	var req dto.UpdateQuotaPackageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	pkg, err := h.packageService.Update(c.Request.Context(), id, &req)
	if err != nil {
		if errors.Is(err, service.ErrQuotaPackageNotFound) {
			c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToQuotaPackageInfo(pkg)})
}

// Delete 删除额度包
// @Summary      删除额度包
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "额度包 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages/{id} [delete]
func (h *QuotaPackageHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid quota package id"})
		return
	}
	if err := h.packageService.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

type BatchUpdateQuotaPackageStatusRequest struct {
	IDs    []uint64 `json:"ids" binding:"required,min=1"`
	Status int      `json:"status" binding:"required,oneof=0 1"`
}

// BatchUpdateStatus 批量更新额度包状态
// @Summary      批量更新额度包状态
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        body  body      BatchUpdateQuotaPackageStatusRequest  true  "批量状态更新"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages/batch-status [post]
func (h *QuotaPackageHandler) BatchUpdateStatus(c *gin.Context) {
	var req BatchUpdateQuotaPackageStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if err := h.packageService.BatchUpdateStatus(c.Request.Context(), req.IDs, req.Status); err != nil {
		slog.Error("batch update quota package status failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}

type BatchDeleteRequest struct {
	IDs []uint64 `json:"ids" binding:"required,min=1"`
}

// BatchDelete 批量删除额度包
// @Summary      批量删除额度包
// @Tags         QuotaPackages
// @Accept       json
// @Produce      json
// @Param        body  body      BatchDeleteRequest  true  "额度包 ID 列表"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Failure      500   {object}  dto.Response
// @Security     Bearer
// @Router       /api/quota-packages/batch-delete [post]
func (h *QuotaPackageHandler) BatchDelete(c *gin.Context) {
	var req BatchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	if err := h.packageService.BatchDelete(c.Request.Context(), req.IDs); err != nil {
		slog.Error("batch delete quota packages failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

func RegisterQuotaPackageRoutes(r *gin.RouterGroup, h *QuotaPackageHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/quota-packages", auth, admin)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
		g.POST("/batch-status", h.BatchUpdateStatus)
		g.POST("/batch-delete", h.BatchDelete)
	}
}
