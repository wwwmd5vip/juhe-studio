package dto

import "time"

// Channel

type CreateChannelRequest struct {
	Type              string            `json:"type" binding:"required,max=32"`
	Name              string            `json:"name" binding:"required,max=128"`
	BaseURL           string            `json:"base_url" binding:"omitempty,url"`
	AuthType          string            `json:"auth_type" binding:"omitempty,oneof=api-key api-key-header"`
	Keys              string            `json:"keys" binding:"required"`
	Models            string            `json:"models" binding:"required"`
	Groups            string            `json:"groups" binding:"omitempty"`
	Weight            int               `json:"weight" binding:"omitempty,min=0"`
	Priority          int               `json:"priority" binding:"omitempty"`
	ModelMapping      map[string]string `json:"model_mapping,omitempty"`
	StatusCodeMapping map[string]string `json:"status_code_mapping,omitempty"`
	TimeoutSeconds    int               `json:"timeout_seconds" binding:"omitempty,min=1,max=300"`
	AutoBan           bool              `json:"auto_ban"`
}

type UpdateChannelRequest struct {
	Type              string            `json:"type" binding:"omitempty,max=32"`
	Name              string            `json:"name" binding:"omitempty,max=128"`
	BaseURL           string            `json:"base_url" binding:"omitempty,url"`
	AuthType          string            `json:"auth_type" binding:"omitempty,oneof=api-key api-key-header"`
	Keys              string            `json:"keys" binding:"omitempty"`
	Models            string            `json:"models" binding:"omitempty"`
	Groups            string            `json:"groups" binding:"omitempty"`
	Weight            *int              `json:"weight" binding:"omitempty,min=0"`
	Priority          *int              `json:"priority"`
	ModelMapping      map[string]string `json:"model_mapping,omitempty"`
	StatusCodeMapping map[string]string `json:"status_code_mapping,omitempty"`
	TimeoutSeconds    *int              `json:"timeout_seconds" binding:"omitempty,min=1,max=300"`
	AutoBan           *bool             `json:"auto_ban"`
	Status            *int              `json:"status" binding:"omitempty,oneof=0 1 2"`
}

