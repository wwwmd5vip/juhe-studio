package relay

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/relay"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

type RelayHandler struct {
	relayService *service.RelayService
	settingRepo  *repository.SettingRepository
	userRepo     *repository.UserRepository
	maxReqBytes  int64
}

func NewRelayHandler(relayService *service.RelayService, settingRepo *repository.SettingRepository, userRepo *repository.UserRepository, cfg *config.Config) *RelayHandler {
	return &RelayHandler{relayService: relayService, settingRepo: settingRepo, userRepo: userRepo, maxReqBytes: cfg.MaxRequestBodyBytes}
}

// getPlaygroundMaxTrials returns the max free trials from settings (default 5)
func (h *RelayHandler) getPlaygroundMaxTrials(ctx context.Context) int {
	if h.settingRepo == nil {
		return 5
	}
	s, err := h.settingRepo.FindByKey(ctx, "PLAYGROUND_FREE_TRIALS")
	if err != nil || s == nil {
		return 5
	}
	val := 0
	fmt.Sscanf(s.Value, "%d", &val)
	if val <= 0 {
		val = 5
	}
	return val
}

// getMaxRequestBody returns the max request body bytes from the settings DB
// (key: max_request_body_mb). Falls back to the env-configured h.maxReqBytes
// (MAX_REQUEST_BODY_BYTES) when the setting is absent. Note that the sensitive
// word middleware uses only the env value (cfg.MaxRequestBodyBytes) — a
// deliberate separation: the middleware enforces a hard system-level cap,
// while this handler-level limit may differ via admin-configurable settings.
func (h *RelayHandler) getMaxRequestBody(ctx context.Context) int64 {
	if h.settingRepo == nil {
		return h.maxReqBytes
	}
	s, err := h.settingRepo.FindByKey(ctx, "max_request_body_mb")
	if err != nil || s == nil {
		return h.maxReqBytes
	}
	var val int64
	fmt.Sscanf(s.Value, "%d", &val)
	if val <= 0 {
		return h.maxReqBytes
	}
	return val * 1024 * 1024
}

// ListModels 获取可用模型列表
// @Summary      获取可用模型列表（OpenAI 兼容）
// @Description  返回当前 API Key 分组下可用的模型列表
// @Tags         Relay
// @Accept       json
// @Produce      json
// @Success      200  {object}  dto.OpenAIModelList
// @Failure      401  {object}  dto.OpenAIErrorResponse
// @Failure      500  {object}  dto.OpenAIErrorResponse
// @Security     ApiKeyAuth
// @Router       /v1/models [get]
func (h *RelayHandler) ListModels(c *gin.Context) {
	token := middleware.CurrentToken(c)
	if token == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, openAIError("invalid api key"))
		return
	}

	group := token.Group
	if group == "" {
		group = "default"
	}

	models, err := h.relayService.ListModels(c.Request.Context(), group)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, openAIError("internal error"))
		return
	}

	c.JSON(http.StatusOK, dto.OpenAIModelList{
		Object: "list",
		Data:   models,
	})
}

