package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/service"
)

// SensitiveWordFilter returns a middleware that checks request body content against
// the sensitive word list from settings. The maxBodyBytes parameter comes from the
// server config (MAX_REQUEST_BODY_BYTES env var), NOT the settings DB value
// (max_request_body_mb) that the relay handler uses — this is intentional:
// the filter enforces a hard limit at the env level, while the handler can
// apply a larger or smaller limit from settings on a per-route basis.
func SensitiveWordFilter(svc *service.SensitiveWordService, maxBodyBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		if !svc.IsEnabled(ctx) {
			c.Next()
			return
		}

		body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBodyBytes))
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "failed to read request body"})
			c.Abort()
			return
		}
		// If body was truncated (equals the limit), filter is unreliable at this size.
		// Treat as potentially sensitive to prevent bypass via oversized body.
		if int64(len(body)) >= maxBodyBytes {
			c.JSON(http.StatusRequestEntityTooLarge, dto.Response{Code: 413, Message: "request body too large for content filtering"})
			c.Abort()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		text := extractTextForFilter(c.Request.URL.Path, body)
		if text == "" {
			c.Next()
			return
		}

		blocked, _ := svc.Check(ctx, text)
		if blocked {
			c.JSON(http.StatusBadRequest, dto.Response{Code: 400, Message: "request contains sensitive content"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func extractTextForFilter(path string, body []byte) string {
	// Strip query parameters to prevent bypass via ?foo=bar
	if idx := strings.Index(path, "?"); idx >= 0 {
		path = path[:idx]
	}
	switch path {
	case "/v1/chat/completions":
		var req dto.ChatCompletionRequest
		if err := json.Unmarshal(body, &req); err != nil {
			return ""
		}
		var sb bytes.Buffer
		for _, m := range req.Messages {
			sb.WriteString(m.Content)
			sb.WriteString(" ")
		}
		return sb.String()
	case "/v1/images/generations":
		var req dto.ImageGenerationRequest
		if err := json.Unmarshal(body, &req); err != nil {
			return ""
		}
		return req.Prompt
	default:
		return ""
	}
}
