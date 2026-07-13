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

type UserHandler struct {
	userService  *service.UserService
	auditService *service.AuditService
}

func NewUserHandler(userService *service.UserService, auditService *service.AuditService) *UserHandler {
	return &UserHandler{userService: userService, auditService: auditService}
}

// Create 创建用户
// @Summary      创建用户
// @Description  管理员创建新用户
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        body  body      dto.CreateUserRequest  true  "用户信息"
// @Success      200   {object}  dto.Response{data=dto.UserInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/users [post]
func (h *UserHandler) Create(c *gin.Context) {
	var req dto.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	role := middleware.CurrentRole(c)
	user, err := h.userService.CreateUser(c.Request.Context(), &req, role)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordCreate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetUser, user.ID, user,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserInfo(user)})
}

// List 用户列表
// @Summary      获取用户列表
// @Description  分页查询用户，支持关键字搜索
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        page       query     int     false  "页码"        default(1)
// @Param        page_size  query     int     false  "每页数量"    default(20)
// @Param        keyword    query     string  false  "搜索关键词"
// @Success      200        {object}  dto.Response{data=dto.PagedResponse{data=[]dto.UserInfo}}
// @Failure      500        {object}  dto.Response
// @Security     Bearer
// @Router       /api/users [get]
func (h *UserHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	keyword := c.Query("keyword")

	users, total, err := h.userService.ListUsers(c.Request.Context(), page, pageSize, keyword)
	if err != nil {
		slog.Error("failed to list users", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: service.UserInfoList(users),
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// Get 获取用户详情
// @Summary      获取用户详情
// @Description  根据 ID 获取单个用户信息
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "用户 ID"
// @Success      200  {object}  dto.Response{data=dto.UserInfo}
// @Failure      400  {object}  dto.Response
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/{id} [get]
func (h *UserHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user id"})
		return
	}

	user, err := h.userService.GetUser(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserInfo(user)})
}

// Update 更新用户
// @Summary      更新用户信息
// @Description  管理员更新用户信息
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        id    path      int                   true  "用户 ID"
// @Param        body  body      dto.UpdateUserRequest  true  "用户信息"
// @Success      200   {object}  dto.Response{data=dto.UserInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/{id} [put]
func (h *UserHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user id"})
		return
	}

	var req dto.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	oldUser, _ := h.userService.GetUser(c.Request.Context(), id)
	user, err := h.userService.UpdateUser(c.Request.Context(), id, &req, middleware.CurrentRole(c))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordUpdate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetUser, id, oldUser, user,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserInfo(user)})
}

// Delete 删除用户
// @Summary      删除用户
// @Description  管理员删除单个用户
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "用户 ID"
// @Success      200  {object}  dto.Response
// @Failure      400  {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/{id} [delete]
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user id"})
		return
	}

	operatorID := middleware.CurrentUserID(c)
	operatorName := middleware.CurrentUsername(c)
	oldUser, _ := h.userService.GetUser(c.Request.Context(), id)
	if err := h.userService.DeleteUser(c.Request.Context(), id, operatorID); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordDelete(operatorID, operatorName, domain.AuditTargetUser, id, oldUser)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

// BatchDelete 批量删除用户
// @Summary      批量删除用户
// @Description  管理员批量删除用户
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        body  body      dto.BatchDeleteUsersRequest  true  "用户 ID 列表"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/batch-delete [post]
func (h *UserHandler) BatchDelete(c *gin.Context) {
	var req dto.BatchDeleteUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	operatorID := middleware.CurrentUserID(c)
	if err := h.userService.BatchDeleteUsers(c.Request.Context(), req.IDs, operatorID); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

// BatchUpdateStatus 批量更新用户状态
// @Summary      批量更新用户状态
// @Description  管理员批量启用/禁用用户
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        body  body      dto.BatchUpdateUserStatusRequest  true  "用户 ID 列表和目标状态"
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/batch-status [post]
func (h *UserHandler) BatchUpdateStatus(c *gin.Context) {
	var req dto.BatchUpdateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if err := h.userService.BatchUpdateUserStatus(c.Request.Context(), req.IDs, req.Status); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "status updated"})
}

// AdjustQuota 调整用户额度
// @Summary      调整用户额度
// @Description  管理员调整用户用量配额
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        id    path      int                     true  "用户 ID"
// @Param        body  body      dto.AdjustQuotaRequest  true  "调整信息"
// @Success      200   {object}  dto.Response{data=dto.UserInfo}
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/{id}/quota [post]
func (h *UserHandler) AdjustQuota(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user id"})
		return
	}

	var req dto.AdjustQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	oldUser, _ := h.userService.GetUser(c.Request.Context(), id)
	user, err := h.userService.AdjustQuota(c.Request.Context(), id, req.Amount, req.Description)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordAdjust(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetUser, id, oldUser, user, req.Amount, req.Description,
	)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserInfo(user)})
}

// SetPassword 管理员重置密码
// @Summary      管理员重置用户密码
// @Description  管理员为指定用户设置新密码
// @Tags         Users
// @Accept       json
// @Produce      json
// @Param        id    path      int     true  "用户 ID"
// @Param        body  body      object{password=string}  true  "新密码"  example({"password":"newpass123"})
// @Success      200   {object}  dto.Response
// @Failure      400   {object}  dto.Response
// @Security     Bearer
// @Router       /api/users/{id}/password [put]
func (h *UserHandler) SetPassword(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid user id"})
		return
	}

	var req struct {
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if err := h.userService.AdminSetPassword(c.Request.Context(), id, req.Password, middleware.CurrentRole(c)); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordUpdate(
		middleware.CurrentUserID(c), middleware.CurrentUsername(c),
		domain.AuditTargetUser, id, nil, map[string]string{"action": "set_password"},
	)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "password updated"})
}

// Me 获取当前用户信息
// @Summary      获取当前登录用户信息
// @Description  返回当前 JWT Token 对应的用户信息
// @Tags         Users
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.Response{data=dto.UserInfo}
// @Failure      404  {object}  dto.Response
// @Security     Bearer
// @Router       /api/auth/me [get]
func (h *UserHandler) Me(c *gin.Context) {
	id := middleware.CurrentUserID(c)
	user, err := h.userService.GetUser(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToUserInfo(user)})
}

func RegisterUserRoutes(r *gin.RouterGroup, h *UserHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	g := r.Group("/users", auth, admin)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
		g.POST("/batch-delete", h.BatchDelete)
		g.POST("/batch-status", h.BatchUpdateStatus)
		g.POST("/:id/quota", h.AdjustQuota)
		g.PUT("/:id/password", h.SetPassword)
	}
}
