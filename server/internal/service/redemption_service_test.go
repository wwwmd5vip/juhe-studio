package service

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newRedemptionTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared&_txlock=immediate&_busy_timeout=5000"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Log{},
		&domain.Pricing{},
		&domain.QuotaTransaction{},
		&domain.Redemption{},
	)
	require.NoError(t, err)
	return db
}

func newRedemptionServiceWithDB(t *testing.T) (*RedemptionService, *BillingService, *gorm.DB) {
	db := newRedemptionTestDB(t)
	billingService := NewBillingService(
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
	redemptionService := NewRedemptionService(
		db,
		repository.NewRedemptionRepository(db),
		billingService,
	)
	return redemptionService, billingService, db
}

func TestRedemptionService_Redeem_Success(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      1,
		QuotaValue: 1000,
	}, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)

	rd, err := svc.Redeem(ctx, user.ID, codes[0].Code)
	require.NoError(t, err)
	require.NotNil(t, rd)
	require.Equal(t, domain.RedemptionUsed, rd.Status)
	require.NotNil(t, rd.UsedBy)
	require.Equal(t, user.ID, *rd.UsedBy)
	require.NotNil(t, rd.UsedAt)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(1000), updatedUser.Quota)

	transactions, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, transactions, 1)
	require.Equal(t, domain.QuotaTransactionTypeRecharge, transactions[0].Type)
	require.Equal(t, int64(1000), transactions[0].Amount)
	require.Equal(t, int64(1000), transactions[0].BalanceAfter)
	require.NotNil(t, transactions[0].RelatedType)
	require.Equal(t, "redemption", *transactions[0].RelatedType)
	require.NotNil(t, transactions[0].RelatedID)
	require.Equal(t, "redemption code", *transactions[0].Description)
}

func TestRedemptionService_Redeem_UsedCode(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      1,
		QuotaValue: 500,
	}, 0)
	require.NoError(t, err)

	_, err = svc.Redeem(ctx, user.ID, codes[0].Code)
	require.NoError(t, err)

	_, err = svc.Redeem(ctx, user.ID, codes[0].Code)
	require.ErrorIs(t, err, ErrRedemptionUsed)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(500), updatedUser.Quota)
}

func TestRedemptionService_Redeem_ExpiredCode(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	past := time.Now().Add(-time.Hour)
	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      1,
		QuotaValue: 500,
		ExpiresAt:  &past,
	}, 0)
	require.NoError(t, err)

	_, err = svc.Redeem(ctx, user.ID, codes[0].Code)
	require.ErrorIs(t, err, ErrRedemptionExpired)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedUser.Quota)
}

func TestRedemptionService_GenerateCodes_Count(t *testing.T) {
	svc, _, _ := newRedemptionServiceWithDB(t)
	ctx := context.Background()

	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      5,
		QuotaValue: 100,
		Prefix:     "TEST",
	}, 0)
	require.NoError(t, err)
	require.Len(t, codes, 5)

	seen := make(map[string]struct{}, len(codes))
	for _, rd := range codes {
		require.NotEmpty(t, rd.Code)
		require.Equal(t, int64(100), rd.QuotaValue)
		_, exists := seen[rd.Code]
		require.False(t, exists, "duplicate code generated: %s", rd.Code)
		seen[rd.Code] = struct{}{}
	}
}

func TestRedemptionService_Redeem_NotFound(t *testing.T) {
	svc, _, _ := newRedemptionServiceWithDB(t)
	ctx := context.Background()
	user := createTestUser(t, svc.db)

	_, err := svc.Redeem(ctx, user.ID, "")
	require.ErrorIs(t, err, ErrRedemptionNotFound)

	_, err = svc.Redeem(ctx, user.ID, "   ")
	require.ErrorIs(t, err, ErrRedemptionNotFound)

	_, err = svc.Redeem(ctx, user.ID, "NON-EXISTENT-CODE")
	require.ErrorIs(t, err, ErrRedemptionNotFound)
}

