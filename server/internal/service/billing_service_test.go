package service

import (
	"context"
	"testing"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Log{},
		&domain.Pricing{},
		&domain.QuotaTransaction{},
		&domain.DailyBill{},
	)
	require.NoError(t, err)
	return db
}

func createTestUser(t *testing.T, db *gorm.DB) *domain.User {
	ctx := context.Background()
	user := &domain.User{
		Username:     "test-" + time.Now().Format("150405.000000"),
		PasswordHash: "hash",
		Quota:        0,
	}
	require.NoError(t, repository.NewUserRepository(db).Create(ctx, user))
	return user
}

func createTestToken(t *testing.T, db *gorm.DB, userID uint64, unlimited bool, quota int64) *domain.Token {
	ctx := context.Background()
	token := &domain.Token{
		UserID:         userID,
		Name:           "test-token",
		KeyHash:        "hash-" + time.Now().Format("150405.000000"),
		KeyMask:        "mask",
		RemainQuota:    quota,
		UnlimitedQuota: unlimited,
	}
	require.NoError(t, repository.NewTokenRepository(db).Create(ctx, token))
	return token
}

func newBillingServiceWithDB(t *testing.T) (*BillingService, *gorm.DB) {
	db := newTestDB(t)
	svc := NewBillingService(
		db,
		repository.NewPricingRepository(db),
		repository.NewUserRepository(db),
		repository.NewTokenRepository(db),
		repository.NewLogRepository(db),
		repository.NewQuotaTransactionRepository(db),
		repository.NewDailyBillRepository(db),
		nil,
		nil,
	)
	return svc, db
}

func TestBillingService_Recharge(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	err := svc.Recharge(ctx, user.ID, 0, 1000, "adjust", "", "manual adjustment")
	require.NoError(t, err)

	updated, err := svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(1000), updated.Quota)

	qtxRepo := repository.NewQuotaTransactionRepository(db)
	list, total, err := qtxRepo.ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, list, 1)
	require.Equal(t, domain.QuotaTransactionTypeRecharge, list[0].Type)
	require.Equal(t, int64(1000), list[0].Amount)
	require.Equal(t, int64(1000), list[0].BalanceAfter)
	require.NotNil(t, list[0].Description)
	require.Equal(t, "manual adjustment", *list[0].Description)
	require.Equal(t, "adjust", *list[0].RelatedType)
}

func TestBillingService_Recharge_WithToken(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	token := createTestToken(t, db, user.ID, false, 100)

	err := svc.Recharge(ctx, user.ID, token.ID, 500, "topup", "order-123", "")
	require.NoError(t, err)

	updatedUser, err := svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(500), updatedUser.Quota)

	updatedToken, err := svc.tokenRepo.FindByID(ctx, token.ID)
	require.NoError(t, err)
	require.Equal(t, int64(600), updatedToken.RemainQuota)

	list, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.NotNil(t, list[0].TokenID)
	require.Equal(t, token.ID, *list[0].TokenID)
	require.Equal(t, "topup", *list[0].RelatedType)
	require.Equal(t, "order-123", *list[0].RelatedID)
}

func TestBillingService_Recharge_WithUnlimitedToken(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	token := createTestToken(t, db, user.ID, true, 0)

	err := svc.Recharge(ctx, user.ID, token.ID, 500, "", "", "")
	require.NoError(t, err)

	updatedToken, err := svc.tokenRepo.FindByID(ctx, token.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedToken.RemainQuota)
	require.True(t, updatedToken.UnlimitedQuota)
}

func TestBillingService_Recharge_InvalidAmount(t *testing.T) {
	svc, _ := newBillingServiceWithDB(t)
	ctx := context.Background()

	err := svc.Recharge(ctx, 1, 0, 0, "", "", "")
	require.ErrorIs(t, err, ErrInvalidAmount)

	err = svc.Recharge(ctx, 1, 0, -10, "", "", "")
	require.ErrorIs(t, err, ErrInvalidAmount)
}

func TestBillingService_RecordConsume_DoesNotChangeBalance(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	require.NoError(t, svc.Recharge(ctx, user.ID, 0, 1000, "adjust", "", ""))

	// manually deduct to simulate PreConsume
	updated, err := svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	updated.Quota -= 300
	require.NoError(t, db.Save(updated).Error)

	err = svc.RecordConsume(ctx, user.ID, 0, 300, 1)
	require.NoError(t, err)

	updated, err = svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(700), updated.Quota)

	list, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, list, 2)

	var consumeTx *domain.QuotaTransaction
	for i := range list {
		if list[i].Type == domain.QuotaTransactionTypeConsume {
			consumeTx = &list[i]
			break
		}
	}
	require.NotNil(t, consumeTx)
	require.Equal(t, int64(-300), consumeTx.Amount)
	require.Equal(t, int64(700), consumeTx.BalanceAfter)
	require.NotNil(t, consumeTx.RelatedType)
	require.Equal(t, "log", *consumeTx.RelatedType)
	require.NotNil(t, consumeTx.RelatedID)
	require.Equal(t, "1", *consumeTx.RelatedID)
}

