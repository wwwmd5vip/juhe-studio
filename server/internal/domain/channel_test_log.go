package domain

import "time"

type ChannelTestLog struct {
	ID             uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	ChannelID      uint64    `gorm:"index;not null" json:"channel_id"`
	Success        bool      `gorm:"not null;default:false" json:"success"`
	ResponseTimeMs int       `gorm:"default:0" json:"response_time_ms"`
	ErrorMessage   string    `gorm:"type:text" json:"error_message,omitempty"`
	ProbedAt       time.Time `gorm:"not null;autoCreateTime" json:"probed_at"`
}

func (ChannelTestLog) TableName() string {
	return "channel_test_logs"
}