type ChannelInfo struct {
	ID                uint64            `json:"id"`
	Type              string            `json:"type"`
	Name              string            `json:"name"`
	BaseURL           *string           `json:"base_url,omitempty"`
	AuthType          string            `json:"auth_type"`
	Keys              string            `json:"keys"`
	Models            string            `json:"models"`
	Groups            string            `json:"groups"`
	Weight            int               `json:"weight"`
	Priority          int               `json:"priority"`
	Status            int               `json:"status"`
	ModelMapping      map[string]string `json:"model_mapping,omitempty"`
	StatusCodeMapping map[string]string `json:"status_code_mapping,omitempty"`
	TimeoutSeconds    int               `json:"timeout_seconds"`
	AutoBan           bool              `json:"auto_ban"`
	FailCount         int               `json:"fail_count"`
	LastError         *string           `json:"last_error,omitempty"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}

type FetchUpstreamModelsResponse struct {
	Fetched int              `json:"fetched"`
	Models  []string         `json:"models"`
	Details []FetchedModelDetail `json:"details,omitempty"`
}

// FetchedModelDetail 拉取到的单个模型详情（含上游能力数据）
type FetchedModelDetail struct {
	ModelName        string   `json:"model_name"`
	Type             string   `json:"type"`
	Capabilities     []string `json:"capabilities,omitempty"`
	InputModalities  []string `json:"input_modalities,omitempty"`
	OutputModalities []string `json:"output_modalities,omitempty"`
	ContextWindow    int      `json:"context_window"`
	MaxOutputTokens  int      `json:"max_output_tokens"`
}

type PreviewUpstreamModelsResponse struct {
	Models               []string                    `json:"models"`
	ExistingTypes        map[string]string           `json:"existing_types"`
	ExistingCapabilities map[string][]string         `json:"existing_capabilities,omitempty"`
	InputModalities      map[string][]string         `json:"input_modalities,omitempty"`
	OutputModalities     map[string][]string         `json:"output_modalities,omitempty"`
}

// PreviewModelsFromConfigRequest 根据表单数据（无需已保存渠道）预览上游模型
type PreviewModelsFromConfigRequest struct {
	Type    string `json:"type" binding:"required,max=32"`
	BaseURL string `json:"base_url"`
	Keys    string `json:"keys"`
}

// TestChannelFromConfigRequest 根据表单数据（无需已保存渠道）测试连通性
type TestChannelFromConfigRequest struct {
	Type           string `json:"type" binding:"required,max=32"`
	BaseURL        string `json:"base_url"`
	Keys           string `json:"keys"`
	TimeoutSeconds int    `json:"timeout_seconds"`
}

// TestChannelFromConfigResponse 连通性测试响应
type TestChannelFromConfigResponse struct {
	ResponseTimeMs int `json:"response_time_ms"`
}

type SyncUpstreamModelsRequest struct {
	Models []SyncModelItem `json:"models" binding:"required,min=1,dive"`
}

type SyncModelItem struct {
	ModelName    string   `json:"model_name" binding:"required,max=128"`
	Type         string   `json:"type" binding:"required,oneof=llm image video audio embedding"`
	Capabilities []string `json:"capabilities,omitempty"`
	Endpoints    []string `json:"endpoints,omitempty"`
}

type SyncUpstreamModelsResponse struct {
	Synced int      `json:"synced"`
	Models []string `json:"models"`
}

type ChannelTypeInfo struct {
	Type        string `json:"type"`
	DefaultURL  string `json:"default_url"`
	Description string `json:"description,omitempty"`
}

// ModelChannelInfo 模型关联的渠道简要信息
type ModelChannelInfo struct {
	ID      uint64  `json:"id"`
	Name    string  `json:"name"`
	Type    string  `json:"type"`
	Status  int     `json:"status"`
	BaseURL *string `json:"base_url,omitempty"`
	Group   string  `json:"group"`
}

// Model

type CreateModelRequest struct {
	ModelName       string   `json:"model_name" binding:"required,max=128"`
	DisplayName     string   `json:"display_name" binding:"omitempty,max=255"`
	UpstreamName    string   `json:"upstream_name" binding:"omitempty,max=128"`
	Type            string   `json:"type" binding:"required,oneof=llm image video audio embedding"`
	Capabilities    []string `json:"capabilities"`
	ChannelIDs      []uint64 `json:"channel_ids"`
	Endpoints       []string `json:"endpoints"`
	MatchRule       int      `json:"match_rule" binding:"omitempty,oneof=0 1 2 3"`
	ContextWindow   int      `json:"context_window" binding:"omitempty,min=0"`
	MaxOutputTokens int      `json:"max_output_tokens" binding:"omitempty,min=0"`
}

type UpdateModelRequest struct {
	DisplayName     *string  `json:"display_name" binding:"omitempty,max=255"`
	UpstreamName    *string  `json:"upstream_name" binding:"omitempty,max=128"`
	Type            *string  `json:"type" binding:"omitempty,oneof=llm image video audio embedding"`
	Capabilities    []string `json:"capabilities"`
	ChannelIDs      []uint64 `json:"channel_ids"`
	Endpoints       []string `json:"endpoints"`
	MatchRule       *int     `json:"match_rule" binding:"omitempty,oneof=0 1 2 3"`
	ContextWindow   *int     `json:"context_window" binding:"omitempty,min=0"`
	MaxOutputTokens *int     `json:"max_output_tokens" binding:"omitempty,min=0"`
	Status          *int     `json:"status" binding:"omitempty,oneof=0 1"`
}

type ModelInfo struct {
	ID              uint64    `json:"id"`
	ModelName       string    `json:"model_name"`
	DisplayName     *string   `json:"display_name,omitempty"`
	UpstreamName    *string   `json:"upstream_name,omitempty"`
	Type            string    `json:"type"`
	VendorID        *uint64   `json:"vendor_id,omitempty"`
	Endpoints       []string  `json:"endpoints,omitempty"`
	Capabilities    []string  `json:"capabilities,omitempty"`
	ContextWindow   int       `json:"context_window"`
	MaxOutputTokens int       `json:"max_output_tokens"`
	MatchRule       int       `json:"match_rule"`
	Status          int       `json:"status"`
	HasPricing      bool      `json:"has_pricing"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type VendorInfo struct {
	ID          uint64    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	IconURL     *string   `json:"icon_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateVendorRequest struct {
	Name        string `json:"name" binding:"required,max=128"`
	Description string `json:"description" binding:"omitempty"`
	IconURL     string `json:"icon_url" binding:"omitempty,url"`
}

type UpdateVendorRequest struct {
	Name        *string `json:"name" binding:"omitempty,max=128"`
	Description *string `json:"description" binding:"omitempty"`
	IconURL     *string `json:"icon_url" binding:"omitempty,url"`
}

// Pricing

type CreatePricingRequest struct {
	ModelName         string  `json:"model_name" binding:"required,max=128"`
	Group             string  `json:"group" binding:"omitempty,max=64"`
	BillingMode       string  `json:"billing_mode" binding:"required,oneof=token fixed tiered"`
	ModelRatio        float64 `json:"model_ratio" binding:"omitempty,min=0"`
	CompletionRatio   float64 `json:"completion_ratio" binding:"omitempty,min=0"`
	CachedTokensRatio float64 `json:"cached_tokens_ratio" binding:"omitempty,min=0"`
	FixedPriceCents   *int64  `json:"fixed_price_cents"`
	ImageRatio        float64 `json:"image_ratio" binding:"omitempty,min=0"`
	TieredExpr        string  `json:"tiered_expr" binding:"omitempty"`
	EffectiveFrom     *string `json:"effective_from" binding:"omitempty,datetime=2006-01-02T15:04:05Z07:00"`
}

type SyncUpstreamPricingRequest struct {
	ChannelID uint64 `json:"channel_id" binding:"required"`
}

type SyncPresetPricingRequest struct {
	Preset string `json:"preset" binding:"required"` // 预设名称，如 "models.dev"
}

// BatchPricingItem is used for batch upsert; model_name is provided at the batch level.
type BatchPricingItem struct {
	Group             string  `json:"group" binding:"omitempty,max=64"`
	BillingMode       string  `json:"billing_mode" binding:"required,oneof=token fixed tiered"`
	ModelRatio        float64 `json:"model_ratio" binding:"omitempty,min=0"`
	CompletionRatio   float64 `json:"completion_ratio" binding:"omitempty,min=0"`
	CachedTokensRatio float64 `json:"cached_tokens_ratio" binding:"omitempty,min=0"`
	FixedPriceCents   *int64  `json:"fixed_price_cents"`
	ImageRatio        float64 `json:"image_ratio" binding:"omitempty,min=0"`
	TieredExpr        string  `json:"tiered_expr" binding:"omitempty"`
	EffectiveFrom     *string `json:"effective_from" binding:"omitempty,datetime=2006-01-02T15:04:05Z07:00"`
}

type UpdatePricingRequest struct {
	BillingMode       *string `json:"billing_mode" binding:"omitempty,oneof=token fixed tiered"`
	ModelRatio        float64 `json:"model_ratio" binding:"omitempty,min=0"`
	CompletionRatio   float64 `json:"completion_ratio" binding:"omitempty,min=0"`
	CachedTokensRatio float64 `json:"cached_tokens_ratio" binding:"omitempty,min=0"`
	FixedPriceCents   *int64  `json:"fixed_price_cents"`
	ImageRatio        float64 `json:"image_ratio" binding:"omitempty,min=0"`
	TieredExpr        *string `json:"tiered_expr"`
	EffectiveFrom     *string `json:"effective_from" binding:"omitempty,datetime=2006-01-02T15:04:05Z07:00"`
}

type PricingInfo struct {
	ID                uint64    `json:"id"`
	ModelName         string    `json:"model_name"`
	Group             string    `json:"group"`
	BillingMode       string    `json:"billing_mode"`
	ModelRatio        float64   `json:"model_ratio"`
	CompletionRatio   float64   `json:"completion_ratio"`
	CachedTokensRatio float64   `json:"cached_tokens_ratio"`
	FixedPriceCents   *int64    `json:"fixed_price_cents,omitempty"`
	ImageRatio        float64   `json:"image_ratio"`
	TieredExpr        *string   `json:"tiered_expr,omitempty"`
	EffectiveFrom     time.Time `json:"effective_from"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
