package domain

import "time"

type PromptVersion struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	PromptID  uint64    `gorm:"not null;index" json:"prompt_id"`
	Title     string    `gorm:"size:255;not null" json:"title"`
	Content   string    `gorm:"type:longtext;not null" json:"content"`
	Variables *string   `gorm:"type:json" json:"variables,omitempty"`
	Tags      *string   `gorm:"type:json" json:"tags,omitempty"`
	AuthorID  uint64    `gorm:"not null" json:"author_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (PromptVersion) TableName() string { return "prompt_versions" }
