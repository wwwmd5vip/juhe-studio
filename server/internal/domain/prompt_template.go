package domain

import "time"

type PromptTemplate struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name       string    `gorm:"size:200;not null" json:"name"`
	Category   string    `gorm:"size:50;not null;index" json:"category"` // coding, writing, analysis, creative, business
	Content    string    `gorm:"type:text;not null" json:"content"`       // template with {{variable}} placeholders
	Variables  string    `gorm:"size:500" json:"variables"`               // comma-separated: "topic,language"
	UsageCount int64     `gorm:"default:0" json:"usage_count"`
	IsSystem   bool      `gorm:"default:true" json:"is_system"`
	CreatedAt  time.Time `json:"created_at"`
}
