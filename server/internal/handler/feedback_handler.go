package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

type FeedbackHandler struct {
	service *service.FeedbackService
}

func NewFeedbackHandler(svc *service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{service: svc}
}

func (h *FeedbackHandler) Submit(c *gin.Context) {
	var input dto.SubmitFeedbackInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	ip := c.ClientIP()
	userAgent := c.Request.UserAgent()

	if err := h.service.Submit(c.Request.Context(), &input, ip, userAgent); err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.Response{Code: 0, Message: "ok"})
}
