package domain

import "time"

type LogType string

const (
	LogTypeChat      LogType = "chat"
	LogTypeImage     LogType = "image"
	LogTypeAudio     LogType = "audio"
	LogTypeEmbedding LogType = "embedding"
)

type LogMode string

const (
	LogModeStream    LogMode = "stream"
	LogModeNonStream LogMode = "non-stream"
)

type Log struct {
	ID                 uint64    `gorm:"primaryKey" json:"id"`
	UserID             uint64    `gorm:"not null;index;index:idx_logs_created_user,priority:2" json:"user_id"`
	TokenID            *uint64   `gorm:"index" json:"token_id,omitempty"`
	ChannelID          *uint64   `gorm:"index;index:idx_logs_created_channel,priority:2" json:"channel_id,omitempty"`
	ModelName          string    `gorm:"size:128;not null;index;index:idx_logs_created_model,priority:2" json:"model_name"`
	RequestID          string    `gorm:"size:64;uniqueIndex;not null" json:"request_id"`
	Type               LogType   `gorm:"size:32;not null" json:"type"`
	Mode               LogMode   `gorm:"size:16;not null" json:"mode"`
	PromptTokens       int       `gorm:"not null;default:0" json:"prompt_tokens"`
	CompletionTokens   int       `gorm:"not null;default:0" json:"completion_tokens"`
	CachedPromptTokens int       `gorm:"not null;default:0" json:"cached_prompt_tokens"`
	TotalTokens        int       `gorm:"not null;default:0" json:"total_tokens"`
	ImageN             int       `gorm:"not null;default:0" json:"image_n"`
	QuotaUsed          int64     `gorm:"not null;default:0" json:"quota_used"`
	QuotaPreConsumed   int64     `gorm:"not null;default:0" json:"quota_pre_consumed"`
	StatusCode         int       `gorm:"not null" json:"status_code"`
	UpstreamStatus     *string   `gorm:"size:32" json:"upstream_status,omitempty"`
	IPAddress          string    `gorm:"size:64" json:"ip_address"`
	UserAgent		string	`gorm:"size:512" json:"user_agent"`
	RequestContent     string    `gorm:"type:longtext" json:"request_content"`
	ResponseContent    string    `gorm:"type:longtext" json:"response_content"`
	ErrorMessage       string    `gorm:"type:longtext" json:"error_message"`
	UseTimeMs          int       `gorm:"not null;default:0" json:"use_time_ms"`
	CreatedAt          time.Time `gorm:"index:idx_logs_created_user,priority:1;index:idx_logs_created_channel,priority:1;index:idx_logs_created_model,priority:1" json:"created_at"`
}

func (Log) TableName() string {
	return "logs"
}
