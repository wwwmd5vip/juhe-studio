package domain

import "time"

type SubscriptionPlanStatus int

const (
	SubscriptionPlanDisabled SubscriptionPlanStatus = 0
	SubscriptionPlanEnabled  SubscriptionPlanStatus = 1
)

type SubscriptionPlan struct {
	ID             uint64                 `gorm:"primaryKey" json:"id"`
	Name           string                 `gorm:"size:128;not null" json:"name"`
	QuotaValue     int64                  `gorm:"not null" json:"quota_value"`
	PriceCents     int64                  `gorm:"not null" json:"price_cents"`
	Currency       string                 `gorm:"size:8;not null;default:'CNY'" json:"currency"`
	IntervalMonths int                    `gorm:"not null;default:1" json:"interval_months"`
	Status         SubscriptionPlanStatus `gorm:"not null;default:1" json:"status"`
	SortOrder      int                    `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

func (SubscriptionPlan) TableName() string { return "subscription_plans" }

type UserSubscriptionStatus int

const (
	UserSubscriptionInactive  UserSubscriptionStatus = 0
	UserSubscriptionActive    UserSubscriptionStatus = 1
	UserSubscriptionCancelled UserSubscriptionStatus = 2
	UserSubscriptionExpired   UserSubscriptionStatus = 3
)

type UserSubscription struct {
	ID           uint64                 `gorm:"primaryKey" json:"id"`
	UserID       uint64                 `gorm:"not null;index" json:"user_id"`
	PlanID       uint64                 `gorm:"not null;index" json:"plan_id"`
	Status       UserSubscriptionStatus `gorm:"not null;default:1" json:"status"`
	StartedAt    time.Time              `gorm:"not null" json:"started_at"`
	ExpiresAt    time.Time              `gorm:"not null;index" json:"expires_at"`
	LastBilledAt *time.Time             `json:"last_billed_at,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

func (UserSubscription) TableName() string { return "user_subscriptions" }
