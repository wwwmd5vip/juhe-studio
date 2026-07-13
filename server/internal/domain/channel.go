package domain

import (
	"encoding/json"
	"time"
)

type ChannelStatus int

const (
	ChannelDisabled ChannelStatus = 0
	ChannelActive   ChannelStatus = 1
	ChannelError    ChannelStatus = 2
)

type Channel struct {
	ID                  uint64        `gorm:"primaryKey" json:"id"`
	Type                ChannelType   `gorm:"size:32;not null" json:"type"`
	Name                string        `gorm:"size:128;not null" json:"name"`
	BaseURL             *string       `gorm:"size:512" json:"base_url,omitempty"`
	AuthType            AuthType      `gorm:"size:32;not null;default:api-key" json:"auth_type"`
	Keys                string        `gorm:"type:text;not null" json:"-"`
	Models              string        `gorm:"type:text;not null" json:"models"`
	Groups              string        `gorm:"size:512;not null;default:'default'" json:"groups"`
	Weight              int           `gorm:"not null;default:1" json:"weight"`
	Priority            int           `gorm:"not null;default:0" json:"priority"`
	Status              ChannelStatus `gorm:"not null;default:1" json:"status"`
	ModelMapping        *string       `gorm:"type:json" json:"model_mapping,omitempty"`
	StatusCodeMapping   *string       `gorm:"type:json" json:"status_code_mapping,omitempty"`
	TimeoutSeconds      int           `gorm:"not null;default:60" json:"timeout_seconds"`
	AutoBan             bool          `gorm:"not null;default:true" json:"auto_ban"`
	FailCount           int           `gorm:"not null;default:0" json:"fail_count"`
	ConsecutiveFailures int           `gorm:"not null;default:0" json:"consecutive_failures"`
	LastError           *string       `gorm:"type:text" json:"last_error,omitempty"`
	LastCheckedAt       *time.Time    `json:"last_checked_at,omitempty"`
	ResponseTimeMs      int           `gorm:"not null;default:0" json:"response_time_ms"`
	CreatedAt           time.Time     `json:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at"`
}

func (c *Channel) GetModelMapping() map[string]string {
	if c.ModelMapping == nil || *c.ModelMapping == "" {
		return nil
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(*c.ModelMapping), &m); err != nil {
		return nil
	}
	return m
}

func (c *Channel) GetStatusCodeMapping() map[string]int {
	if c.StatusCodeMapping == nil || *c.StatusCodeMapping == "" {
		return nil
	}
	var m map[string]int
	if err := json.Unmarshal([]byte(*c.StatusCodeMapping), &m); err != nil {
		return nil
	}
	return m
}

func (Channel) TableName() string {
	return "channels"
}
