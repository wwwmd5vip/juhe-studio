package domain

import (
	"time"
)

type TokenStatus int

const (
	TokenDisabled TokenStatus = 0
	TokenActive   TokenStatus = 1
)

type Token struct {
	ID                uint64      `gorm:"primaryKey" json:"id"`
	UserID            uint64      `gorm:"not null;index" json:"user_id"`
	Name              string      `gorm:"size:128;not null" json:"name"`
	KeyHash           string      `gorm:"size:255;uniqueIndex;not null" json:"-"`
	KeyMask           string      `gorm:"size:255;not null" json:"key_mask"`
	PlainKey string `gorm:"size:255" json:"-"` // Deprecated: no longer populated, kept for schema compatibility
	Status            TokenStatus `gorm:"not null;default:1" json:"status"`
	RemainQuota       int64       `gorm:"not null;default:0" json:"remain_quota"`
	UnlimitedQuota    bool        `gorm:"not null;default:false" json:"unlimited_quota"`
	ModelLimitsEnabled bool       `gorm:"not null;default:false" json:"model_limits_enabled"`
	ModelLimits       *string     `gorm:"type:json" json:"model_limits,omitempty"`
	Group             string      `gorm:"size:64;not null;default:'default'" json:"group"`
	CrossGroupRetry   bool        `gorm:"not null;default:false" json:"cross_group_retry"`
	AllowedIPs        *string     `json:"allowed_ips,omitempty"`
	RateLimit         int         `gorm:"not null;default:0" json:"rate_limit"`
	LastUsedAt        *time.Time  `json:"last_used_at"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
}

func (Token) TableName() string {
	return "tokens"
}
