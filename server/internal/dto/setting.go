package dto

import "time"

type SettingInfo struct {
	ID          uint64      `json:"id"`
	Key         string      `json:"key"`
	Value       string      `json:"value"`
	Type        string      `json:"type"`
	Category    string      `json:"category"`
	Description string      `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UpsertSettingRequest struct {
	Key         string `json:"key" binding:"required,max=128"`
	Value       string `json:"value" binding:"required"`
	Type        string `json:"type" binding:"omitempty,oneof=string json bool number"`
	Category    string `json:"category" binding:"max=64"`
	Description string `json:"description" binding:"max=255"`
}

type BulkUpsertSettingRequest struct {
	Settings []SettingItem `json:"settings" binding:"required,min=1,dive"`
}

type SettingItem struct {
	Key         string `json:"key" binding:"required,max=128"`
	Value       string `json:"value" binding:"required"`
	Type        string `json:"type" binding:"omitempty,oneof=string json bool number"`
	Category    string `json:"category" binding:"max=64"`
	Description string `json:"description" binding:"max=255"`
}

type TestEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
}
