package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/service"
)

type VendorHandler struct {
	vendorService *service.VendorService
	auditService  *service.AuditService
}

func NewVendorHandler(vendorService *service.VendorService, auditService *service.AuditService) *VendorHandler {
	return &VendorHandler{vendorService: vendorService, auditService: auditService}
}

// Create 创建厂商
// @Summary      创建模型厂商
// @Tags         Vendors
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateVendorRequest  true  "厂商信息"
// @Success      200   {object}  dto.Response{data=dto.VendorInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/vendors [post]
func (h *VendorHandler) Create(c *gin.Context) {
	var req dto.CreateVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	vendor, err := h.vendorService.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordCreate(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetVendor, vendor.ID, vendor)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToVendorInfo(vendor)})
}

// List 厂商列表
// @Summary      获取厂商列表
// @Tags         Vendors
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Param        keyword    query     string  false  "搜索关键词"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.VendorInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/vendors [get]
func (h *VendorHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	keyword := c.Query("keyword")

	vendors, total, err := h.vendorService.List(c.Request.Context(), page, pageSize, keyword)
	if err != nil {
		slog.Error("failed to list vendors", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: service.VendorInfoList(vendors),
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// Get 厂商详情
// @Summary      获取厂商详情
// @Tags         Vendors
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "厂商 ID"
// @Success      200  {object}  dto.Response{data=dto.VendorInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/vendors/{id} [get]
func (h *VendorHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid vendor id"})
		return
	}

	vendor, err := h.vendorService.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToVendorInfo(vendor)})
}

// Update 更新厂商
// @Summary      更新厂商信息
// @Tags         Vendors
// @Accept       json
// @Produce      json
// @Param        id    path      int                     true  "厂商 ID"
// @Param        body  body      dto.UpdateVendorRequest  true  "厂商信息"
// @Success      200   {object}  dto.Response{data=dto.VendorInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/vendors/{id} [put]
func (h *VendorHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid vendor id"})
		return
	}

	var req dto.UpdateVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	oldVendor, _ := h.vendorService.Get(c.Request.Context(), id)

	vendor, err := h.vendorService.Update(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordUpdate(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetVendor, id, oldVendor, vendor)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToVendorInfo(vendor)})
}

// Delete 删除厂商
// @Summary      删除厂商
// @Tags         Vendors
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "厂商 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/vendors/{id} [delete]
func (h *VendorHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid vendor id"})
		return
	}

	oldVendor, _ := h.vendorService.Get(c.Request.Context(), id)

	if err := h.vendorService.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordDelete(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetVendor, id, oldVendor)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

func RegisterVendorRoutes(r *gin.RouterGroup, h *VendorHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	g := r.Group("/vendors", auth, admin)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
	}
}
