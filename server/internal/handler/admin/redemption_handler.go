package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type RedemptionHandler struct {
	redemptionService *service.RedemptionService
}

func NewRedemptionHandler(redemptionService *service.RedemptionService) *RedemptionHandler {
	return &RedemptionHandler{redemptionService: redemptionService}
}

// Generate 生成兑换码
// @Summary      批量生成兑换码
// @Tags         Redemptions
// @Accept       json
// @Produce      json
// @Param        body  body      dto.GenerateRedemptionCodesRequest  true  "生成配置"
// @Success      200   {object}  dto.Response{data=[]dto.RedemptionInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/redemptions [post]
func (h *RedemptionHandler) Generate(c *gin.Context) {
	var req dto.GenerateRedemptionCodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	codes, err := h.redemptionService.GenerateCodes(c.Request.Context(), &req, 0)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToRedemptionInfoList(codes)})
}

// List 兑换码列表
// @Summary      获取兑换码列表
// @Tags         Redemptions
// @Accept       json
// @Produce      json
// @Param        page       query     int  false  "页码"      default(1)
// @Param        page_size  query     int  false  "每页数量"  default(20)
// @Param        status     query     int  false  "状态筛选"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.RedemptionInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/redemptions [get]
func (h *RedemptionHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	var status *int
	if s := c.Query("status"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			status = &v
		}
	}
	codes, total, err := h.redemptionService.List(c.Request.Context(), status, page, pageSize)
	if err != nil {
		slog.Error("failed to list redemptions", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: dto.PagedResponse{
		Data:       service.ToRedemptionInfoList(codes),
		Pagination: buildPagination(page, pageSize, total),
	}})
}

// Delete 删除兑换码
// @Summary      删除未使用的兑换码
// @Tags         Redemptions
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "兑换码 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/redemptions/{id} [delete]
func (h *RedemptionHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid redemption id"})
		return
	}
	if err := h.redemptionService.DeleteUnused(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

func RegisterRedemptionRoutes(r *gin.RouterGroup, h *RedemptionHandler, auth, admin gin.HandlerFunc) {
	g := r.Group("/redemptions", auth, admin)
	{
		g.POST("", h.Generate)
		g.GET("", h.List)
		g.DELETE("/:id", h.Delete)
	}
}
