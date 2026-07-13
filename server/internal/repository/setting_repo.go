package repository

import (
	"context"
	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type SettingRepository struct{ db *gorm.DB }

func NewSettingRepository(db *gorm.DB) *SettingRepository { return &SettingRepository{db: db} }

func (r *SettingRepository) Create(ctx context.Context, s *domain.Setting) error {
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *SettingRepository) FindByKey(ctx context.Context, key string) (*domain.Setting, error) {
	var s domain.Setting
	if err := r.db.WithContext(ctx).Where("`key` = ?", key).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *SettingRepository) Update(ctx context.Context, s *domain.Setting) error {
	return r.db.WithContext(ctx).Save(s).Error
}

func (r *SettingRepository) Delete(ctx context.Context, key string) error {
	return r.db.WithContext(ctx).Where("key = ?", key).Delete(&domain.Setting{}).Error
}

func (r *SettingRepository) List(ctx context.Context, page, pageSize int, category string) ([]domain.Setting, int64, error) {
	var list []domain.Setting
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.Setting{})
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("`key` ASC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *SettingRepository) ListAll(ctx context.Context) ([]domain.Setting, error) {
	var list []domain.Setting
	if err := r.db.WithContext(ctx).Order("`key` ASC").Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}
