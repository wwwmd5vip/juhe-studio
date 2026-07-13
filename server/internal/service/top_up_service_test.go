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

func newTopUpTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Log{},
		&domain.Pricing{},
		&domain.QuotaTransaction{},
		&domain.TopUp{},
		&domain.QuotaPackage{},
	)
	require.NoError(t, err)
	return db
}

func createTopUpTestUser(t *testing.T, db *gorm.DB) *domain.User {
	ctx := context.Background()
	user := &domain.User{
		Username:     "topup-test-" + time.Now().Format("150405.000000"),
		PasswordHash: "hash",
		Quota:        0,
	}
	require.NoError(t, repository.NewUserRepository(db).Create(ctx, user))
	return user
}

func createTopUpTestPackage(t *testing.T, db *gorm.DB) *domain.QuotaPackage {
	ctx := context.Background()
	pkg := &domain.QuotaPackage{
		Name:       "Test Package",
		QuotaValue: 5000,
		PriceCents: 1000,
		Currency:   "CNY",
		Status:     domain.QuotaPackageEnabled,
	}
	require.NoError(t, repository.NewQuotaPackageRepository(db).Create(ctx, pkg))
	return pkg
}

func newTopUpServiceWithDB(t *testing.T) (*TopUpService, *BillingService, *gorm.DB) {
	db := newTopUpTestDB(t)
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
	topUpService := NewTopUpService(
		db,
		repository.NewTopUpRepository(db),
		repository.NewQuotaPackageRepository(db),
		billingService,
	)
	return topUpService, billingService, db
}

func TestTopUpService_CreateManualTopUp_CreatesSuccessOrderAndRecharges(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)

	topUp, err := svc.CreateManualTopUp(ctx, user.ID, 1000)
	require.NoError(t, err)
	require.NotNil(t, topUp)
	require.Equal(t, user.ID, topUp.UserID)
	require.Equal(t, int64(1000), topUp.QuotaGranted)
	require.Equal(t, int64(1000), topUp.AmountCents)
	require.Equal(t, "manual", topUp.PaymentMethod)
	require.Equal(t, domain.TopUpSuccess, topUp.PaymentStatus)
	require.NotNil(t, topUp.PaidAt)

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
	require.Equal(t, "topup", *transactions[0].RelatedType)
	require.NotNil(t, transactions[0].RelatedID)
	require.Equal(t, "manual topup", *transactions[0].Description)
}

func TestTopUpService_CreateManualTopUp_InvalidAmount(t *testing.T) {
	svc, _, _ := newTopUpServiceWithDB(t)
	ctx := context.Background()

	topUp, err := svc.CreateManualTopUp(ctx, 1, 0)
	require.ErrorIs(t, err, ErrInvalidTopUpAmount)
	require.Nil(t, topUp)
}

func TestTopUpService_CreatePackageOrder_CreatesPendingOrder(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	topUp, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)
	require.NotNil(t, topUp)
	require.Equal(t, user.ID, topUp.UserID)
	require.NotNil(t, topUp.PackageID)
	require.Equal(t, pkg.ID, *topUp.PackageID)
	require.Equal(t, pkg.PriceCents, topUp.AmountCents)
	require.Equal(t, pkg.QuotaValue, topUp.QuotaGranted)
	require.Equal(t, pkg.Currency, topUp.Currency)
	require.Equal(t, "alipay", topUp.PaymentMethod)
	require.Equal(t, domain.TopUpPending, topUp.PaymentStatus)
	require.Nil(t, topUp.PaidAt)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedUser.Quota)
}

func TestTopUpService_CreatePackageOrder_PackageNotAvailable(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)
	pkg.Status = domain.QuotaPackageDisabled
	require.NoError(t, repository.NewQuotaPackageRepository(db).Update(ctx, pkg))

	topUp, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.Error(t, err)
	require.Nil(t, topUp)
}

