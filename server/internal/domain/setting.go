package domain

import "time"

type Setting struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"size:128;not null;uniqueIndex" json:"key"`
	Value       string    `gorm:"type:text;not null" json:"value"`
	Type        string    `gorm:"size:32;not null;default:'string'" json:"type"`
	Category    string    `gorm:"size:64;not null;default:''" json:"category"`
	Description string    `gorm:"size:255" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Setting) TableName() string { return "settings" }
