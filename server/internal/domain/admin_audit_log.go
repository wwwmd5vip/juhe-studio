package domain

import (
	"time"
)

// AuditAction represents the type of operation performed
type AuditAction string

const (
	AuditActionCreate AuditAction = "create"
	AuditActionUpdate AuditAction = "update"
	AuditActionDelete AuditAction = "delete"
)

// AuditTargetType represents the type of entity that was modified
type AuditTargetType string

const (
	AuditTargetUser         AuditTargetType = "user"
	AuditTargetChannel      AuditTargetType = "channel"
	AuditTargetToken        AuditTargetType = "token"
	AuditTargetModel        AuditTargetType = "model"
	AuditTargetPricing      AuditTargetType = "pricing"
	AuditTargetVendor       AuditTargetType = "vendor"
	AuditTargetTopUp        AuditTargetType = "top_up"
	AuditTargetQuotaPackage AuditTargetType = "quota_package"
	AuditTargetRelease      AuditTargetType = "release"
	AuditTargetPrompt       AuditTargetType = "prompt"
	AuditTargetSetting      AuditTargetType = "setting"
)

// AdminAuditLog records administrative operations for auditing purposes
type AdminAuditLog struct {
	ID           uint64          `gorm:"primaryKey" json:"id"`
	OperatorID   uint64          `gorm:"not null;index" json:"operator_id"`
	OperatorName string          `gorm:"size:128;not null" json:"operator_name"`
	Action       AuditAction     `gorm:"size:32;not null" json:"action"`
	TargetType   AuditTargetType `gorm:"size:32;not null;index" json:"target_type"`
	TargetID     uint64          `gorm:"not null;index" json:"target_id"`
	OldValue     *string         `gorm:"type:json" json:"old_value,omitempty"`
	NewValue     *string         `gorm:"type:json" json:"new_value,omitempty"`
	Diff         *string         `gorm:"type:json" json:"diff,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

func (AdminAuditLog) TableName() string {
	return "admin_audit_logs"
}