func TestBillingService_RecordConsume_ZeroAmount(t *testing.T) {
	svc, _ := newBillingServiceWithDB(t)
	ctx := context.Background()

	err := svc.RecordConsume(ctx, 1, 0, 0, 1)
	require.NoError(t, err)

	err = svc.RecordConsume(ctx, 1, 0, -5, 1)
	require.NoError(t, err)
}

func TestBillingService_RecordRefund_DoesNotChangeBalance(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	require.NoError(t, svc.Recharge(ctx, user.ID, 0, 1000, "adjust", "", ""))

	// manually deduct to simulate PreConsume
	updated, err := svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	updated.Quota -= 300
	require.NoError(t, db.Save(updated).Error)

	err = svc.RecordRefund(ctx, user.ID, 0, 300, 2)
	require.NoError(t, err)

	updated, err = svc.userRepo.FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(700), updated.Quota)

	list, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, list, 2)

	var refundTx *domain.QuotaTransaction
	for i := range list {
		if list[i].Type == domain.QuotaTransactionTypeRefund {
			refundTx = &list[i]
			break
		}
	}
	require.NotNil(t, refundTx)
	require.Equal(t, int64(300), refundTx.Amount)
	require.Equal(t, int64(700), refundTx.BalanceAfter)
	require.NotNil(t, refundTx.RelatedType)
	require.Equal(t, "log", *refundTx.RelatedType)
	require.NotNil(t, refundTx.RelatedID)
	require.Equal(t, "2", *refundTx.RelatedID)
}

func TestBillingService_RecordRefund_ZeroAmount(t *testing.T) {
	svc, _ := newBillingServiceWithDB(t)
	ctx := context.Background()

	err := svc.RecordRefund(ctx, 1, 0, 0, 1)
	require.NoError(t, err)

	err = svc.RecordRefund(ctx, 1, 0, -5, 1)
	require.NoError(t, err)
}

func TestBillingService_CreateLog_ReturnsID(t *testing.T) {
	svc, _ := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, svc.db)
	logRecord := &domain.Log{
		UserID:     user.ID,
		RequestID:  "req-1",
		Type:       domain.LogTypeChat,
		Mode:       domain.LogModeNonStream,
		StatusCode: 200,
	}

	logID, err := svc.CreateLog(ctx, logRecord)
	require.NoError(t, err)
	require.Greater(t, logID, uint64(0))
	require.Equal(t, logID, logRecord.ID)
}

func TestBillingService_ListTransactions_AfterRecharge(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	require.NoError(t, svc.Recharge(ctx, user.ID, 0, 1000, "adjust", "", "manual adjustment"))

	list, total, err := svc.ListTransactions(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, list, 1)
	require.Equal(t, user.ID, list[0].UserID)
	require.Equal(t, domain.QuotaTransactionTypeRecharge, list[0].Type)
	require.Equal(t, int64(1000), list[0].Amount)
	require.Equal(t, int64(1000), list[0].BalanceAfter)
}

func TestBillingService_ListTransactions_IsolatedByUser(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	userA := createTestUser(t, db)
	userB := createTestUser(t, db)
	require.NoError(t, svc.Recharge(ctx, userA.ID, 0, 1000, "adjust", "", "user a"))
	require.NoError(t, svc.Recharge(ctx, userB.ID, 0, 500, "adjust", "", "user b"))

	listA, totalA, err := svc.ListTransactions(ctx, userA.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), totalA)
	require.Len(t, listA, 1)
	require.Equal(t, int64(1000), listA[0].Amount)

	listB, totalB, err := svc.ListTransactions(ctx, userB.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), totalB)
	require.Len(t, listB, 1)
	require.Equal(t, int64(500), listB[0].Amount)
}

func createTestLogAt(t *testing.T, db *gorm.DB, userID uint64, modelName string, totalTokens int, quotaUsed int64, createdAt time.Time) *domain.Log {
	ctx := context.Background()
	logRecord := &domain.Log{
		UserID:      userID,
		RequestID:   "req-" + time.Now().Format("150405.000000000"),
		ModelName:   modelName,
		Type:        domain.LogTypeChat,
		Mode:        domain.LogModeNonStream,
		TotalTokens: totalTokens,
		QuotaUsed:   quotaUsed,
		StatusCode:  200,
		CreatedAt:   createdAt,
	}
	require.NoError(t, repository.NewLogRepository(db).Create(ctx, logRecord))
	return logRecord
}

func createTestRechargeAt(t *testing.T, db *gorm.DB, userID uint64, amount int64, createdAt time.Time) *domain.QuotaTransaction {
	ctx := context.Background()
	tx := &domain.QuotaTransaction{
		UserID:       userID,
		Type:         domain.QuotaTransactionTypeRecharge,
		Amount:       amount,
		BalanceAfter: amount,
		CreatedAt:    createdAt,
	}
	require.NoError(t, repository.NewQuotaTransactionRepository(db).Create(ctx, db, tx))
	return tx
}

