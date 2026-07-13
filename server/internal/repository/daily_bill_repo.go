package repository

import (
	"context"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type DailyBillRepository struct {
	db *gorm.DB
}

func NewDailyBillRepository(db *gorm.DB) *DailyBillRepository {
	return &DailyBillRepository{db: db}
}

func (r *DailyBillRepository) CreateBatch(ctx context.Context, tx *gorm.DB, bills []domain.DailyBill) error {
	if tx != nil {
		return tx.WithContext(ctx).CreateInBatches(bills, 100).Error
	}
	return r.db.WithContext(ctx).CreateInBatches(bills, 100).Error
}

func (r *DailyBillRepository) DeleteByDate(ctx context.Context, tx *gorm.DB, date time.Time) error {
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)
	if tx != nil {
		return tx.WithContext(ctx).Where("bill_date >= ? AND bill_date < ?", start, end).Delete(&domain.DailyBill{}).Error
	}
	return r.db.WithContext(ctx).Where("bill_date >= ? AND bill_date < ?", start, end).Delete(&domain.DailyBill{}).Error
}

func (r *DailyBillRepository) ListByUserAndDateRange(ctx context.Context, userID uint64, start, end time.Time, page, pageSize int) ([]domain.DailyBill, int64, error) {
	var list []domain.DailyBill
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.DailyBill{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	query = query.Where("bill_date >= ? AND bill_date <= ?", start, end)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("bill_date DESC, model_name ASC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}
