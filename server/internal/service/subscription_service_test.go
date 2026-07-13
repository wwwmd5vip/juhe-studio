package service

import (
	"context"
	"testing"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newSubscriptionTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Log{},
		&domain.Pricing{},
		&domain.QuotaTransaction{},
		&domain.TopUp{},
		&domain.SubscriptionPlan{},
		&domain.UserSubscription{},
	)
	require.NoError(t, err)
	return db
}

func createSubscriptionTestUser(t *testing.T, db *gorm.DB) *domain.User {
	ctx := context.Background()
	user := &domain.User{
		Username:     "sub-test-" + time.Now().Format("150405.000000"),
		PasswordHash: "hash",
		Quota:        0,
	}
	require.NoError(t, repository.NewUserRepository(db).Create(ctx, user))
	return user
}

func newSubscriptionServiceWithDB(t *testing.T) (*SubscriptionService, *BillingService, *gorm.DB) {
	db := newSubscriptionTestDB(t)
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
	subscriptionService := NewSubscriptionService(
		db,
		repository.NewSubscriptionPlanRepository(db),
		repository.NewUserSubscriptionRepository(db),
		repository.NewTopUpRepository(db),
		billingService,
	)
	return subscriptionService, billingService, db
}

func TestSubscriptionService_CreatePlan(t *testing.T) {
	svc, _, _ := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:           "Pro Monthly",
		QuotaValue:     10000,
		PriceCents:     1999,
		Currency:       "CNY",
		IntervalMonths: 1,
		SortOrder:      1,
	})
	require.NoError(t, err)
	require.NotNil(t, plan)
	require.NotZero(t, plan.ID)
	require.Equal(t, "Pro Monthly", plan.Name)
	require.Equal(t, int64(10000), plan.QuotaValue)
	require.Equal(t, int64(1999), plan.PriceCents)
	require.Equal(t, "CNY", plan.Currency)
	require.Equal(t, 1, plan.IntervalMonths)
	require.Equal(t, domain.SubscriptionPlanEnabled, plan.Status)
	require.Equal(t, 1, plan.SortOrder)
}

func TestSubscriptionService_CreatePlan_Defaults(t *testing.T) {
	svc, _, _ := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Basic",
		QuotaValue: 1000,
		PriceCents: 99,
	})
	require.NoError(t, err)
	require.NotNil(t, plan)
	require.Equal(t, "CNY", plan.Currency)
	require.Equal(t, 1, plan.IntervalMonths)
}

func TestSubscriptionService_Subscribe_CreatesTopUpAndRecharge(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:           "Pro",
		QuotaValue:     5000,
		PriceCents:     999,
		Currency:       "CNY",
		IntervalMonths: 1,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)
	require.NotNil(t, sub)
	require.Equal(t, user.ID, sub.UserID)
	require.Equal(t, plan.ID, sub.PlanID)
	require.Equal(t, domain.UserSubscriptionActive, sub.Status)
	require.False(t, sub.ExpiresAt.Before(sub.StartedAt))
	require.NotNil(t, sub.LastBilledAt)

	// Subscribe creates a PENDING top-up (payment must be confirmed via webhook/admin)
	// User quota is NOT immediately recharged
	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	require.Equal(t, int64(0), updatedUser.Quota)

	topUps, _, err := repository.NewTopUpRepository(db).List(ctx, &user.ID, 1, 10, "", "", "")
	require.NoError(t, err)
	require.Len(t, topUps, 1)
	require.Equal(t, int64(0), topUps[0].QuotaGranted) // 0 for pending orders; quota granted only on MarkPaid
	require.Equal(t, int64(999), topUps[0].AmountCents)
	require.Equal(t, "CNY", topUps[0].Currency)
	require.Equal(t, "subscription", topUps[0].PaymentMethod)
	require.Equal(t, domain.TopUpPending, topUps[0].PaymentStatus)

	// No quota transactions created (payment not confirmed)
	transactions, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, transactions, 0)
}

func TestSubscriptionService_Subscribe_DuplicateBlocked(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)
	require.NotNil(t, sub)

	// Second subscription for the same user should be blocked
	sub2, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.Error(t, err)
	require.Contains(t, err.Error(), "active subscription")
	require.Nil(t, sub2)
}

func TestSubscriptionService_Subscribe_DuplicateAfterCancel(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)

	_, err = svc.Cancel(ctx, user.ID, sub.ID)
	require.NoError(t, err)

	// After cancel, user can subscribe again
	sub2, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)
	require.NotNil(t, sub2)
	require.Equal(t, domain.UserSubscriptionActive, sub2.Status)
}

func TestSubscriptionService_Subscribe_PlanNotFound(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	sub, err := svc.Subscribe(ctx, user.ID, 999)
	require.ErrorIs(t, err, ErrSubscriptionPlanNotFound)
	require.Nil(t, sub)
}

func TestSubscriptionService_Subscribe_PlanDisabled(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Disabled",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	plan.Status = domain.SubscriptionPlanDisabled
	require.NoError(t, repository.NewSubscriptionPlanRepository(db).Update(ctx, nil, plan))

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.Error(t, err)
	require.Nil(t, sub)
}