func TestRedemptionService_DeleteUnused_Success(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()

	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      1,
		QuotaValue: 1000,
	}, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)

	err = svc.DeleteUnused(ctx, codes[0].ID)
	require.NoError(t, err)

	_, err = repository.NewRedemptionRepository(db).FindByID(ctx, codes[0].ID)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestRedemptionService_DeleteUnused_Used(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()
	user := createTestUser(t, db)

	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      1,
		QuotaValue: 1000,
	}, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)

	_, err = svc.Redeem(ctx, user.ID, codes[0].Code)
	require.NoError(t, err)

	err = svc.DeleteUnused(ctx, codes[0].ID)
	require.ErrorIs(t, err, ErrRedemptionUsed)
}

func TestRedemptionService_List_StatusAndPagination(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()
	user := createTestUser(t, db)

	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      3,
		QuotaValue: 100,
	}, 0)
	require.NoError(t, err)
	require.Len(t, codes, 3)

	_, err = svc.Redeem(ctx, user.ID, codes[0].Code)
	require.NoError(t, err)

	unused := int(domain.RedemptionUnused)
	used := int(domain.RedemptionUsed)

	unusedList, total, err := svc.List(ctx, &unused, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, unusedList, 2)
	for _, rd := range unusedList {
		require.Equal(t, domain.RedemptionUnused, rd.Status)
	}

	usedList, total, err := svc.List(ctx, &used, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, usedList, 1)
	require.Equal(t, domain.RedemptionUsed, usedList[0].Status)

	paged, total, err := svc.List(ctx, nil, 1, 2)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, paged, 2)
}

func TestRedemptionService_Redeem_Concurrent(t *testing.T) {
	svc, _, db := newRedemptionServiceWithDB(t)
	ctx := context.Background()

	codes, err := svc.GenerateCodes(ctx, &dto.GenerateRedemptionCodesRequest{
		Count:      1,
		QuotaValue: 1000,
	}, 0)
	require.NoError(t, err)
	require.Len(t, codes, 1)

	userA := createTestUser(t, db)
	userB := createTestUser(t, db)

	var wg sync.WaitGroup
	wg.Add(2)

	results := make(chan error, 2)
	var mu sync.Mutex
	var successUserID uint64

	redeem := func(userID uint64) {
		defer wg.Done()
		_, err := svc.Redeem(ctx, userID, codes[0].Code)
		if err == nil {
			mu.Lock()
			successUserID = userID
			mu.Unlock()
		}
		results <- err
	}

	go redeem(userA.ID)
	go redeem(userB.ID)
	wg.Wait()
	close(results)

	successCount := 0
	usedCount := 0
	for err := range results {
		if err == nil {
			successCount++
			continue
		}
		if strings.Contains(err.Error(), ErrRedemptionUsed.Error()) {
			usedCount++
			continue
		}
		t.Fatalf("unexpected error: %v", err)
	}

	require.Equal(t, 1, successCount, "exactly one redeem should succeed")
	require.Equal(t, 1, usedCount, "exactly one redeem should fail with ErrRedemptionUsed")

	userAUpdated, err := repository.NewUserRepository(db).FindByID(ctx, userA.ID)
	require.NoError(t, err)
	userBUpdated, err := repository.NewUserRepository(db).FindByID(ctx, userB.ID)
	require.NoError(t, err)

	if successUserID == userA.ID {
		require.Equal(t, int64(1000), userAUpdated.Quota)
		require.Equal(t, int64(0), userBUpdated.Quota)
	} else {
		require.Equal(t, int64(0), userAUpdated.Quota)
		require.Equal(t, int64(1000), userBUpdated.Quota)
	}

	transactions, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, successUserID, 1, 10)
	require.NoError(t, err)
	require.Len(t, transactions, 1)
	require.Equal(t, int64(1000), transactions[0].Amount)
}
