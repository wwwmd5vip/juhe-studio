package handler

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

type ReleaseHandler struct {
	service      *service.ReleaseService
	auditService *service.AuditService
}

func NewReleaseHandler(svc *service.ReleaseService, auditService *service.AuditService) *ReleaseHandler {
	return &ReleaseHandler{service: svc, auditService: auditService}
}

func (h *ReleaseHandler) Create(c *gin.Context) {
	var input dto.CreateReleaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	release, err := h.service.CreateRelease(c.Request.Context(), &input)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	h.auditService.RecordCreate(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetRelease, release.ID, release)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToReleaseInfo(release)})
}

func (h *ReleaseHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	keyword := c.Query("keyword")

	releases, total, err := h.service.ListReleases(c.Request.Context(), page, pageSize, keyword)
	if err != nil {
		slog.Error("list releases failed", "error", err)
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "internal server error"})
		return
	}

	c.JSON(http.StatusOK, dto.Response{
		Code: 0,
		Data: dto.PagedResponse{
			Data: releases,
			Pagination: dto.Pagination{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
			},
		},
	})
}

func (h *ReleaseHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid release id"})
		return
	}

	release, err := h.service.GetRelease(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: service.ToReleaseInfo(release)})
}

func (h *ReleaseHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid release id"})
		return
	}

	var input dto.UpdateReleaseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	oldRelease, getErr := h.service.GetRelease(c.Request.Context(), id)
	if getErr != nil {
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "failed to read release"})
		return
	}

	if err := h.service.UpdateRelease(c.Request.Context(), id, &input); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	newRelease, getErr := h.service.GetRelease(c.Request.Context(), id)
	if getErr != nil {
		newRelease = oldRelease // audit with same old/new if lookup fails after update
	}
	if oldRelease == nil {
		// Should not happen since GetRelease succeeded above, but guard defensively
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: "release not found"})
		return
	}
	if newRelease == nil {
		newRelease = &domain.Release{}
	}
	h.auditService.RecordUpdate(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetRelease, id, oldRelease, newRelease)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}

func (h *ReleaseHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid release id"})
		return
	}

	oldRelease, _ := h.service.GetRelease(c.Request.Context(), id)

	if err := h.service.DeleteRelease(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	if oldRelease == nil {
		oldRelease = &domain.Release{}
	}
	h.auditService.RecordDelete(middleware.CurrentUserID(c), middleware.CurrentUsername(c), domain.AuditTargetRelease, id, oldRelease)

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "deleted"})
}

func (h *ReleaseHandler) Publish(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "invalid release id"})
		return
	}

	if err := h.service.PublishRelease(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}

func (h *ReleaseHandler) GetLatest(c *gin.Context) {
	platform := c.DefaultQuery("platform", "darwin")

	resp, err := h.service.GetLatest(c.Request.Context(), platform)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.Response{Code: 404, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Data: resp})
}

func RegisterReleaseRoutes(r *gin.RouterGroup, h *ReleaseHandler, auth gin.HandlerFunc, admin gin.HandlerFunc) {
	g := r.Group("/releases", auth, admin)
	{
		g.POST("", h.Create)
		g.GET("", h.List)
		g.GET("/:id", h.Get)
		g.PUT("/:id", h.Update)
		g.DELETE("/:id", h.Delete)
		g.POST("/:id/publish", h.Publish)
	}
}