func TestSubscriptionService_Cancel(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)

	cancelled, err := svc.Cancel(ctx, user.ID, sub.ID)
	require.NoError(t, err)
	require.NotNil(t, cancelled)
	require.Equal(t, domain.UserSubscriptionCancelled, cancelled.Status)

	updated, err := repository.NewUserSubscriptionRepository(db).FindByID(ctx, sub.ID)
	require.NoError(t, err)
	require.Equal(t, domain.UserSubscriptionCancelled, updated.Status)
}

func TestSubscriptionService_Cancel_NotOwner(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	userA := createSubscriptionTestUser(t, db)
	userB := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, userA.ID, plan.ID)
	require.NoError(t, err)

	cancelled, err := svc.Cancel(ctx, userB.ID, sub.ID)
	require.ErrorIs(t, err, ErrSubscriptionNotFound)
	require.Nil(t, cancelled)
}

func TestSubscriptionService_Cancel_NotActive(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)

	_, err = svc.Cancel(ctx, user.ID, sub.ID)
	require.NoError(t, err)

	cancelledAgain, err := svc.Cancel(ctx, user.ID, sub.ID)
	require.ErrorIs(t, err, ErrSubscriptionNotActive)
	require.Nil(t, cancelledAgain)
}

func TestSubscriptionService_Renew_ExtendsExpiresAt(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:           "Pro",
		QuotaValue:     2000,
		PriceCents:     200,
		IntervalMonths: 2,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)

	// Give user enough balance for renewal (Renew deducts PriceCents)
	user.Quota = plan.PriceCents
	require.NoError(t, repository.NewUserRepository(db).Update(ctx, user))

	// Make the subscription due for renewal by setting expires_at in the past.
	sub.ExpiresAt = time.Now().UTC().Add(-time.Hour)
	require.NoError(t, repository.NewUserSubscriptionRepository(db).Update(ctx, nil, sub))

	renewed, err := svc.Renew(ctx, sub.ID)
	require.NoError(t, err)
	require.NotNil(t, renewed)
	// Renewal now extends from current time to prevent infinite re-charge loops
	// when ExpiresAt is far in the past. Use a wider tolerance (10s) for the expected now-based calculation.
	require.WithinDuration(t, time.Now().UTC().AddDate(0, 2, 0), renewed.ExpiresAt.UTC(), 10*time.Second)
	require.NotNil(t, renewed.LastBilledAt)

	updatedUser, err := repository.NewUserRepository(db).FindByID(ctx, user.ID)
	require.NoError(t, err)
	// After Renew: initial quota (200) - price (200) + granted quota (2000) = 2000
	require.Equal(t, int64(2000), updatedUser.Quota)

	topUps, _, err := repository.NewTopUpRepository(db).List(ctx, &user.ID, 1, 10, "", "", "")
	require.NoError(t, err)
	require.Len(t, topUps, 2)

	transactions, _, err := repository.NewQuotaTransactionRepository(db).ListByUserID(ctx, user.ID, 1, 10)
	require.NoError(t, err)
	require.Len(t, transactions, 1) // only from Renew
}

func TestSubscriptionService_Renew_NotActive(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	user := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	sub, err := svc.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)

	_, err = svc.Cancel(ctx, user.ID, sub.ID)
	require.NoError(t, err)

	renewed, err := svc.Renew(ctx, sub.ID)
	require.ErrorIs(t, err, ErrSubscriptionNotActive)
	require.Nil(t, renewed)
}

func TestSubscriptionService_ListByUser(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	userA := createSubscriptionTestUser(t, db)
	userB := createSubscriptionTestUser(t, db)
	plan, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Pro",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	_, err = svc.Subscribe(ctx, userA.ID, plan.ID)
	require.NoError(t, err)
	_, err = svc.Subscribe(ctx, userB.ID, plan.ID)
	require.NoError(t, err)

	list, total, err := svc.ListByUser(ctx, userA.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, list, 1)

	list, total, err = svc.ListByUser(ctx, userB.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, list, 1)
}

func TestSubscriptionService_ListPlans(t *testing.T) {
	svc, _, db := newSubscriptionServiceWithDB(t)
	ctx := context.Background()

	_, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Enabled Plan",
		QuotaValue: 1000,
		PriceCents: 100,
	})
	require.NoError(t, err)

	disabled, err := svc.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:       "Disabled Plan",
		QuotaValue: 2000,
		PriceCents: 200,
	})
	require.NoError(t, err)
	disabled.Status = domain.SubscriptionPlanDisabled
	require.NoError(t, repository.NewSubscriptionPlanRepository(db).Update(ctx, nil, disabled))

	all, total, err := svc.ListPlans(ctx, false, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, all, 2)

	enabled, total, err := svc.ListPlans(ctx, true, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, enabled, 1)
	require.Equal(t, "Enabled Plan", enabled[0].Name)
}
