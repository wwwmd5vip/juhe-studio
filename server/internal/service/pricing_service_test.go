package service

import (
	"context"
	"testing"

	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
)

func newPricingServiceWithDB(t *testing.T) (*PricingService, *repository.PricingRepository) {
	db := newTestDB(t)
	repo := repository.NewPricingRepository(db)
	svc := NewPricingService(repo)
	return svc, repo
}

func TestBatchUpsertPricing_Create(t *testing.T) {
	svc, repo := newPricingServiceWithDB(t)
	ctx := context.Background()

	model := "batch-create-model"
	items := []dto.CreatePricingRequest{
		{ModelName: model, Group: "default", BillingMode: "token", ModelRatio: 1.0, CompletionRatio: 2.0},
		{ModelName: model, Group: "vip", BillingMode: "token", ModelRatio: 0.8, CompletionRatio: 1.6},
	}

	n, err := svc.BatchUpsertPricing(ctx, model, items, false)
	require.NoError(t, err)
	require.Equal(t, int64(2), n)

	p1, err := repo.FindByModelAndGroup(ctx, model, "default")
	require.NoError(t, err)
	require.Equal(t, 2.0, p1.CompletionRatio)

	p2, err := repo.FindByModelAndGroup(ctx, model, "vip")
	require.NoError(t, err)
	require.Equal(t, 1.6, p2.CompletionRatio)
}

func TestBatchUpsertPricing_Overwrite(t *testing.T) {
	svc, repo := newPricingServiceWithDB(t)
	ctx := context.Background()

	model := "batch-overwrite-model"

	// Create initial pricing
	items := []dto.CreatePricingRequest{
		{ModelName: model, Group: "default", BillingMode: "token", ModelRatio: 1.0, CompletionRatio: 2.0},
	}
	n, err := svc.BatchUpsertPricing(ctx, model, items, false)
	require.NoError(t, err)
	require.Equal(t, int64(1), n)

	// Verify initial values
	p1, err := repo.FindByModelAndGroup(ctx, model, "default")
	require.NoError(t, err)
	require.Equal(t, 2.0, p1.CompletionRatio)

	// Now upsert with overwrite=true and different ratio
	items2 := []dto.CreatePricingRequest{
		{ModelName: model, Group: "default", BillingMode: "token", ModelRatio: 1.5, CompletionRatio: 3.0},
	}
	n2, err := svc.BatchUpsertPricing(ctx, model, items2, true)
	require.NoError(t, err)
	require.Equal(t, int64(1), n2)

	p2, err := repo.FindByModelAndGroup(ctx, model, "default")
	require.NoError(t, err)
	require.Equal(t, 1.5, p2.ModelRatio)
	require.Equal(t, 3.0, p2.CompletionRatio)
}

func TestBatchUpsertPricing_SkipExisting(t *testing.T) {
	svc, repo := newPricingServiceWithDB(t)
	ctx := context.Background()

	model := "batch-skip-model"

	// Create initial pricing
	items := []dto.CreatePricingRequest{
		{ModelName: model, Group: "default", BillingMode: "token", ModelRatio: 1.0, CompletionRatio: 2.0},
	}
	n, err := svc.BatchUpsertPricing(ctx, model, items, false)
	require.NoError(t, err)
	require.Equal(t, int64(1), n)

	// Verify initial values
	p1, err := repo.FindByModelAndGroup(ctx, model, "default")
	require.NoError(t, err)
	require.Equal(t, 2.0, p1.CompletionRatio)

	// Now upsert with overwrite=false and different ratio — should skip
	items2 := []dto.CreatePricingRequest{
		{ModelName: model, Group: "default", BillingMode: "token", ModelRatio: 1.5, CompletionRatio: 3.0},
	}
	n2, err := svc.BatchUpsertPricing(ctx, model, items2, false)
	require.NoError(t, err)
	require.Equal(t, int64(0), n2)

	// Verify values unchanged
	p2, err := repo.FindByModelAndGroup(ctx, model, "default")
	require.NoError(t, err)
	require.Equal(t, 1.0, p2.ModelRatio)
	require.Equal(t, 2.0, p2.CompletionRatio)
}

func TestBatchUpsertPricing_EmptyModelName(t *testing.T) {
	svc, _ := newPricingServiceWithDB(t)
	_, err := svc.BatchUpsertPricing(context.Background(), "", nil, false)
	require.Error(t, err)
}

func TestBatchUpsertPricing_EmptyItems(t *testing.T) {
	svc, _ := newPricingServiceWithDB(t)
	_, err := svc.BatchUpsertPricing(context.Background(), "gpt-4", nil, false)
	require.Error(t, err)
}

func TestBatchUpsertPricing_EmptyGroupDefaults(t *testing.T) {
	svc, repo := newPricingServiceWithDB(t)
	ctx := context.Background()

	model := "batch-emptygroup-model"

	items := []dto.CreatePricingRequest{
		{ModelName: model, Group: "", BillingMode: "token", ModelRatio: 1.5, CompletionRatio: 1.0},
	}
	n, err := svc.BatchUpsertPricing(ctx, model, items, false)
	require.NoError(t, err)
	require.Equal(t, int64(1), n)

	// Verify stored as "default" group
	p, err := repo.FindByModelAndGroup(ctx, model, "default")
	require.NoError(t, err)
	require.Equal(t, 1.5, p.ModelRatio)
	require.Equal(t, "default", p.Group)
}
