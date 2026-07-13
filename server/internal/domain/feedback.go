package domain

import (
	"time"
)

type Feedback struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Type       string    `gorm:"size:20;not null" json:"type"`
	Title      string    `gorm:"size:200;not null" json:"title"`
	Content    string    `gorm:"size:5000;not null" json:"content"`
	Contact    string    `gorm:"size:200" json:"contact"`
	AppVersion string    `gorm:"size:50" json:"app_version"`
	OS         string    `gorm:"size:50" json:"os"`
	IP         string    `gorm:"size:45" json:"-"`
	UserAgent  string    `gorm:"size:500" json:"-"`
	CreatedAt  time.Time `json:"created_at"`
}

func (Feedback) TableName() string {
	return "feedbacks"
}
