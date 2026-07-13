package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type SubscriptionPlanRepository struct {
	db *gorm.DB
}

func NewSubscriptionPlanRepository(db *gorm.DB) *SubscriptionPlanRepository {
	return &SubscriptionPlanRepository{db: db}
}

func (r *SubscriptionPlanRepository) Create(ctx context.Context, tx *gorm.DB, plan *domain.SubscriptionPlan) error {
	if tx != nil {
		return tx.WithContext(ctx).Create(plan).Error
	}
	return r.db.WithContext(ctx).Create(plan).Error
}

func (r *SubscriptionPlanRepository) FindByID(ctx context.Context, id uint64) (*domain.SubscriptionPlan, error) {
	var plan domain.SubscriptionPlan
	if err := r.db.WithContext(ctx).First(&plan, id).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *SubscriptionPlanRepository) Update(ctx context.Context, tx *gorm.DB, plan *domain.SubscriptionPlan) error {
	if tx != nil {
		return tx.WithContext(ctx).Save(plan).Error
	}
	return r.db.WithContext(ctx).Save(plan).Error
}

func (r *SubscriptionPlanRepository) List(ctx context.Context, onlyEnabled bool, page, pageSize int) ([]domain.SubscriptionPlan, int64, error) {
	var list []domain.SubscriptionPlan
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.SubscriptionPlan{})
	if onlyEnabled {
		query = query.Where("status = ?", domain.SubscriptionPlanEnabled)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("sort_order ASC, created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *SubscriptionPlanRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.SubscriptionPlan{}, id).Error
}
