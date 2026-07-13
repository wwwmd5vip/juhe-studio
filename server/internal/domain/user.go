package domain

import (
	"time"
)

type Role int

const (
	RoleUser  Role = 1
	RoleAdmin Role = 10
	RoleRoot  Role = 100
)

type UserStatus int

const (
	UserDisabled UserStatus = 0
	UserActive   UserStatus = 1
	UserPending  UserStatus = 2 // registered but email not yet verified
)

type User struct {
	ID           uint64     `gorm:"primaryKey" json:"id"`
	Username     string     `gorm:"size:64;uniqueIndex;not null" json:"username"`
	Email        *string    `gorm:"type:varchar(255);uniqueIndex" json:"email,omitempty"`
	PasswordHash string     `gorm:"size:255;not null" json:"-"`
	Role         Role       `gorm:"not null;default:1" json:"role"`
	Status       UserStatus `gorm:"not null;default:1" json:"status"`
	Group        string     `gorm:"size:64;not null;default:'default'" json:"group"`
	Quota        int64      `gorm:"not null;default:0" json:"quota"`
	UsedQuota             int64      `gorm:"not null;default:0" json:"used_quota"`
	AccessToken           *string    `gorm:"size:255;uniqueIndex" json:"-"`
	PlaygroundTrialsUsed  int        `gorm:"not null;default:0" json:"playground_trials_used"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}
