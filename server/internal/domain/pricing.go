package domain

import "time"

type BillingMode string

const (
	BillingModeToken  BillingMode = "token"
	BillingModeFixed  BillingMode = "fixed"
	BillingModeTiered BillingMode = "tiered"
)

type Pricing struct {
	ID                uint64      `gorm:"primaryKey" json:"id"`
	ModelName         string      `gorm:"size:128;not null;index:idx_pricing_model_group,unique" json:"model_name"`
	Group             string      `gorm:"size:64;not null;default:'default';index:idx_pricing_model_group,unique" json:"group"`
	BillingMode       BillingMode `gorm:"size:32;not null" json:"billing_mode"`
	ModelRatio        float64     `gorm:"type:decimal(20,8);not null;default:1" json:"model_ratio"`
	CompletionRatio   float64     `gorm:"type:decimal(20,8);not null;default:1" json:"completion_ratio"`
	CachedTokensRatio float64     `gorm:"type:decimal(20,8);not null;default:1" json:"cached_tokens_ratio"`
	FixedPriceCents   *int64      `json:"fixed_price_cents,omitempty"`
	ImageRatio        float64     `gorm:"type:decimal(20,8);default:1" json:"image_ratio"`
	TieredExpr        *string     `gorm:"type:text" json:"tiered_expr,omitempty"`
	EffectiveFrom     time.Time   `gorm:"not null" json:"effective_from"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
}

func (Pricing) TableName() string {
	return "pricings"
}
