package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RedemptionRepository struct {
	db *gorm.DB
}

func NewRedemptionRepository(db *gorm.DB) *RedemptionRepository {
	return &RedemptionRepository{db: db}
}

func (r *RedemptionRepository) CreateBatch(ctx context.Context, tx *gorm.DB, codes []*domain.Redemption) error {
	if tx != nil {
		return tx.WithContext(ctx).CreateInBatches(codes, 100).Error
	}
	return r.db.WithContext(ctx).CreateInBatches(codes, 100).Error
}

func (r *RedemptionRepository) ExistsByCode(ctx context.Context, code string) (bool, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&domain.Redemption{}).Where("code = ?", code).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *RedemptionRepository) FindByCodeForUpdate(ctx context.Context, tx *gorm.DB, code string) (*domain.Redemption, error) {
	var rd domain.Redemption
	if tx != nil {
		if err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).Where("code = ?", code).First(&rd).Error; err != nil {
			return nil, err
		}
		return &rd, nil
	}
	if err := r.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).Where("code = ?", code).First(&rd).Error; err != nil {
		return nil, err
	}
	return &rd, nil
}

func (r *RedemptionRepository) FindByID(ctx context.Context, id uint64) (*domain.Redemption, error) {
	var rd domain.Redemption
	if err := r.db.WithContext(ctx).First(&rd, id).Error; err != nil {
		return nil, err
	}
	return &rd, nil
}

func (r *RedemptionRepository) Update(ctx context.Context, tx *gorm.DB, rd *domain.Redemption) error {
	if tx != nil {
		return tx.WithContext(ctx).Save(rd).Error
	}
	return r.db.WithContext(ctx).Save(rd).Error
}

func (r *RedemptionRepository) DeleteUnused(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Where("id = ? AND status = ?", id, domain.RedemptionUnused).Delete(&domain.Redemption{}).Error
}

func (r *RedemptionRepository) List(ctx context.Context, status *int, page, pageSize int) ([]domain.Redemption, int64, error) {
	var list []domain.Redemption
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.Redemption{})
	if status != nil {
		query = query.Where("status = ?", *status)
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