// ChatCompletions 对话补全
// @Summary      对话补全（OpenAI 兼容）
// @Description  支持流式和非流式的 Chat Completions 请求
// @Tags         Relay
// @Accept       json
// @Produce      json
// @Param        body  body      object  true  "OpenAI Chat Completions 请求体"
// @Success      200   {object}  object
// @Failure      400   {object}  dto.OpenAIErrorResponse
// @Failure      401   {object}  dto.OpenAIErrorResponse
// @Failure      404   {object}  dto.OpenAIErrorResponse
// @Failure      413   {object}  dto.OpenAIErrorResponse
// @Security     ApiKeyAuth
// @Router       /v1/chat/completions [post]
func (h *RelayHandler) ChatCompletions(c *gin.Context) {
	token, user := h.currentTokenAndUser(c)
	if token == nil {
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, h.getMaxRequestBody(c.Request.Context())))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, openAIError("request body too large"))
		return
	}

	// Check playground free trial
	ctx := c.Request.Context()
	if c.GetHeader("X-Playground-Trial") == "true" && user != nil {
		maxTrials := h.getPlaygroundMaxTrials(ctx)
		claimed, err := h.userRepo.ClaimPlaygroundTrial(ctx, user.ID, maxTrials)
		if err != nil {
			slog.Warn("failed to claim playground trial", "error", err)
		}
		if claimed {
			// Free trial granted (atomically claimed under row lock)
			ctx = context.WithValue(ctx, service.CtxKeyFreeTrial, true)
		} else if userRepo := h.userRepo; userRepo != nil {
			// Re-read user quota after failed claim (quota may have changed)
			updated, _ := userRepo.FindByID(ctx, user.ID)
			if updated != nil {
				user = updated
			}
			if user.Quota <= 0 {
				c.AbortWithStatusJSON(http.StatusPaymentRequired, openAIError("免费试用次数已用完，且余额不足。请充值后重试。"))
				return
			}
		}
	}

	resp, _, callErr := h.relayService.ChatCompletions(ctx, token, user, body, c.ClientIP(), c.Request.UserAgent())
	if callErr != nil {
		status := http.StatusInternalServerError
		if callErr == service.ErrStreamNotSupport {
			status = http.StatusBadRequest
		} else if callErr == service.ErrModelNotSupported {
			status = http.StatusNotFound
		} else if callErr == service.ErrInsufficientQuota {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, openAIError("额度不足，请充值后重试。"))
			return
		} else if errors.Is(callErr, relay.ErrNoAvailableChannel) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, openAIError("service temporarily unavailable, please retry later"))
			return
		}
		slog.Error("relay internal error", "error", sanitizeError(callErr))
		c.AbortWithStatusJSON(status, openAIError("internal error"))
		return
	}

	h.writeRelayResponse(c, resp)
}

// ImageGenerations 图像生成
// @Summary      图像生成（OpenAI 兼容）
// @Tags         Relay
// @Accept       json
// @Produce      json
// @Param        body  body      object  true  "OpenAI Image Generations 请求体"
// @Success      200   {object}  object
// @Failure      401   {object}  dto.OpenAIErrorResponse
// @Failure      404   {object}  dto.OpenAIErrorResponse
// @Security     ApiKeyAuth
// @Router       /v1/images/generations [post]
func (h *RelayHandler) ImageGenerations(c *gin.Context) {
	token, user := h.currentTokenAndUser(c)
	if token == nil {
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, h.getMaxRequestBody(c.Request.Context())))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, openAIError("request body too large"))
		return
	}

	resp, _, err := h.relayService.ImageGenerations(c.Request.Context(), token, user, body, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrModelNotSupported {
			status = http.StatusNotFound
		} else if err == service.ErrInsufficientQuota {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, openAIError("额度不足，请充值后重试。"))
			return
		} else if errors.Is(err, relay.ErrNoAvailableChannel) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, openAIError("service temporarily unavailable, please retry later"))
			return
		}
		slog.Error("relay internal error", "error", sanitizeError(err))
		c.AbortWithStatusJSON(status, openAIError("internal error"))
		return
	}

	h.writeRelayResponse(c, resp)
}

// Embeddings 文本嵌入
// @Summary      文本嵌入（OpenAI 兼容）
// @Tags         Relay
// @Accept       json
// @Produce      json
// @Param        body  body      object  true  "OpenAI Embeddings 请求体"
// @Success      200   {object}  object
// @Failure      401   {object}  dto.OpenAIErrorResponse
// @Failure      404   {object}  dto.OpenAIErrorResponse
// @Security     ApiKeyAuth
// @Router       /v1/embeddings [post]
func (h *RelayHandler) Embeddings(c *gin.Context) {
	token, user := h.currentTokenAndUser(c)
	if token == nil {
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, h.getMaxRequestBody(c.Request.Context())))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, openAIError("request body too large"))
		return
	}

	resp, _, err := h.relayService.Embeddings(c.Request.Context(), token, user, body, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrModelNotSupported {
			status = http.StatusNotFound
		} else if err == service.ErrInsufficientQuota {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, openAIError("额度不足，请充值后重试。"))
			return
		} else if errors.Is(err, relay.ErrNoAvailableChannel) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, openAIError("service temporarily unavailable, please retry later"))
			return
		}
		slog.Error("relay internal error", "error", sanitizeError(err))
		c.AbortWithStatusJSON(status, openAIError("internal error"))
		return
	}

	h.writeRelayResponse(c, resp)
}

