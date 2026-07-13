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

func newDashboardTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Token{},
		&domain.Channel{},
		&domain.Model{},
		&domain.Log{},
		&domain.DailyBill{},
	)
	require.NoError(t, err)
	return db
}

func TestDashboardService_GetStats_Empty(t *testing.T) {
	svc := NewDashboardService(newDashboardTestDB(t))
	stats, err := svc.GetStats(context.Background())
	require.NoError(t, err)
	require.NotNil(t, stats)
	require.Equal(t, int64(0), stats.UserCount)
	require.Equal(t, int64(0), stats.TokenCount)
	require.Equal(t, int64(0), stats.ChannelCount)
	require.Equal(t, int64(0), stats.ModelCount)
	require.Equal(t, int64(0), stats.TodayRequestCount)
	require.Equal(t, int64(0), stats.TodayTokenCount)
	require.Equal(t, int64(0), stats.TodayQuotaConsumed)
	require.Equal(t, int64(0), stats.TodayQuotaRecharged)
	require.Equal(t, int64(0), stats.MonthQuotaConsumed)
}

func TestDashboardService_GetStats_WithData(t *testing.T) {
	db := newDashboardTestDB(t)
	svc := NewDashboardService(db)
	ctx := context.Background()
	now := time.Now().UTC()

	user := createTestUser(t, db)
	_ = createTestToken(t, db, user.ID, false, 1000)

	require.NoError(t, repository.NewChannelRepository(db).Create(ctx, &domain.Channel{
		Name:   "test-channel",
		Type:   "openai-compatible",
		Models: "gpt-4o",
		Status: domain.ChannelActive,
	}))

	require.NoError(t, repository.NewModelRepository(db).Create(ctx, &domain.Model{
		ModelName: "gpt-4o",
		Type:      domain.ModelTypeLLM,
	}))

	require.NoError(t, repository.NewLogRepository(db).Create(ctx, &domain.Log{
		UserID:          user.ID,
		ModelName:       "gpt-4o",
		RequestID:       "req-1",
		Type:            domain.LogTypeChat,
		Mode:            domain.LogModeNonStream,
		TotalTokens:     150,
		QuotaUsed:       5,
		StatusCode:      200,
		IPAddress:       "127.0.0.1",
		RequestContent:  "hello",
		ResponseContent: "hi",
		CreatedAt:       now,
	}))

	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	require.NoError(t, repository.NewDailyBillRepository(db).CreateBatch(ctx, nil, []domain.DailyBill{
		{
			BillDate:       todayStart,
			UserID:         user.ID,
			ModelName:      "gpt-4o",
			RequestCount:   1,
			TokenCount:     150,
			QuotaConsumed:  5,
			QuotaRecharged: 100,
		},
	}))

	stats, err := svc.GetStats(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(1), stats.UserCount)
	require.Equal(t, int64(1), stats.TokenCount)
	require.Equal(t, int64(1), stats.ChannelCount)
	require.Equal(t, int64(1), stats.ModelCount)
	require.Equal(t, int64(1), stats.TodayRequestCount)
	require.Equal(t, int64(150), stats.TodayTokenCount)
	require.Equal(t, int64(5), stats.TodayQuotaConsumed)
	require.Equal(t, int64(100), stats.TodayQuotaRecharged)
	require.Equal(t, int64(5), stats.MonthQuotaConsumed)
}

func TestDashboardService_GetStats_ExcludesOtherDays(t *testing.T) {
	db := newDashboardTestDB(t)
	svc := NewDashboardService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	twoDaysAgo := now.AddDate(0, 0, -2).Format("2006-01-02 15:04:05")
	user := createTestUser(t, db)

	require.NoError(t, db.WithContext(ctx).Exec(
		`INSERT INTO logs (user_id, model_name, request_id, type, mode, total_tokens, quota_used, status_code, ip_address, request_content, response_content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, "gpt-4o", "req-old", string(domain.LogTypeChat), string(domain.LogModeNonStream), 1000, 50, 200, "127.0.0.1", "hello", "hi", twoDaysAgo,
	).Error)

	stats, err := svc.GetStats(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(0), stats.TodayRequestCount)
	require.Equal(t, int64(0), stats.TodayTokenCount)
	require.Equal(t, int64(0), stats.TodayQuotaConsumed)
}
