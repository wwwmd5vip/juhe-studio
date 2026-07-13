package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Allow loopback in tests so httptest.NewServer (127.0.0.1) works with validateBaseURL.
func init() { AllowLoopbackForTesting = true }

func newChannelTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Channel{},
		&domain.Ability{},
		&domain.Model{},
	)
	require.NoError(t, err)
	return db
}

func TestChannelService_RecordFailure_AutoBan(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "test",
		Keys:    "key1",
		Models:  "gpt-4",
		BaseURL: "http://example.com",
		AutoBan: true,
	})
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		err = svc.RecordFailure(ctx, channel.ID, "timeout", 3)
		require.NoError(t, err)
	}

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, domain.ChannelError, updated.Status)
}

func TestChannelService_RecordSuccess_ResetsFailures(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "test",
		Keys:    "key1",
		Models:  "gpt-4",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	require.NoError(t, svc.RecordFailure(ctx, channel.ID, "timeout", 10))
	require.NoError(t, svc.RecordSuccess(ctx, channel.ID, 120))

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, 0, updated.ConsecutiveFailures)
	require.Equal(t, 120, updated.ResponseTimeMs)
}

func TestChannelService_FetchUpstreamModels_Success(t *testing.T) {
	db := newChannelTestDB(t)
	require.NoError(t, db.AutoMigrate(&domain.Model{}))
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		require.Equal(t, "Bearer key1", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"object":"list","data":[{"id":"gpt-4o"},{"id":"gpt-4o-mini"},{"id":"gpt-4o"}]}`))
	}))
	defer upstream.Close()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "fetch-test",
		Keys:    "key1",
		Models:  "old-model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	resp, err := svc.FetchUpstreamModels(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, 2, resp.Fetched)
	require.Equal(t, []string{"gpt-4o", "gpt-4o-mini"}, resp.Models)

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, "gpt-4o,gpt-4o-mini", updated.Models)

	abilities, err := repo.FindAbilitiesByGroupAndModel(ctx, "default", "gpt-4o")
	require.NoError(t, err)
	require.Len(t, abilities, 1)
	require.Equal(t, channel.ID, abilities[0].ChannelID)

	m, err := modelRepo.FindByName(ctx, "gpt-4o")
	require.NoError(t, err)
	require.Equal(t, domain.ModelTypeLLM, m.Type)
}

func TestChannelService_FetchUpstreamModels_UnsupportedType(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeJimeng),
		Name:    "jimeng",
		Keys:    "key1",
		Models:  "model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	_, err = svc.FetchUpstreamModels(ctx, channel.ID)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrUnsupportedChannelType)
}

func TestChannelService_FetchUpstreamModels_EmptyBaseURL(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:   string(domain.ChannelTypeOpenAICompatible),
		Name:   "empty-base-url",
		Keys:   "key1",
		Models: "model",
	})
	require.NoError(t, err)

	_, err = svc.FetchUpstreamModels(ctx, channel.ID)
	require.ErrorIs(t, err, ErrChannelBaseURLEmpty)
}

func TestChannelService_FetchUpstreamModels_EmptyKeys(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "empty-keys",
		Keys:    "",
		Models:  "model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	_, err = svc.FetchUpstreamModels(ctx, channel.ID)
	require.ErrorIs(t, err, ErrChannelKeysEmpty)
}

func TestChannelService_FetchUpstreamModels_UpstreamError(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer upstream.Close()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "upstream-error",
		Keys:    "key1",
		Models:  "model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	_, err = svc.FetchUpstreamModels(ctx, channel.ID)
	require.ErrorIs(t, err, ErrUpstreamStatus)
}

func TestChannelService_FetchUpstreamModels_InvalidJSON(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{not valid json`))
	}))
	defer upstream.Close()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "invalid-json",
		Keys:    "key1",
		Models:  "model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	_, err = svc.FetchUpstreamModels(ctx, channel.ID)
	require.ErrorIs(t, err, ErrInvalidUpstreamResponse)
}

func TestChannelService_FetchUpstreamModels_EmptyList(t *testing.T) {
	db := newChannelTestDB(t)
	require.NoError(t, db.AutoMigrate(&domain.Model{}))
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer upstream.Close()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "empty-list",
		Keys:    "key1",
		Models:  "old-model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	resp, err := svc.FetchUpstreamModels(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, 0, resp.Fetched)
	require.Empty(t, resp.Models)

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, "", updated.Models)
}

func TestChannelService_FetchUpstreamModels_WhitespaceKeys(t *testing.T) {
	db := newChannelTestDB(t)
	require.NoError(t, db.AutoMigrate(&domain.Model{}))
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		require.Equal(t, "Bearer key1", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4"}]}`))
	}))
	defer upstream.Close()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "whitespace-keys",
		Keys:    "\n\n  key1  \n\n",
		Models:  "old-model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	resp, err := svc.FetchUpstreamModels(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, 1, resp.Fetched)
	require.Equal(t, []string{"gpt-4"}, resp.Models)

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, "gpt-4", updated.Models)
}

