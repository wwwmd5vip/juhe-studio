package domain

import "time"

type PromptPackageItem struct {
	ID        uint64 `gorm:"primaryKey" json:"id"`
	PackageID uint64 `gorm:"not null;index:idx_package_items_package_id" json:"package_id"`
	PromptID  uint64 `gorm:"not null;index:idx_package_items_prompt_id" json:"prompt_id"`
	SortOrder int    `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (PromptPackageItem) TableName() string { return "prompt_package_items" }
