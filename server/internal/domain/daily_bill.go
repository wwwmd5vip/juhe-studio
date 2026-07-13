package domain

import "time"

type DailyBill struct {
	ID             uint64    `gorm:"primaryKey" json:"id"`
	BillDate       time.Time `gorm:"not null;uniqueIndex:idx_bill_unique" json:"bill_date"`
	UserID         uint64    `gorm:"not null;uniqueIndex:idx_bill_unique" json:"user_id"`
	ModelName      string    `gorm:"size:128;not null;uniqueIndex:idx_bill_unique" json:"model_name"`
	RequestCount   int       `gorm:"not null;default:0" json:"request_count"`
	TokenCount     int       `gorm:"not null;default:0" json:"token_count"`
	QuotaConsumed  int64     `gorm:"not null;default:0" json:"quota_consumed"`
	QuotaRecharged int64     `gorm:"not null;default:0" json:"quota_recharged"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (DailyBill) TableName() string { return "daily_bills" }
