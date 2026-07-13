package domain

import "time"

type TopUpStatus int

const (
	TopUpPending  TopUpStatus = 0
	TopUpSuccess  TopUpStatus = 1
	TopUpFailed   TopUpStatus = 2
	TopUpRefunded TopUpStatus = 3
)

type TopUp struct {
	ID            uint64      `gorm:"primaryKey" json:"id"`
	UserID        uint64      `gorm:"not null;index" json:"user_id"`
	PackageID     *uint64     `gorm:"index" json:"package_id,omitempty"`
	AmountCents   int64       `gorm:"not null" json:"amount_cents"`
	QuotaGranted  int64       `gorm:"not null" json:"quota_granted"`
	Currency      string      `gorm:"size:8;not null;default:'CNY'" json:"currency"`
	PaymentMethod string      `gorm:"size:32;not null" json:"payment_method"`
	PaymentStatus TopUpStatus `gorm:"not null;default:0" json:"payment_status"`
	TransactionID *string     `gorm:"size:255" json:"transaction_id,omitempty"`
	PaidAt        *time.Time  `json:"paid_at,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

func (TopUp) TableName() string { return "top_ups" }