func TestBillingService_AggregateDailyBill(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	date := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)

	createTestLogAt(t, db, user.ID, "gpt-4", 100, 50, date.Add(time.Hour))
	createTestLogAt(t, db, user.ID, "gpt-4", 200, 80, date.Add(2 * time.Hour))
	createTestLogAt(t, db, user.ID, "gpt-3.5", 50, 10, date.Add(3 * time.Hour))
	createTestRechargeAt(t, db, user.ID, 1000, date.Add(4 * time.Hour))

	err := svc.AggregateDailyBill(ctx, date)
	require.NoError(t, err)

	bills, total, err := svc.ListDailyBills(ctx, user.ID, date, date.Add(24*time.Hour), 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, bills, 3)

	var gpt4Bill, gpt35Bill, rechargeBill *domain.DailyBill
	for i := range bills {
		if bills[i].ModelName == "gpt-4" {
			gpt4Bill = &bills[i]
		} else if bills[i].ModelName == "gpt-3.5" {
			gpt35Bill = &bills[i]
		} else if bills[i].ModelName == "" {
			rechargeBill = &bills[i]
		}
	}

	require.NotNil(t, gpt4Bill)
	require.Equal(t, 2, gpt4Bill.RequestCount)
	require.Equal(t, 300, gpt4Bill.TokenCount)
	require.Equal(t, int64(130), gpt4Bill.QuotaConsumed)
	require.Equal(t, int64(0), gpt4Bill.QuotaRecharged)

	require.NotNil(t, gpt35Bill)
	require.Equal(t, 1, gpt35Bill.RequestCount)
	require.Equal(t, 50, gpt35Bill.TokenCount)
	require.Equal(t, int64(10), gpt35Bill.QuotaConsumed)
	require.Equal(t, int64(0), gpt35Bill.QuotaRecharged)

	require.NotNil(t, rechargeBill)
	require.Equal(t, int64(1000), rechargeBill.QuotaRecharged)
}

func TestBillingService_AggregateDailyBill_Idempotent(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)
	date := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)

	createTestLogAt(t, db, user.ID, "gpt-4", 100, 50, date.Add(time.Hour))
	createTestRechargeAt(t, db, user.ID, 1000, date.Add(2 * time.Hour))

	err := svc.AggregateDailyBill(ctx, date)
	require.NoError(t, err)

	err = svc.AggregateDailyBill(ctx, date)
	require.NoError(t, err)

	bills, total, err := svc.ListDailyBills(ctx, user.ID, date, date.Add(24*time.Hour), 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, bills, 2)

	var consumeBill, rechargeBill *domain.DailyBill
	for i := range bills {
		if bills[i].ModelName == "gpt-4" {
			consumeBill = &bills[i]
		} else if bills[i].ModelName == "" {
			rechargeBill = &bills[i]
		}
	}

	require.NotNil(t, consumeBill)
	require.Equal(t, 1, consumeBill.RequestCount)
	require.Equal(t, int64(50), consumeBill.QuotaConsumed)
	require.Equal(t, int64(0), consumeBill.QuotaRecharged)

	require.NotNil(t, rechargeBill)
	require.Equal(t, int64(1000), rechargeBill.QuotaRecharged)
}

func TestBillingService_ListMonthlyBills(t *testing.T) {
	svc, db := newBillingServiceWithDB(t)
	ctx := context.Background()

	user := createTestUser(t, db)

	june1 := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	june2 := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	july1 := time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC)

	createTestLogAt(t, db, user.ID, "gpt-4", 100, 50, june1.Add(time.Hour))
	createTestLogAt(t, db, user.ID, "gpt-4", 200, 80, june2.Add(time.Hour))
	createTestRechargeAt(t, db, user.ID, 500, june2.Add(2*time.Hour))
	createTestLogAt(t, db, user.ID, "gpt-3.5", 300, 40, july1.Add(time.Hour))

	require.NoError(t, svc.AggregateDailyBill(ctx, june1))
	require.NoError(t, svc.AggregateDailyBill(ctx, june2))
	require.NoError(t, svc.AggregateDailyBill(ctx, july1))

	result, total, err := svc.ListMonthlyBills(ctx, user.ID, "2026-06", "2026-07", 1, 20)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, result, 2)

	require.Equal(t, "2026-06", result[0].Month)
	require.Equal(t, 2, result[0].RequestCount)
	require.Equal(t, 300, result[0].TokenCount)
	require.Equal(t, int64(130), result[0].QuotaConsumed)
	require.Equal(t, int64(500), result[0].QuotaRecharged)

	require.Equal(t, "2026-07", result[1].Month)
	require.Equal(t, 1, result[1].RequestCount)
	require.Equal(t, 300, result[1].TokenCount)
	require.Equal(t, int64(40), result[1].QuotaConsumed)
	require.Equal(t, int64(0), result[1].QuotaRecharged)
}