func TestChannelService_PreviewUpstreamModels_Success(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/models", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4o"},{"id":"dall-e-3"}]}`))
	}))
	defer upstream.Close()

	require.NoError(t, modelRepo.Create(ctx, &domain.Model{
		ModelName: "dall-e-3",
		Type:      domain.ModelTypeImage,
		Status:    1,
		MatchRule: domain.ModelMatchExact,
	}))

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "preview-test",
		Keys:    "key1",
		Models:  "old-model",
		BaseURL: upstream.URL,
	})
	require.NoError(t, err)

	resp, err := svc.PreviewUpstreamModels(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, []string{"dall-e-3", "gpt-4o"}, resp.Models)
	require.Equal(t, "image", resp.ExistingTypes["dall-e-3"])
	require.Equal(t, "llm", resp.ExistingTypes["gpt-4o"]) // 新模型自动推断为 llm

	// 预览不应写入 channel.Models
	unchanged, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, "old-model", unchanged.Models)
}

func TestChannelService_PreviewUpstreamModels_UnsupportedType(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeJimeng),
		Name:    "jimeng",
		Keys:    "key1",
		Models:  "model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	_, err = svc.PreviewUpstreamModels(ctx, channel.ID)
	require.ErrorIs(t, err, ErrUnsupportedChannelType)
}

func TestChannelService_SyncUpstreamModels_Success(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "sync-test",
		Keys:    "key1",
		Models:  "old-model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	resp, err := svc.SyncUpstreamModels(ctx, channel.ID, &dto.SyncUpstreamModelsRequest{
		Models: []dto.SyncModelItem{
			{ModelName: "gpt-4o", Type: "llm"},
			{ModelName: "dall-e-3", Type: "image"},
		},
	})
	require.NoError(t, err)
	require.Equal(t, 2, resp.Synced)
	require.Equal(t, []string{"dall-e-3", "gpt-4o"}, resp.Models)

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, "dall-e-3,gpt-4o", updated.Models)

	abilities, err := repo.FindAbilitiesByGroupAndModel(ctx, "default", "dall-e-3")
	require.NoError(t, err)
	require.Len(t, abilities, 1)

	m, err := modelRepo.FindByName(ctx, "dall-e-3")
	require.NoError(t, err)
	require.Equal(t, domain.ModelTypeImage, m.Type)
}

func TestChannelService_SyncUpstreamModels_DuplicateModelName(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "dup-test",
		Keys:    "key1",
		Models:  "model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	_, err = svc.SyncUpstreamModels(ctx, channel.ID, &dto.SyncUpstreamModelsRequest{
		Models: []dto.SyncModelItem{
			{ModelName: "gpt-4o", Type: "llm"},
			{ModelName: "gpt-4o", Type: "image"},
		},
	})
	require.ErrorIs(t, err, ErrDuplicateModelName)
}

func TestChannelService_SyncUpstreamModels_EmptyModelName(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "empty-name-test",
		Keys:    "key1",
		Models:  "model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	_, err = svc.SyncUpstreamModels(ctx, channel.ID, &dto.SyncUpstreamModelsRequest{
		Models: []dto.SyncModelItem{
			{ModelName: "  ", Type: "llm"},
		},
	})
	require.ErrorIs(t, err, ErrEmptyModelName)
}

func TestChannelService_SyncUpstreamModels_UpdatesExistingType(t *testing.T) {
	db := newChannelTestDB(t)
	repo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	svc := NewChannelService(repo, modelRepo, nil, nil)
	ctx := context.Background()

	require.NoError(t, modelRepo.Create(ctx, &domain.Model{
		ModelName: "gpt-4o",
		Type:      domain.ModelTypeLLM,
		Status:    1,
		MatchRule: domain.ModelMatchExact,
	}))

	channel, err := svc.CreateChannel(ctx, &dto.CreateChannelRequest{
		Type:    string(domain.ChannelTypeOpenAICompatible),
		Name:    "update-type-test",
		Keys:    "key1",
		Models:  "model",
		BaseURL: "http://example.com",
	})
	require.NoError(t, err)

	_, err = svc.SyncUpstreamModels(ctx, channel.ID, &dto.SyncUpstreamModelsRequest{
		Models: []dto.SyncModelItem{
			{ModelName: "gpt-4o", Type: "image"},
		},
	})
	require.NoError(t, err)

	m, err := modelRepo.FindByName(ctx, "gpt-4o")
	require.NoError(t, err)
	require.Equal(t, domain.ModelTypeImage, m.Type)
}
