package admin

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Allow loopback in tests so httptest.NewServer (127.0.0.1) works with validateBaseURL.
func init() { service.AllowLoopbackForTesting = true }

func newHandlerTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.User{}, &domain.Channel{}, &domain.Ability{}, &domain.Model{}))
	return db
}

func decodeTestResponse(t *testing.T, body *httptest.ResponseRecorder) dto.Response {
	t.Helper()
	var resp dto.Response
	require.NoError(t, json.NewDecoder(body.Body).Decode(&resp))
	return resp
}

func TestChannelHandler_FetchModels_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newHandlerTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := service.NewChannelService(repo, modelRepo, nil, nil)
	handler := NewChannelHandler(svc, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/channels/1/fetch-models", nil)
	c.Params = gin.Params{{Key: "id", Value: "invalid"}}
	handler.FetchModels(c)
	require.Equal(t, http.StatusBadRequest, w.Code)

	resp := decodeTestResponse(t, w)
	require.Equal(t, 400, resp.Code)
	require.Equal(t, "invalid channel id", resp.Message)
}

func TestChannelHandler_FetchModels_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newHandlerTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := service.NewChannelService(repo, modelRepo, nil, nil)
	handler := NewChannelHandler(svc, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/channels/999999/fetch-models", nil)
	c.Params = gin.Params{{Key: "id", Value: "999999"}}
	handler.FetchModels(c)
	require.Equal(t, http.StatusNotFound, w.Code)

	resp := decodeTestResponse(t, w)
	require.Equal(t, http.StatusNotFound, resp.Code)
	require.Equal(t, "channel not found", resp.Message)
}

func TestChannelHandler_FetchModels_UpstreamError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer upstream.Close()

	db := newHandlerTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := service.NewChannelService(repo, modelRepo, nil, nil)
	handler := NewChannelHandler(svc, nil, nil)

	ctx := context.Background()
	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "upstream-error",
		Keys:    "key1",
		Models:  "x",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	idStr := strconv.FormatUint(channel.ID, 10)
	c.Request = httptest.NewRequest(http.MethodPost, "/channels/"+idStr+"/fetch-models", nil)
	c.Params = gin.Params{{Key: "id", Value: idStr}}
	handler.FetchModels(c)
	require.Equal(t, http.StatusBadGateway, w.Code)

	resp := decodeTestResponse(t, w)
	require.Equal(t, http.StatusBadGateway, resp.Code)
	require.Contains(t, resp.Message, "upstream returned")
}

func TestChannelHandler_FetchModels_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		require.Equal(t, "Bearer key1", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(dto.OpenAIModelList{
			Object: "list",
			Data: []dto.OpenAIModel{
				{ID: "gpt-4o", Object: "model", Created: 1, OwnedBy: "test"},
				{ID: "gpt-4o-mini", Object: "model", Created: 2, OwnedBy: "test"},
			},
		})
	}))
	defer upstream.Close()

	db := newHandlerTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := service.NewChannelService(repo, modelRepo, nil, nil)
	handler := NewChannelHandler(svc, nil, nil)

	ctx := context.Background()
	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "upstream-success",
		Keys:    "key1",
		Models:  "old-model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	idStr := strconv.FormatUint(channel.ID, 10)
	c.Request = httptest.NewRequest(http.MethodPost, "/channels/"+idStr+"/fetch-models", nil)
	c.Params = gin.Params{{Key: "id", Value: idStr}}
	handler.FetchModels(c)
	require.Equal(t, http.StatusOK, w.Code)

	resp := decodeTestResponse(t, w)
	require.Equal(t, 0, resp.Code)

	dataJSON, err := json.Marshal(resp.Data)
	require.NoError(t, err)
	var data dto.FetchUpstreamModelsResponse
	require.NoError(t, json.Unmarshal(dataJSON, &data))
	require.Equal(t, 2, data.Fetched)
	require.ElementsMatch(t, []string{"gpt-4o", "gpt-4o-mini"}, data.Models)
}

func TestChannelHandler_PreviewModels_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o"}]}`))
	}))
	defer upstream.Close()

	db := newHandlerTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := service.NewChannelService(repo, modelRepo, nil, nil)
	handler := NewChannelHandler(svc, nil, nil)

	ctx := context.Background()
	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "preview-success",
		Keys:    "key1",
		Models:  "x",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	idStr := strconv.FormatUint(channel.ID, 10)
	c.Request = httptest.NewRequest(http.MethodPost, "/channels/"+idStr+"/preview-models", nil)
	c.Params = gin.Params{{Key: "id", Value: idStr}}
	handler.PreviewModels(c)
	require.Equal(t, http.StatusOK, w.Code)

	resp := decodeTestResponse(t, w)
	require.Equal(t, 0, resp.Code)
}

func TestChannelHandler_SyncModels_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := newHandlerTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := service.NewChannelService(repo, modelRepo, nil, nil)
	handler := NewChannelHandler(svc, nil, nil)

	ctx := context.Background()
	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "sync-success",
		Keys:    "key1",
		Models:  "x",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	body := `{"models":[{"model_name":"gpt-4o","type":"llm"}]}`
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	idStr := strconv.FormatUint(channel.ID, 10)
	c.Request = httptest.NewRequest(http.MethodPost, "/channels/"+idStr+"/sync-models", nil)
	c.Request.Body = io.NopCloser(strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: idStr}}
	handler.SyncModels(c)
	require.Equal(t, http.StatusOK, w.Code)

	resp := decodeTestResponse(t, w)
	require.Equal(t, 0, resp.Code)
}
