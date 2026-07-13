package admin

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/middleware"
	"github.com/juhe-management/server/internal/relay"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
)

// PlaygroundHandler serves the admin playground proxy endpoint.
// It accepts JWT-authenticated chat requests, looks up the user's first active
// API Key, and forwards the request to the relay service — avoiding the need
// for the frontend to have access to an API Key directly.
type PlaygroundHandler struct {
	relayService *service.RelayService
	settingRepo  *repository.SettingRepository
	userRepo     *repository.UserRepository
	tokenRepo    *repository.TokenRepository
	maxReqBytes  int64
}

func NewPlaygroundHandler(
	relayService *service.RelayService,
	settingRepo *repository.SettingRepository,
	userRepo *repository.UserRepository,
	tokenRepo *repository.TokenRepository,
	cfg *config.Config,
) *PlaygroundHandler {
	return &PlaygroundHandler{
		relayService: relayService,
		settingRepo:  settingRepo,
		userRepo:     userRepo,
		tokenRepo:    tokenRepo,
		maxReqBytes:  cfg.MaxRequestBodyBytes,
	}
}

// getPlaygroundMaxTrials returns the max free trials from settings (default 5).
func (h *PlaygroundHandler) getPlaygroundMaxTrials(ctx context.Context) int {
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

// Chat is the Playground chat proxy endpoint.
//
//	@Summary      Playground 对话代理（JWT 认证）
//	@Description  接受 JWT 认证的 Chat Completions 请求，服务端查找用户 API Key 后转发
//	@Tags         Playground
//	@Accept       json
//	@Produce      json
//	@Param        body  body      object  true  "OpenAI Chat Completions 请求体"
//	@Success      200   {object}  object
//	@Failure      400   {object}  dto.Response
//	@Failure      401   {object}  dto.Response
//	@Security     Bearer
//	@Router       /api/playground/chat [post]
func (h *PlaygroundHandler) Chat(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "未登录"})
		return
	}

	ctx := c.Request.Context()

	// Load full user object
	user, err := h.userRepo.FindByID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, dto.Response{Code: 401, Message: "用户不存在"})
		return
	}

	// Find the user's first active API Key token
	token, err := h.tokenRepo.FindFirstActiveByUserID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "请先创建API Key"})
		return
	}

	// Read request body
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, h.maxReqBytes))
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, dto.Response{Code: 413, Message: "request body too large"})
		return
	}

	// Check playground free trial
	maxTrials := h.getPlaygroundMaxTrials(ctx)
	claimed, claimErr := h.userRepo.ClaimPlaygroundTrial(ctx, userID, maxTrials)
	if claimErr != nil {
		slog.Warn("failed to claim playground trial", "error", claimErr)
	}
	if claimed {
		// Free trial granted (atomically claimed under row lock)
		ctx = context.WithValue(ctx, service.CtxKeyFreeTrial, true)
	} else if user.Quota <= 0 {
		c.JSON(http.StatusPaymentRequired, dto.Response{Code: 402, Message: "免费试用次数已用完，且余额不足。请充值后重试。"})
		return
	}

	resp, _, callErr := h.relayService.ChatCompletions(ctx, token, user, body, c.ClientIP(), c.Request.UserAgent())
	if callErr != nil {
		status := http.StatusInternalServerError
		msg := callErr.Error()
		if callErr == service.ErrModelNotSupported {
			status = http.StatusNotFound
		} else if callErr == service.ErrInsufficientQuota {
			status = http.StatusPaymentRequired
			msg = "额度不足，请充值后重试。"
		} else if callErr == service.ErrStreamNotSupport {
			status = http.StatusBadRequest
		}
		c.JSON(status, dto.Response{Code: status, Message: msg})
		return
	}

	writePlaygroundRelayResponse(c, resp)
}

// RegisterPlaygroundRoutes registers playground proxy routes under /api.
func RegisterPlaygroundRoutes(r *gin.RouterGroup, h *PlaygroundHandler, auth gin.HandlerFunc) {
	g := r.Group("/playground", auth)
	{
		g.POST("/chat", h.Chat)
	}
}

// writePlaygroundRelayResponse writes a relay response back to the client.
// Mirrors relay.RelayHandler.writeRelayResponse but uses dto.Response for errors.
func writePlaygroundRelayResponse(c *gin.Context, resp *relay.RelayResponse) {
	if resp == nil {
		c.JSON(http.StatusInternalServerError, dto.Response{Code: 500, Message: "empty upstream response"})
		return
	}

	if resp.Streaming && resp.StreamHandler != nil {
		_, err := resp.StreamHandler(c.Writer, c.Request)
		if err != nil {
			slog.Error("playground stream error", "error", err)
		}
		return
	}

	contentType := resp.ContentType
	if contentType == "" {
		contentType = "application/json"
	}
	c.DataFromReader(resp.StatusCode, -1, contentType, resp.Body, nil)
}
