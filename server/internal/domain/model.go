package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

type ModelType string

const (
	ModelTypeLLM       ModelType = "llm"
	ModelTypeImage     ModelType = "image"
	ModelTypeVideo     ModelType = "video"
	ModelTypeAudio     ModelType = "audio"
	ModelTypeEmbedding ModelType = "embedding"
)

type ModelMatchRule int

const (
	ModelMatchExact   ModelMatchRule = 0 // 精确匹配
	ModelMatchPrefix  ModelMatchRule = 1 // 前缀匹配
	ModelMatchSuffix  ModelMatchRule = 2 // 后缀匹配
	ModelMatchContain ModelMatchRule = 3 // 包含匹配
)

// EndpointTypes 端点类型 JSON 数组（实现 driver.Valuer / sql.Scanner）
type EndpointTypes []EndpointType

func (e EndpointTypes) Value() (driver.Value, error) {
	if e == nil {
		return "[]", nil
	}
	return json.Marshal(e)
}

func (e *EndpointTypes) Scan(value any) error {
	if value == nil {
		*e = EndpointTypes{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("unsupported Scan type for EndpointTypes")
	}
	return json.Unmarshal(bytes, e)
}

// ModelCapabilities 模型能力 JSON 数组
type ModelCapabilities []ModelCapability

func (m ModelCapabilities) Value() (driver.Value, error) {
	if m == nil {
		return "[]", nil
	}
	return json.Marshal(m)
}

func (m *ModelCapabilities) Scan(value any) error {
	if value == nil {
		*m = ModelCapabilities{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("unsupported Scan type for ModelCapabilities")
	}
	return json.Unmarshal(bytes, m)
}

// StringSlice 字符串 JSON 数组
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value any) error {
	if value == nil {
		*s = StringSlice{}
		return nil
	}
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("unsupported Scan type for StringSlice")
	}
	return json.Unmarshal(bytes, s)
}

type Model struct {
	ID              uint64            `gorm:"primaryKey" json:"id"`
	ModelName       string            `gorm:"size:128;uniqueIndex;not null" json:"model_name"`
	DisplayName     *string           `gorm:"size:255" json:"display_name,omitempty"`
	// UpstreamName is the model name to send to the upstream provider.
	// If empty, the ModelName is used as-is.
	UpstreamName    *string           `gorm:"size:128" json:"upstream_name,omitempty"`
	Type            ModelType         `gorm:"size:32;not null" json:"type"`
	VendorID        *uint64           `json:"vendor_id,omitempty"`
	Endpoints       EndpointTypes     `gorm:"type:json" json:"endpoints,omitempty"`
	Capabilities    ModelCapabilities `gorm:"type:json" json:"capabilities,omitempty"`
	ContextWindow   int               `gorm:"not null;default:0" json:"context_window"`
	MaxOutputTokens int               `gorm:"not null;default:0" json:"max_output_tokens"`
	InputModalities StringSlice       `gorm:"type:json" json:"input_modalities,omitempty"`
	OutputModalities StringSlice      `gorm:"type:json" json:"output_modalities,omitempty"`
	MatchRule       ModelMatchRule    `gorm:"not null;default:0" json:"match_rule"`
	Status          int               `gorm:"not null;default:1" json:"status"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

func (Model) TableName() string {
	return "models"
}
