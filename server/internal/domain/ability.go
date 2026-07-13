package domain

import "time"

type Ability struct {
	ID         uint64    `gorm:"primaryKey" json:"id"`
	Group      string    `gorm:"size:64;not null;index:idx_ability_group_model,unique" json:"group"`
	ModelName  string    `gorm:"size:128;not null;index:idx_ability_group_model,unique" json:"model_name"`
	ChannelID  uint64    `gorm:"not null;index;index:idx_ability_group_model,unique" json:"channel_id"`
	Priority   int       `gorm:"not null;default:0" json:"priority"`
	Weight     int       `gorm:"not null;default:1" json:"weight"`
	Enabled    bool      `gorm:"not null;default:true" json:"enabled"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (Ability) TableName() string {
	return "abilities"
}
