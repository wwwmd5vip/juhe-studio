package service

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/relay"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
)

func TestRelayService_streamChatResponse_AccumulatesUsage(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	require.NoError(t, svc.Recharge(ctx, user.ID, 0, 10000, "adjust", "", ""))
	token := createTestToken(t, db, user.ID, false, 10000)

	pricing := &domain.Pricing{
		ModelRatio:      1,
		CompletionRatio: 1,
	}

	info := &relay.RelayInfo{
		UserID:    user.ID,
		TokenID:   &token.ID,
		ModelName: "gpt-4",
		Channel:   &domain.Channel{ID: 1},
	}

	bodyContent := `data: {"id":"chat-1","object":"chat.completion.chunk","choices":[{"delta":{"content":"hello"}}]}

:
data: {"choices":[{"delta":{"content":" world"}}], "usage":null}

data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]

`
	body := io.NopCloser(bytes.NewReader([]byte(bodyContent)))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	rs := &RelayService{billing: svc}
	usage, err := rs.streamChatResponse(ctx, w, r, body, info, pricing, 100, []byte(`{}`), "req-stream-1")
	require.NoError(t, err)
	require.Equal(t, 10, usage.PromptTokens)
	require.Equal(t, 5, usage.CompletionTokens)
	require.Equal(t, 15, usage.TotalTokens)

	resp := w.Result()
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, "text/event-stream; charset=utf-8", resp.Header.Get("Content-Type"))

	respBody, _ := io.ReadAll(resp.Body)
	require.Contains(t, string(respBody), "data: [DONE]")

	updatedUser, err := svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(10099), updatedUser.Quota)

	logs, _, err := repository.NewLogRepository(db).List(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, domain.LogModeStream, logs[0].Mode)
	require.Equal(t, 10, logs[0].PromptTokens)
	require.Equal(t, 5, logs[0].CompletionTokens)
}
