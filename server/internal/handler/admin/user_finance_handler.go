package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type UserFinanceHandler struct {
	financeService *service.UserFinanceService
}

func NewUserFinanceHandler(financeService *service.UserFinanceService) *UserFinanceHandler {
	return &UserFinanceHandler{financeService: financeService}
}

// GetFinance 获取用户财务概览
// @Summary      获取用户财务概览
// @Description  获取单个用户的额度、消费、订阅等财务信息汇总
// @Tags         UserFinance
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "用户 ID"
// @Success      200  {object}  dto.Response{data=dto.UserFinanceData}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/{id}/finance [get]
func (h *UserFinanceHandler) GetFinance(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user id"})
		return
	}

	data, err := h.financeService.GetUserFinance(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: data})
}

func RegisterUserFinanceRoutes(r *gin.RouterGroup, h *UserFinanceHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	r.GET("/users/:id/finance", auth, admin, h.GetFinance)
}
