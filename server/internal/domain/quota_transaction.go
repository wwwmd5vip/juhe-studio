package domain

import "time"

type QuotaTransactionType string

const (
	QuotaTransactionTypeRecharge QuotaTransactionType = "recharge"
	QuotaTransactionTypeConsume  QuotaTransactionType = "consume"
	QuotaTransactionTypeRefund   QuotaTransactionType = "refund"
	QuotaTransactionTypeAdjust   QuotaTransactionType = "adjust"
	QuotaTransactionTypeFreeze   QuotaTransactionType = "freeze"
	QuotaTransactionTypeUnfreeze QuotaTransactionType = "unfreeze"
)

type QuotaTransaction struct {
	ID           uint64               `gorm:"primaryKey" json:"id"`
	UserID       uint64               `gorm:"not null;index" json:"user_id"`
	TokenID      *uint64              `gorm:"index" json:"token_id,omitempty"`
	Type         QuotaTransactionType `gorm:"size:32;not null;index" json:"type"`
	Amount       int64                `gorm:"not null" json:"amount"`
	BalanceAfter int64                `gorm:"not null" json:"balance_after"`
	RelatedID    *string              `gorm:"size:128;index" json:"related_id,omitempty"`
	RelatedType  *string              `gorm:"size:32" json:"related_type,omitempty"`
	Description  *string              `gorm:"size:255" json:"description,omitempty"`
	CreatedAt    time.Time            `json:"created_at"`
}

func (QuotaTransaction) TableName() string { return "quota_transactions" }
