package service

import (
	"context"
	"log"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

type UserFinanceService struct {
	db              *gorm.DB
	userRepo        *repository.UserRepository
	transactionRepo *repository.QuotaTransactionRepository
	dailyBillRepo   *repository.DailyBillRepository
	subRepo         *repository.UserSubscriptionRepository
}

func NewUserFinanceService(db *gorm.DB, userRepo *repository.UserRepository, transactionRepo *repository.QuotaTransactionRepository, dailyBillRepo *repository.DailyBillRepository, subRepo *repository.UserSubscriptionRepository) *UserFinanceService {
	return &UserFinanceService{
		db:              db,
		userRepo:        userRepo,
		transactionRepo: transactionRepo,
		dailyBillRepo:   dailyBillRepo,
		subRepo:         subRepo,
	}
}

func (s *UserFinanceService) GetUserFinance(ctx context.Context, userID uint64) (*dto.UserFinanceData, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	start30 := today.AddDate(0, 0, -29)

	// Aggregate today's consumption from Log table
	var ts struct {
		Requests int64
		Tokens   int64
		Consumed int64
	}
	if err := s.db.WithContext(ctx).Model(&domain.Log{}).
		Select("COUNT(*) as requests", "COALESCE(SUM(total_tokens),0) as tokens", "COALESCE(SUM(quota_used),0) as consumed").
		Where("user_id = ? AND created_at >= ?", userID, today).
		Scan(&ts).Error; err != nil {
		log.Printf("[user_finance] failed to aggregate today's consumption for user %d: %v", userID, err)
	}

	// 30-day trend from DailyBill table
	var trends []dto.TrendRow
	if err := s.db.WithContext(ctx).Model(&domain.DailyBill{}).
		Select("DATE_FORMAT(bill_date, '%Y-%m-%d') as date", "SUM(quota_consumed) as consumed").
		Where("user_id = ? AND bill_date >= ? AND bill_date <= ?", userID, start30, today).
		Group("bill_date").Order("bill_date ASC").
		Scan(&trends).Error; err != nil {
		log.Printf("[user_finance] failed to load 30-day trend for user %d: %v", userID, err)
	}

	// Recent transactions (last 10)
	transactions, _, err := s.transactionRepo.ListByUserID(ctx, userID, 1, 10)
	if err != nil {
		log.Printf("[user_finance] failed to load recent transactions for user %d: %v", userID, err)
	}

	// Subscriptions (active + recent)
	subs, _, err := s.subRepo.ListByUserID(ctx, userID, 1, 10)
	if err != nil {
		log.Printf("[user_finance] failed to load subscriptions for user %d: %v", userID, err)
	}

	return &dto.UserFinanceData{
		Quota:              user.Quota,
		UsedQuota:          user.UsedQuota,
		TodayRequests:      ts.Requests,
		TodayTokens:        ts.Tokens,
		TodayConsumed:      ts.Consumed,
		Trends:             trends,
		RecentTransactions: transactions,
		Subscriptions:      subs,
	}, nil
}
