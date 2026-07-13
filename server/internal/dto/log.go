package dto

import "time"

type LogInfo struct {
	ID               uint64     `json:"id"`
	UserID           uint64     `json:"user_id"`
	TokenID          *uint64    `json:"token_id,omitempty"`
	ChannelID        *uint64    `json:"channel_id,omitempty"`
	ModelName        string     `json:"model_name"`
	RequestID        string     `json:"request_id"`
	Type             string     `json:"type"`
	Mode             string     `json:"mode"`
	PromptTokens     int        `json:"prompt_tokens"`
	CompletionTokens int        `json:"completion_tokens"`
	TotalTokens      int        `json:"total_tokens"`
	ImageN           int        `json:"image_n"`
	QuotaUsed        int64      `json:"quota_used"`
	QuotaPreConsumed int64      `json:"quota_pre_consumed"`
	StatusCode       int        `json:"status_code"`
	UpstreamStatus   *string    `json:"upstream_status,omitempty"`
	IPAddress        string     `json:"ip_address"`
	UserAgent        string     `json:"user_agent"`
	RequestContent   string     `json:"request_content"`
	ResponseContent  string     `json:"response_content"`
	ErrorMessage     string     `json:"error_message"`
	UseTimeMs        int        `json:"use_time_ms"`
	CreatedAt        time.Time  `json:"created_at"`
}
