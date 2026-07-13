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

type TokenHandler struct {
	tokenService *service.TokenService
	auditService *service.AuditService
}

func NewTokenHandler(tokenService *service.TokenService, auditService *service.AuditService) *TokenHandler {
	return &TokenHandler{tokenService: tokenService, auditService: auditService}
}

// Create 创建 API Key
func (h *TokenHandler) Create(c *gin.Context) {
	var req dto.CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	userID := middleware.CurrentUserID(c)
	token, fullKey, err := h.tokenService.CreateToken(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	info := service.ToTokenInfo(token)
	info.Key = fullKey

	h.auditService.RecordCreate(userID, middleware.CurrentUsername(c),
		domain.AuditTargetToken, token.ID, token,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: info})
}

// List Token 列表
func (h *TokenHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	keyword := c.Query("keyword")
	showAll := c.Query("all") == "true"

	userID := middleware.CurrentUserID(c)
	isAdmin := middleware.CurrentRole(c) >= 10

	if showAll && isAdmin {
		userID = 0
	}
	tokens, total, err := h.tokenService.ListTokens(c.Request.Context(), userID, keyword, page, pageSize)
	if err != nil {
		slog.Error("failed to list tokens", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: service.TokenInfoList(tokens),
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

// Get Token 详情
func (h *TokenHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid token id"})
		return
	}

	userID := middleware.CurrentUserID(c)
	isAdmin := middleware.CurrentRole(c) >= 10

	token, err := h.tokenService.GetToken(c.Request.Context(), userID, id, isAdmin)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTokenInfo(token)})
}

// Update 更新 API Key
func (h *TokenHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid token id"})
		return
	}

	var req dto.UpdateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	userID := middleware.CurrentUserID(c)
	isAdmin := middleware.CurrentRole(c) >= 10

	oldToken, _ := h.tokenService.GetToken(c.Request.Context(), userID, id, isAdmin)
	token, err := h.tokenService.UpdateToken(c.Request.Context(), userID, id, &req, isAdmin)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordUpdate(userID, middleware.CurrentUsername(c),
		domain.AuditTargetToken, id, oldToken, token,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToTokenInfo(token)})
}

// Delete 删除 API Key
func (h *TokenHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid token id"})
		return
	}

	userID := middleware.CurrentUserID(c)
	isAdmin := middleware.CurrentRole(c) >= 10

	oldToken, _ := h.tokenService.GetToken(c.Request.Context(), userID, id, isAdmin)
	if err := h.tokenService.DeleteToken(c.Request.Context(), userID, id, isAdmin); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordDelete(userID, middleware.CurrentUsername(c),
		domain.AuditTargetToken, id, oldToken,
	)
	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

// BatchDelete 批量删除 Token
func (h *TokenHandler) BatchDelete(c *gin.Context) {
	var req dto.BatchDeleteTokensRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	userID := middleware.CurrentUserID(c)
	isAdmin := middleware.CurrentRole(c) >= 10

	if err := h.tokenService.BatchDeleteTokens(c.Request.Context(), userID, req.IDs, isAdmin); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

// Stats 获取 Token 用量统计
func (h *TokenHandler) Stats(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid token id"})
		return
	}

	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days < 1 {
		days = 1
	}
	if days > 365 {
		days = 365
	}

	userID := middleware.CurrentUserID(c)
	isAdmin := middleware.CurrentRole(c) >= 10

	if _, err := h.tokenService.GetToken(c.Request.Context(), userID, id, isAdmin); err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	stats, err := h.tokenService.GetTokenStats(c.Request.Context(), id, days)
	if err != nil {
		slog.Error("failed to get token stats", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	if stats == nil {
		stats = []service.TokenDailyStat{}
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: stats})
}

func RegisterTokenRoutes(r *gin.RouterGroup, h *TokenHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	// User-scoped token routes (no admin required)
	g := r.Group("/tokens", auth)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.GET("/:id/stats", h.Stats)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
	}
	// Batch-delete requires admin
	if admin != nil {
		r.Group("/tokens", auth, admin).POST("/batch-delete", h.BatchDelete)
	} else {
		g.POST("/batch-delete", h.BatchDelete)
	}
}
