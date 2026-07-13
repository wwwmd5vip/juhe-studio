package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TopUpRepository struct {
	db *gorm.DB
}

func NewTopUpRepository(db *gorm.DB) *TopUpRepository {
	return &TopUpRepository{db: db}
}

func (r *TopUpRepository) Create(ctx context.Context, tx *gorm.DB, t *domain.TopUp) error {
	if tx != nil {
		return tx.WithContext(ctx).Create(t).Error
	}
	return r.db.WithContext(ctx).Create(t).Error
}

func (r *TopUpRepository) FindByID(ctx context.Context, id uint64) (*domain.TopUp, error) {
	var t domain.TopUp
	if err := r.db.WithContext(ctx).First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TopUpRepository) FindByIDForUpdate(ctx context.Context, tx *gorm.DB, id uint64) (*domain.TopUp, error) {
	var t domain.TopUp
	if tx != nil {
		if err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&t, id).Error; err != nil {
			return nil, err
		}
		return &t, nil
	}
	if err := r.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TopUpRepository) Update(ctx context.Context, tx *gorm.DB, t *domain.TopUp) error {
	if tx != nil {
		return tx.WithContext(ctx).Save(t).Error
	}
	return r.db.WithContext(ctx).Save(t).Error
}

func (r *TopUpRepository) List(ctx context.Context, userID *uint64, page, pageSize int, status, startDate, endDate string) ([]domain.TopUp, int64, error) {
	var list []domain.TopUp
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.TopUp{})
	if userID != nil && *userID > 0 {
		query = query.Where("user_id = ?", *userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if startDate != "" {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != "" {
		query = query.Where("created_at <= ?", endDate+" 23:59:59")
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
