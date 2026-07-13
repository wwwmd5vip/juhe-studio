package domain

import "time"

type EmailVerification struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Email     string    `gorm:"uniqueIndex;size:255;not null" json:"email"`
	Code      string    `gorm:"size:10;not null" json:"-"`
	Verified  bool      `gorm:"not null;default:false" json:"verified"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
