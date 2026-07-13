package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type AdminAuditLogRepository struct {
	db *gorm.DB
}

func NewAdminAuditLogRepository(db *gorm.DB) *AdminAuditLogRepository {
	return &AdminAuditLogRepository{db: db}
}

func (r *AdminAuditLogRepository) Create(ctx context.Context, log *domain.AdminAuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *AdminAuditLogRepository) List(ctx context.Context, page, pageSize int, operatorID uint64, operatorName, action, targetType, startDate, endDate string) ([]domain.AdminAuditLog, int64, error) {
	var logs []domain.AdminAuditLog
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.AdminAuditLog{})
	if operatorID > 0 {
		query = query.Where("operator_id = ?", operatorID)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if targetType != "" {
		query = query.Where("target_type = ?", targetType)
	}
	if operatorName != "" {
		query = query.Where("operator_name LIKE ?", "%"+operatorName+"%")
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

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
