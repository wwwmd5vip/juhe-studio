package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type ReleaseRepository struct {
	db *gorm.DB
}

func NewReleaseRepository(db *gorm.DB) *ReleaseRepository {
	return &ReleaseRepository{db: db}
}

func (r *ReleaseRepository) Create(ctx context.Context, release *domain.Release) error {
	return r.db.WithContext(ctx).Create(release).Error
}

func (r *ReleaseRepository) FindByID(ctx context.Context, id uint64) (*domain.Release, error) {
	var rel domain.Release
	if err := r.db.WithContext(ctx).First(&rel, id).Error; err != nil {
		return nil, err
	}
	return &rel, nil
}

func (r *ReleaseRepository) List(ctx context.Context, page, pageSize int, keyword string) ([]domain.Release, int64, error) {
	var releases []domain.Release
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Release{})
	if keyword != "" {
		query = query.Where("version LIKE ? OR platform LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&releases).Error; err != nil {
		return nil, 0, err
	}

	return releases, total, nil
}

func (r *ReleaseRepository) Update(ctx context.Context, release *domain.Release) error {
	return r.db.WithContext(ctx).Save(release).Error
}

func (r *ReleaseRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Release{}, id).Error
}

func (r *ReleaseRepository) GetLatest(ctx context.Context, platform string) (*domain.Release, error) {
	var rel domain.Release
	if err := r.db.WithContext(ctx).
		Where("status = ? AND platform = ?", 1, platform).
		Order("created_at DESC").
		First(&rel).Error; err != nil {
		return nil, err
	}
	return &rel, nil
}