func TestTopUpService_MarkPaid_Recharges(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	order, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)

	updated, err := svc.MarkPaid(ctx, order.ID, "txn-123")
	require.NoError(t, err)
	require.Equal(t, domain.TopUpSuccess, updated.PaymentStatus)
	require.NotNil(t, updated.PaidAt)
	require.NotNil(t, updated.TransactionID)
	require.Equal(t, "txn-123", *updated.TransactionID)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, pkg.QuotaValue, updatedUser.Quota)

	transactions, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, transactions, 1)
	require.Equal(t, domain.QuotaTransactionTypeRecharge, transactions[0].Type)
	require.Equal(t, pkg.QuotaValue, transactions[0].Amount)
	require.NotNil(t, transactions[0].RelatedType)
	require.Equal(t, "topup", *transactions[0].RelatedType)
	require.NotNil(t, transactions[0].RelatedID)
}

func TestTopUpService_MarkPaid_AlreadyDone(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	order, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)

	_, err = svc.MarkPaid(ctx, order.ID, "txn-1")
	require.NoError(t, err)

	_, err = svc.MarkPaid(ctx, order.ID, "txn-2")
	require.ErrorIs(t, err, ErrTopUpAlreadyDone)
}

func TestTopUpService_MarkFailed_UpdatesStatus(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	order, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)

	updated, err := svc.MarkFailed(ctx, order.ID)
	require.NoError(t, err)
	require.Equal(t, domain.TopUpFailed, updated.PaymentStatus)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedUser.Quota)
}

func TestTopUpService_MarkFailed_AlreadyDone(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	order, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)

	_, err = svc.MarkFailed(ctx, order.ID)
	require.NoError(t, err)

	_, err = svc.MarkFailed(ctx, order.ID)
	require.ErrorIs(t, err, ErrTopUpAlreadyDone)
}

func TestTopUpService_ListAndGet(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	_, err := svc.CreateManualTopUp(ctx, user.ID, 1000)
	require.NoError(t, err)
	order, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)

	list, total, err := svc.List(ctx, &user.ID, 1, 10, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, list, 2)

	got, err := svc.Get(ctx, order.ID)
	require.NoError(t, err)
	require.Equal(t, order.ID, got.ID)

	list, total, err = svc.List(ctx, nil, 1, 10, "", "", "")
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, list, 2)
}

func TestTopUpService_RefundOrder_ReducesQuotaAndCreatesRefundTransaction(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)

	topUp, err := svc.CreateManualTopUp(ctx, user.ID, 1000)
	require.NoError(t, err)
	require.Equal(t, domain.TopUpSuccess, topUp.PaymentStatus)

	refunded, err := svc.RefundOrder(ctx, topUp.ID)
	require.NoError(t, err)
	require.NotNil(t, refunded)
	require.Equal(t, domain.TopUpRefunded, refunded.PaymentStatus)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedUser.Quota)

	transactions, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, transactions, 2)

	var rechargeTx, refundTx *domain.QuotaTransaction
	for i := range transactions {
		if transactions[i].Type == domain.QuotaTransactionTypeRecharge {
			rechargeTx = &transactions[i]
		} else if transactions[i].Type == domain.QuotaTransactionTypeRefund {
			refundTx = &transactions[i]
		}
	}
	require.NotNil(t, rechargeTx)
	require.Equal(t, int64(1000), rechargeTx.Amount)
	require.NotNil(t, refundTx)
	require.Equal(t, int64(-1000), refundTx.Amount)
	require.Equal(t, int64(0), refundTx.BalanceAfter)
	require.NotNil(t, refundTx.RelatedType)
	require.Equal(t, "refund", *refundTx.RelatedType)
}

func TestTopUpService_RefundOrder_NonSuccessReturnsError(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)
	pkg := createTopUpTestPackage(t, db)

	order, err := svc.CreatePackageOrder(ctx, user.ID, pkg.ID, "alipay")
	require.NoError(t, err)
	require.Equal(t, domain.TopUpPending, order.PaymentStatus)

	_, err = svc.RefundOrder(ctx, order.ID)
	require.ErrorIs(t, err, ErrTopUpNotRefundable)
}

func TestTopUpService_RefundOrder_AlreadyRefundedReturnsError(t *testing.T) {
	svc, _, db := newTopUpServiceWithDB(t)
	ctx := context.Background()

	user := createTopUpTestUser(t, db)

	topUp, err := svc.CreateManualTopUp(ctx, user.ID, 1000)
	require.NoError(t, err)

	_, err = svc.RefundOrder(ctx, topUp.ID)
	require.NoError(t, err)

	_, err = svc.RefundOrder(ctx, topUp.ID)
	require.Error(t, err)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedUser.Quota)
}
