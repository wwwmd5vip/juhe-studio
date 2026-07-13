package domain

import "time"

type Vendor struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:128;uniqueIndex;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	IconURL     *string   `gorm:"size:512" json:"icon_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Vendor) TableName() string {
	return "vendors"
}
