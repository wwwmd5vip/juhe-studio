package repository

import (
	"context"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserSubscriptionRepository struct {
	db *gorm.DB
}

func NewUserSubscriptionRepository(db *gorm.DB) *UserSubscriptionRepository {
	return &UserSubscriptionRepository{db: db}
}

func (r *UserSubscriptionRepository) Create(ctx context.Context, tx *gorm.DB, sub *domain.UserSubscription) error {
	if tx != nil {
		return tx.WithContext(ctx).Create(sub).Error
	}
	return r.db.WithContext(ctx).Create(sub).Error
}

func (r *UserSubscriptionRepository) FindByID(ctx context.Context, id uint64) (*domain.UserSubscription, error) {
	var sub domain.UserSubscription
	if err := r.db.WithContext(ctx).First(&sub, id).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *UserSubscriptionRepository) FindByIDForUpdate(ctx context.Context, tx *gorm.DB, id uint64) (*domain.UserSubscription, error) {
	var sub domain.UserSubscription
	if tx != nil {
		if err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&sub, id).Error; err != nil {
			return nil, err
		}
		return &sub, nil
	}
	if err := r.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&sub, id).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *UserSubscriptionRepository) Update(ctx context.Context, tx *gorm.DB, sub *domain.UserSubscription) error {
	if tx != nil {
		return tx.WithContext(ctx).Save(sub).Error
	}
	return r.db.WithContext(ctx).Save(sub).Error
}

func (r *UserSubscriptionRepository) ListByUserID(ctx context.Context, userID uint64, page, pageSize int) ([]domain.UserSubscription, int64, error) {
	var list []domain.UserSubscription
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.UserSubscription{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *UserSubscriptionRepository) FindPendingRenewal(ctx context.Context, before time.Time, page, pageSize int) ([]domain.UserSubscription, int64, error) {
	var list []domain.UserSubscription
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.UserSubscription{}).
		Where("status = ? AND expires_at <= ?", domain.UserSubscriptionActive, before)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("expires_at ASC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

// FindPendingRenewalAfterID uses cursor-based pagination (WHERE id > afterID)
// to avoid skipping subscriptions whose expires_at changes after renewal.
func (r *UserSubscriptionRepository) FindPendingRenewalAfterID(ctx context.Context, before time.Time, afterID uint64, limit int) ([]domain.UserSubscription, error) {
	var list []domain.UserSubscription
	query := r.db.WithContext(ctx).Model(&domain.UserSubscription{}).
		Where("status = ? AND expires_at <= ?", domain.UserSubscriptionActive, before)
	if afterID > 0 {
		query = query.Where("id > ?", afterID)
	}
	if err := query.Order("id ASC").Limit(limit).Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}
