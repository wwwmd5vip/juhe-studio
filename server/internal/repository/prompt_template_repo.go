package repository

import (
	"context"
	"strings"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type PromptTemplateRepository struct {
	db *gorm.DB
}

func NewPromptTemplateRepository(db *gorm.DB) *PromptTemplateRepository {
	return &PromptTemplateRepository{db: db}
}

func (r *PromptTemplateRepository) List(ctx context.Context, category string, keyword string, page, pageSize int) ([]domain.PromptTemplate, int64, error) {
	var list []domain.PromptTemplate
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.PromptTemplate{})

	if strings.TrimSpace(category) != "" {
		query = query.Where("category = ?", strings.TrimSpace(category))
	}
	if strings.TrimSpace(keyword) != "" {
		kw := "%" + strings.ToLower(strings.TrimSpace(keyword)) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(content) LIKE ?", kw, kw)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("usage_count DESC, created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

func (r *PromptTemplateRepository) IncrementUsage(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Model(&domain.PromptTemplate{}).
		Where("id = ?", id).
		UpdateColumn("usage_count", gorm.Expr("usage_count + 1")).Error
}
