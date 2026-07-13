package repository

import (
	"context"
	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type PromptVersionRepository struct{ db *gorm.DB }

func NewPromptVersionRepository(db *gorm.DB) *PromptVersionRepository { return &PromptVersionRepository{db: db} }

func (r *PromptVersionRepository) Create(ctx context.Context, v *domain.PromptVersion) error {
	return r.db.WithContext(ctx).Create(v).Error
}

func (r *PromptVersionRepository) ListByPromptID(ctx context.Context, promptID uint64, page, pageSize int) ([]domain.PromptVersion, int64, error) {
	var list []domain.PromptVersion
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.PromptVersion{}).Where("prompt_id = ?", promptID)
	if err := query.Count(&total).Error; err != nil { return nil, 0, err }
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil { return nil, 0, err }
	return list, total, nil
}

func (r *PromptVersionRepository) FindByID(ctx context.Context, id uint64) (*domain.PromptVersion, error) {
	var v domain.PromptVersion
	if err := r.db.WithContext(ctx).First(&v, id).Error; err != nil { return nil, err }
	return &v, nil
}
