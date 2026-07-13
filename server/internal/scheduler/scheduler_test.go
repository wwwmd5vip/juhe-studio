package scheduler

import (
	"bytes"
	"context"
	"log"
	"testing"
	"time"

	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/service"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newSchedulerTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Log{},
		&domain.Pricing{},
		&domain.QuotaTransaction{},
		&domain.TopUp{},
		&domain.DailyBill{},
		&domain.SubscriptionPlan{},
		&domain.UserSubscription{},
	)
	require.NoError(t, err)
	return db
}

func newSchedulerTestServices(t *testing.T, db *gorm.DB) (*service.BillingService, *service.SubscriptionService) {
	billingService := service.NewBillingService(
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
	subscriptionService := service.NewSubscriptionService(
		db,
		repository.NewSubscriptionPlanRepository(db),
		repository.NewUserSubscriptionRepository(db),
		repository.NewTopUpRepository(db),
		billingService,
	)
	return billingService, subscriptionService
}

func TestScheduler_Start_Disabled(t *testing.T) {
	cfg := &config.Config{Scheduler: config.SchedulerConfig{Enabled: false}}
	buf := &bytes.Buffer{}
	s := New(cfg, nil, nil, nil, nil, nil, log.New(buf, "", 0), nil)

	err := s.Start()
	require.NoError(t, err)
	require.Nil(t, s.cron)
	require.Contains(t, buf.String(), "scheduler is disabled")
}

func TestScheduler_runAggregateDailyBills(t *testing.T) {
	db := newSchedulerTestDB(t)
	billingService, subscriptionService := newSchedulerTestServices(t, db)
	ctx := context.Background()

	userRepo := repository.NewUserRepository(db)
	user := &domain.User{Username: "bill-user", PasswordHash: "hash", Quota: 0}
	require.NoError(t, userRepo.Create(ctx, user))

	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	yesterday := today.Add(-24 * time.Hour)
	logRecord := &domain.Log{
		UserID:      user.ID,
		ModelName:   "gpt-4",
		TotalTokens: 100,
		QuotaUsed:   50,
		Type:        domain.LogTypeChat,
		Mode:        domain.LogModeNonStream,
		StatusCode:  200,
		RequestID:   "req-1",
	}
	require.NoError(t, repository.NewLogRepository(db).Create(ctx, logRecord))
	require.NoError(t, db.WithContext(ctx).Model(logRecord).UpdateColumn("created_at", yesterday.Add(time.Hour)).Error)

	buf := &bytes.Buffer{}
	s := New(&config.Config{Scheduler: config.SchedulerConfig{Enabled: true, Schedule: "0 2 * * *"}}, nil, billingService, subscriptionService, nil, nil, log.New(buf, "", 0), nil)

	err := s.runAggregateDailyBills()
	require.NoError(t, err)

	start := yesterday
	end := start.Add(24*time.Hour - time.Nanosecond)
	bills, total, err := billingService.ListDailyBills(ctx, user.ID, start, end, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, bills, 1)
	require.Equal(t, "gpt-4", bills[0].ModelName)
	require.Equal(t, int64(50), bills[0].QuotaConsumed)
	require.Contains(t, buf.String(), "aggregate daily bills done")
}

func TestScheduler_runRenewSubscriptions(t *testing.T) {
	db := newSchedulerTestDB(t)
	billingService, subscriptionService := newSchedulerTestServices(t, db)
	ctx := context.Background()

	userRepo := repository.NewUserRepository(db)
	user := &domain.User{Username: "renew-user", PasswordHash: "hash", Quota: 1000}
	require.NoError(t, userRepo.Create(ctx, user))

	plan, err := subscriptionService.CreatePlan(ctx, &dto.CreateSubscriptionPlanRequest{
		Name:           "Monthly",
		QuotaValue:     1000,
		PriceCents:     100,
		IntervalMonths: 1,
	})
	require.NoError(t, err)

	sub, err := subscriptionService.Subscribe(ctx, user.ID, plan.ID)
	require.NoError(t, err)

	// Make the subscription due for renewal by setting expires_at in the past.
	sub.ExpiresAt = time.Now().UTC().Add(-time.Hour)
	require.NoError(t, repository.NewUserSubscriptionRepository(db).Update(ctx, nil, sub))

	buf := &bytes.Buffer{}
	s := New(&config.Config{Scheduler: config.SchedulerConfig{Enabled: true, Schedule: "0 2 * * *"}}, nil, billingService, subscriptionService, nil, nil, log.New(buf, "", 0), nil)
	err = s.runRenewSubscriptions()
	require.NoError(t, err)

	renewed, err := repository.NewUserSubscriptionRepository(db).FindByID(ctx, sub.ID)
	require.NoError(t, err)
	require.True(t, renewed.ExpiresAt.After(sub.ExpiresAt))
	require.Equal(t, domain.UserSubscriptionActive, renewed.Status)
	require.Contains(t, buf.String(), "subscriptions renewed: 1")
}
