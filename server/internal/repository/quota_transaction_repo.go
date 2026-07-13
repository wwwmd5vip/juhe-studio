package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type QuotaTransactionRepository struct {
	db *gorm.DB
}

func NewQuotaTransactionRepository(db *gorm.DB) *QuotaTransactionRepository {
	return &QuotaTransactionRepository{db: db}
}

func (r *QuotaTransactionRepository) Create(ctx context.Context, tx *gorm.DB, t *domain.QuotaTransaction) error {
	if tx != nil {
		return tx.WithContext(ctx).Create(t).Error
	}
	return r.db.WithContext(ctx).Create(t).Error
}

func (r *QuotaTransactionRepository) ListByUserID(ctx context.Context, userID uint64, page, pageSize int) ([]domain.QuotaTransaction, int64, error) {
	var list []domain.QuotaTransaction
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.QuotaTransaction{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

// ListFiltered supports optional filters for querying quota transactions.
func (r *QuotaTransactionRepository) ListFiltered(ctx context.Context, page, pageSize int, userID uint64, trType string, startDate, endDate string) ([]domain.QuotaTransaction, int64, error) {
	query := r.db.WithContext(ctx).Model(&domain.QuotaTransaction{})

	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if trType != "" {
		query = query.Where("type = ?", trType)
	}
	if startDate != "" {
		if isValidDate(startDate) {
			query = query.Where("created_at >= ?", startDate)
		}
	}
	if endDate != "" {
		if isValidDate(endDate) {
			query = query.Where("created_at <= ?", endDate+" 23:59:59")
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	var list []domain.QuotaTransaction
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}