// AudioSpeech 语音合成
// @Summary      语音合成（OpenAI 兼容）
// @Tags         Relay
// @Accept       json
// @Produce      json
// @Param        body  body      object  true  "OpenAI Audio Speech 请求体"
// @Success      200   {object}  object
// @Failure      401   {object}  dto.OpenAIErrorResponse
// @Failure      404   {object}  dto.OpenAIErrorResponse
// @Security     ApiKeyAuth
// @Router       /v1/audio/speech [post]
func (h *RelayHandler) AudioSpeech(c *gin.Context) {
	token, user := h.currentTokenAndUser(c)
	if token == nil {
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, h.getMaxRequestBody(c.Request.Context())))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, openAIError("request body too large"))
		return
	}

	resp, _, err := h.relayService.AudioSpeech(c.Request.Context(), token, user, body, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrModelNotSupported {
			status = http.StatusNotFound
		} else if err == service.ErrInsufficientQuota {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, openAIError("额度不足，请充值后重试。"))
			return
		} else if errors.Is(err, relay.ErrNoAvailableChannel) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, openAIError("service temporarily unavailable, please retry later"))
			return
		}
		slog.Error("relay internal error", "error", sanitizeError(err))
		c.AbortWithStatusJSON(status, openAIError("internal error"))
		return
	}

	h.writeRelayResponse(c, resp)
}

// AudioTranscriptions 语音转文字
// @Summary      语音转文字（OpenAI 兼容）
// @Tags         Relay
// @Accept       multipart/form-data
// @Produce      json
// @Param        body  body      object  true  "multipart/form-data 请求体"
// @Success      200   {object}  object
// @Failure      401   {object}  dto.OpenAIErrorResponse
// @Failure      404   {object}  dto.OpenAIErrorResponse
// @Security     ApiKeyAuth
// @Router       /v1/audio/transcriptions [post]
func (h *RelayHandler) AudioTranscriptions(c *gin.Context) {
	token, user := h.currentTokenAndUser(c)
	if token == nil {
		return
	}

	contentType := c.GetHeader("Content-Type")
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, h.getMaxRequestBody(c.Request.Context())))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, openAIError("request body too large"))
		return
	}

	resp, _, err := h.relayService.AudioTranscriptions(c.Request.Context(), token, user, body, contentType, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusInternalServerError
		if err == service.ErrModelNotSupported {
			status = http.StatusNotFound
		} else if err == service.ErrInsufficientQuota {
			c.AbortWithStatusJSON(http.StatusPaymentRequired, openAIError("额度不足，请充值后重试。"))
			return
		} else if errors.Is(err, relay.ErrNoAvailableChannel) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, openAIError("service temporarily unavailable, please retry later"))
			return
		}
		slog.Error("relay internal error", "error", sanitizeError(err))
		c.AbortWithStatusJSON(status, openAIError("internal error"))
		return
	}

	h.writeRelayResponse(c, resp)
}

func (h *RelayHandler) currentTokenAndUser(c *gin.Context) (*domain.Token, *domain.User) {
	token := middleware.CurrentToken(c)
	if token == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, openAIError("invalid api key"))
		return nil, nil
	}

	user := middleware.CurrentUser(c)
	if user == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, openAIError("invalid api key"))
		return nil, nil
	}

	return token, user
}

func (h *RelayHandler) writeRelayResponse(c *gin.Context, resp *relay.RelayResponse) {
	if resp == nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, openAIError("empty upstream response"))
		return
	}

	if resp.Streaming && resp.StreamHandler != nil {
		_, err := resp.StreamHandler(c.Writer, c.Request)
		if err != nil {
			slog.Error("stream error", "error", sanitizeError(err))
		}
		return
	}

	contentType := resp.ContentType
	if contentType == "" {
		contentType = "application/json"
	}
	c.DataFromReader(resp.StatusCode, -1, contentType, resp.Body, nil)
}

func openAIError(message string) dto.OpenAIErrorResponse {
	return dto.OpenAIErrorResponse{
		Error: dto.OpenAIError{
			Message: message,
			Type:    "juhe_error",
			Code:    "internal_error",
		},
	}
}

// sanitizeError truncates error messages to prevent sensitive data
// (e.g., API keys, request bodies from upstream errors) from being
// logged in plaintext. Messages longer than 200 characters are cut.
func sanitizeError(err error) string {
	msg := err.Error()
	if len(msg) > 200 {
		msg = msg[:200] + "..."
	}
	return msg
}
