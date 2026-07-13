package service

import (
	"context"
	"testing"

	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newUserServiceWithDB(t *testing.T) (*UserService, *BillingService, *gorm.DB) {
	db := newTestDB(t)
	billingSvc := NewBillingService(
		db,
		repository.NewPricingRepository(db),
		repository.NewUserRepository(db),
		repository.NewTokenRepository(db),
		repository.NewLogRepository(db),
		repository.NewQuotaTransactionRepository(db),
		nil,
		nil,
		nil,
	)
	userSvc := NewUserService(&config.Config{}, db, repository.NewUserRepository(db), billingSvc)
	return userSvc, billingSvc, db
}

func TestUserService_AdjustQuota_Positive(t *testing.T) {
	userSvc, _, db := newUserServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	updated, err := userSvc.AdjustQuota(ctx, user.ID, 1000, "manual bonus")
	require.NoError(t, err)
	require.NotNil(t, updated)
	require.Equal(t, int64(1000), updated.Quota)

	list, total, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, list, 1)
	require.Equal(t, domain.QuotaTransactionTypeAdjust, list[0].Type)
	require.Equal(t, int64(1000), list[0].Amount)
	require.Equal(t, int64(1000), list[0].BalanceAfter)
	require.NotNil(t, list[0].Description)
	require.Equal(t, "manual bonus", *list[0].Description)
}

func TestUserService_AdjustQuota_Negative(t *testing.T) {
	userSvc, billingSvc, db := newUserServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	require.NoError(t, billingSvc.Recharge(ctx, user.ID, 0, 1000, "adjust", "", "initial"))

	updated, err := userSvc.AdjustQuota(ctx, user.ID, -300, "penalty")
	require.NoError(t, err)
	require.NotNil(t, updated)
	require.Equal(t, int64(700), updated.Quota)

	list, total, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, list, 2)

	var adjustTx *domain.QuotaTransaction
	for i := range list {
		if list[i].Type == domain.QuotaTransactionTypeAdjust {
			adjustTx = &list[i]
			break
		}
	}
	require.NotNil(t, adjustTx)
	require.Equal(t, int64(-300), adjustTx.Amount)
	require.Equal(t, int64(700), adjustTx.BalanceAfter)
	require.NotNil(t, adjustTx.Description)
	require.Equal(t, "penalty", *adjustTx.Description)
}

func TestUserService_AdjustQuota_ZeroAmount(t *testing.T) {
	userSvc, _, _ := newUserServiceWithDB(t)
	ctx := context.Background()

	_, err := userSvc.AdjustQuota(ctx, 1, 0, "")
	require.Error(t, err)
}

func TestUserService_AdjustQuota_UserNotFound(t *testing.T) {
	userSvc, _, _ := newUserServiceWithDB(t)
	ctx := context.Background()

	_, err := userSvc.AdjustQuota(ctx, 9999, 100, "")
	require.ErrorIs(t, err, ErrUserNotFound)
}

func TestUserService_AdjustQuota_InsufficientQuota(t *testing.T) {
	userSvc, _, db := newUserServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	_, err := userSvc.AdjustQuota(ctx, user.ID, -100, "overdraft")
	require.ErrorIs(t, err, ErrInsufficientQuota)
}
