package dto

import "time"

// TopUp
type CreateTopUpRequest struct {
	UserID        uint64 `json:"user_id" binding:"required,gt=0"`
	QuotaGranted  int64  `json:"quota_granted" binding:"required,gt=0"`
	PaymentMethod string `json:"payment_method" binding:"omitempty,oneof=manual alipay wechat stripe"`
}

type CreatePackageOrderRequest struct {
	PackageID     uint64 `json:"package_id" binding:"required,gt=0"`
	PaymentMethod string `json:"payment_method" binding:"required,oneof=alipay wechat stripe"`
}

type TopUpInfo struct {
	ID            uint64     `json:"id"`
	UserID        uint64     `json:"user_id"`
	PackageID     *uint64    `json:"package_id,omitempty"`
	AmountCents   int64      `json:"amount_cents"`
	QuotaGranted  int64      `json:"quota_granted"`
	Currency      string     `json:"currency"`
	PaymentMethod string     `json:"payment_method"`
	PaymentStatus int        `json:"payment_status"`
	TransactionID *string    `json:"transaction_id,omitempty"`
	PaidAt        *time.Time `json:"paid_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// Redemption
type GenerateRedemptionCodesRequest struct {
	Count      int        `json:"count" binding:"required,min=1,max=1000"`
	QuotaValue int64      `json:"quota_value" binding:"required,gt=0"`
	Prefix     string     `json:"prefix" binding:"max=16"`
	ExpiresAt  *time.Time `json:"expires_at"`
}

type RedeemRequest struct {
	Code string `json:"code" binding:"required"`
}

type RedemptionInfo struct {
	ID         uint64     `json:"id"`
	Code       string     `json:"code"`
	QuotaValue int64      `json:"quota_value"`
	Status     int        `json:"status"`
	UsedBy     *uint64    `json:"used_by,omitempty"`
	UsedAt     *time.Time `json:"used_at,omitempty"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// QuotaPackage
type CreateQuotaPackageRequest struct {
	Name       string `json:"name" binding:"required,max=128"`
	QuotaValue int64  `json:"quota_value" binding:"required,gt=0"`
	PriceCents int64  `json:"price_cents" binding:"required,gt=0"`
	Currency   string `json:"currency" binding:"max=8"`
	SortOrder  int    `json:"sort_order"`
}

type UpdateQuotaPackageRequest struct {
	Name       *string `json:"name" binding:"omitempty,min=1,max=128"`
	QuotaValue *int64  `json:"quota_value" binding:"omitempty,gt=0"`
	PriceCents *int64  `json:"price_cents" binding:"omitempty,gt=0"`
	Status     *int    `json:"status" binding:"omitempty,oneof=0 1"`
	SortOrder  *int    `json:"sort_order"`
}

type QuotaPackageInfo struct {
	ID         uint64    `json:"id"`
	Name       string    `json:"name"`
	QuotaValue int64     `json:"quota_value"`
	PriceCents int64     `json:"price_cents"`
	Currency   string    `json:"currency"`
	Status     int       `json:"status"`
	SortOrder  int       `json:"sort_order"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// QuotaTransaction
type QuotaTransactionInfo struct {
	ID           uint64    `json:"id"`
	UserID       uint64    `json:"user_id"`
	TokenID      *uint64   `json:"token_id,omitempty"`
	Type         string    `json:"type"`
	Amount       int64     `json:"amount"`
	BalanceAfter int64     `json:"balance_after"`
	RelatedID    *string   `json:"related_id,omitempty"`
	RelatedType  *string   `json:"related_type,omitempty"`
	Description  *string   `json:"description,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Quota
type QuotaInfo struct {
	Quota     int64 `json:"quota"`
	UsedQuota int64 `json:"used_quota"`
}

// DailyBill
type DailyBillInfo struct {
	ID             uint64    `json:"id"`
	BillDate       time.Time `json:"bill_date"`
	UserID         uint64    `json:"user_id"`
	ModelName      string    `json:"model_name"`
	RequestCount   int       `json:"request_count"`
	TokenCount     int       `json:"token_count"`
	QuotaConsumed  int64     `json:"quota_consumed"`
	QuotaRecharged int64     `json:"quota_recharged"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type MonthlyBillInfo struct {
	Month          string `json:"month"`
	RequestCount   int    `json:"request_count"`
	TokenCount     int    `json:"token_count"`
	QuotaConsumed  int64  `json:"quota_consumed"`
	QuotaRecharged int64  `json:"quota_recharged"`
}

// Subscription
type CreateSubscriptionPlanRequest struct {
	Name           string `json:"name" binding:"required,max=128"`
	QuotaValue     int64  `json:"quota_value" binding:"required,gt=0"`
	PriceCents     int64  `json:"price_cents" binding:"required,gt=0"`
	Currency       string `json:"currency" binding:"max=8"`
	IntervalMonths int    `json:"interval_months" binding:"gt=0"`
	SortOrder      int    `json:"sort_order"`
}

type UpdateSubscriptionPlanRequest struct {
	Name           *string `json:"name,omitempty" binding:"omitempty,max=128"`
	QuotaValue     *int64  `json:"quota_value,omitempty" binding:"omitempty,gt=0"`
	PriceCents     *int64  `json:"price_cents,omitempty" binding:"omitempty,gt=0"`
	Currency       *string `json:"currency,omitempty" binding:"omitempty,max=8"`
	IntervalMonths *int    `json:"interval_months,omitempty" binding:"omitempty,gt=0"`
	Status         *int    `json:"status,omitempty" binding:"omitempty,oneof=0 1"`
	SortOrder      *int    `json:"sort_order,omitempty"`
}

type SubscriptionPlanInfo struct {
	ID             uint64    `json:"id"`
	Name           string    `json:"name"`
	QuotaValue     int64     `json:"quota_value"`
	PriceCents     int64     `json:"price_cents"`
	Currency       string    `json:"currency"`
	IntervalMonths int       `json:"interval_months"`
	Status         int       `json:"status"`
	SortOrder      int       `json:"sort_order"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type UserSubscriptionInfo struct {
	ID           uint64     `json:"id"`
	UserID       uint64     `json:"user_id"`
	PlanID       uint64     `json:"plan_id"`
	Status       int        `json:"status"`
	StartedAt    time.Time  `json:"started_at"`
	ExpiresAt    time.Time  `json:"expires_at"`
	LastBilledAt *time.Time `json:"last_billed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
