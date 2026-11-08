package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBillingService_CalculateRerankCost(t *testing.T) {
	svc, _ := newBillingServiceWithDB(t)

	// nil pricing
	assert.Equal(t, int64(0), svc.CalculateRerankCost(nil, 1000))

	// token-based pricing
	pricing := &domain.Pricing{
		ModelRatio: 2.0,
	}
	// 1000 tokens * 2.0 / 1000.0 = 2 cents
	assert.Equal(t, int64(2), svc.CalculateRerankCost(pricing, 1000))

	// fixed-price pricing
	fixedPrice := int64(15)
	fixedPricing := &domain.Pricing{
		ModelRatio:      1.5,
		FixedPriceCents: &fixedPrice,
	}
	// 15 * 1.5 = 22.5 => ceil => 23
	assert.Equal(t, int64(23), svc.CalculateRerankCost(fixedPricing, 1000))
}

func TestRelayService_Rerank(t *testing.T) {
	db := newTestDB(t)
	require.NoError(t, db.AutoMigrate(&domain.Channel{}, &domain.Ability{}, &domain.Model{}))
	ctx := context.Background()

	// Upstream test server simulating a rerank endpoint
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/rerank", r.URL.Path)
		assert.Equal(t, http.MethodPost, r.Method)

		resp := dto.RerankResponse{
			ID: "rerank-test-123",
			Results: []dto.RerankResultItem{
				{
					Index:          1,
					RelevanceScore: 0.95,
					Document:       &dto.RerankDocumentItem{Text: "doc 2"},
				},
				{
					Index:          0,
					RelevanceScore: 0.35,
					Document:       &dto.RerankDocumentItem{Text: "doc 1"},
				},
			},
			Usage: &dto.RerankUsage{
				TotalTokens: 42,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}))
	defer mockServer.Close()

	// 1. Create channel
	ch := &domain.Channel{
		Type:           domain.ChannelTypeOpenAICompatible,
		Name:           "test-rerank-channel",
		BaseURL:        &mockServer.URL,
		Keys:           "test-key",
		Models:         "bge-reranker-large",
		Groups:         "default",
		Status:         1,
		TimeoutSeconds: 5,
	}
	require.NoError(t, db.Create(ch).Error)

	// Ability for dispatcher
	ab := &domain.Ability{
		Group:     "default",
		ModelName: "bge-reranker-large",
		ChannelID: ch.ID,
		Priority:  1,
		Weight:    10,
		Enabled:   true,
	}
	require.NoError(t, db.Create(ab).Error)

	// Pricing
	pricing := &domain.Pricing{
		ModelName:  "bge-reranker-large",
		Group:      "default",
		ModelRatio: 1.0,
	}
	require.NoError(t, db.Create(pricing).Error)

	user := createTestUser(t, db)
	user.Quota = 1000
	require.NoError(t, db.Save(user).Error)

	token := createTestToken(t, db, user.ID, false, 1000)
	token.Group = "default"
	require.NoError(t, db.Save(token).Error)

	pricingRepo := repository.NewPricingRepository(db)
	userRepo := repository.NewUserRepository(db)
	tokenRepo := repository.NewTokenRepository(db)
	logRepo := repository.NewLogRepository(db)
	channelRepo := repository.NewChannelRepository(db)
	modelRepo := repository.NewModelRepository(db)
	txRepo := repository.NewQuotaTransactionRepository(db)
	billRepo := repository.NewDailyBillRepository(db)

	billingSvc := NewBillingService(db, pricingRepo, userRepo, tokenRepo, logRepo, txRepo, billRepo, nil, nil)
	dispatcher := relay.NewDispatcher(channelRepo)
	relaySvc := NewRelayService(dispatcher, billingSvc, channelRepo, pricingRepo, modelRepo, nil, 1, 3)

	req := dto.RerankRequest{
		Model:     "bge-reranker-large",
		Query:     "what is deep learning?",
		Documents: []string{"doc 1", "doc 2"},
	}
	reqBytes, err := json.Marshal(req)
	require.NoError(t, err)

	resp, logEntry, err := relaySvc.Rerank(ctx, token, user, reqBytes, "127.0.0.1", "test-agent")
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	require.NotNil(t, logEntry)
	assert.Equal(t, domain.LogTypeRerank, logEntry.Type)
	assert.Equal(t, "bge-reranker-large", logEntry.ModelName)
}
