package domain

import "time"

type QuotaPackageStatus int

const (
	QuotaPackageDisabled QuotaPackageStatus = 0
	QuotaPackageEnabled  QuotaPackageStatus = 1
)

type QuotaPackage struct {
	ID         uint64             `gorm:"primaryKey" json:"id"`
	Name       string             `gorm:"size:128;not null" json:"name"`
	QuotaValue int64              `gorm:"not null" json:"quota_value"`
	PriceCents int64              `gorm:"not null" json:"price_cents"`
	Currency   string             `gorm:"size:8;not null;default:'CNY'" json:"currency"`
	Status     QuotaPackageStatus `gorm:"not null;default:1" json:"status"`
	SortOrder  int                `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt  time.Time          `json:"created_at"`
	UpdatedAt  time.Time          `json:"updated_at"`
}

func (QuotaPackage) TableName() string { return "quota_packages" }
