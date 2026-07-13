package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type QuotaPackageRepository struct {
	db *gorm.DB
}

func NewQuotaPackageRepository(db *gorm.DB) *QuotaPackageRepository {
	return &QuotaPackageRepository{db: db}
}

func (r *QuotaPackageRepository) Create(ctx context.Context, p *domain.QuotaPackage) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *QuotaPackageRepository) FindByID(ctx context.Context, id uint64) (*domain.QuotaPackage, error) {
	var p domain.QuotaPackage
	if err := r.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *QuotaPackageRepository) Update(ctx context.Context, p *domain.QuotaPackage) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *QuotaPackageRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.QuotaPackage{}, id).Error
}

func (r *QuotaPackageRepository) List(ctx context.Context, onlyEnabled bool, page, pageSize int, keyword string) ([]domain.QuotaPackage, int64, error) {
	var list []domain.QuotaPackage
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.QuotaPackage{})
	if onlyEnabled {
		query = query.Where("status = ?", domain.QuotaPackageEnabled)
	}
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
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
