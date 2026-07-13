package domain

import "time"

type RedemptionStatus int

const (
	RedemptionUnused RedemptionStatus = 0
	RedemptionUsed   RedemptionStatus = 1
)

type Redemption struct {
	ID         uint64           `gorm:"primaryKey" json:"id"`
	Code       string           `gorm:"size:64;uniqueIndex;not null" json:"code"`
	QuotaValue int64            `gorm:"not null" json:"quota_value"`
	Status     RedemptionStatus `gorm:"not null;default:0" json:"status"`
	UsedBy     *uint64          `gorm:"index" json:"used_by,omitempty"`
	UsedAt     *time.Time       `json:"used_at,omitempty"`
	ExpiresAt  *time.Time       `json:"expires_at,omitempty"`
	CreatedAt  time.Time        `json:"created_at"`
}

func (Redemption) TableName() string { return "redemptions" }
