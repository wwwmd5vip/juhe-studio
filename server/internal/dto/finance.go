package dto

import (
	"github.com/juhe-management/server/internal/domain"
)

// TrendRow represents a single day's consumption in the 30-day trend.
type TrendRow struct {
	Date     string `json:"date"`
	Consumed int64  `json:"consumed"`
}

// UserFinanceData aggregates financial data for a single user.
type UserFinanceData struct {
	Quota              int64                     `json:"quota"`
	UsedQuota          int64                     `json:"used_quota"`
	TodayRequests      int64                     `json:"today_requests"`
	TodayTokens        int64                     `json:"today_tokens"`
	TodayConsumed      int64                     `json:"today_consumed"`
	Trends             []TrendRow                `json:"trends"`
	RecentTransactions []domain.QuotaTransaction `json:"recent_transactions"`
	Subscriptions      []domain.UserSubscription `json:"subscriptions"`
}
