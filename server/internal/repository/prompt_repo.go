package repository

import (
	"context"
	"strings"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type PromptRepository struct {
	db *gorm.DB
}

func NewPromptRepository(db *gorm.DB) *PromptRepository {
	return &PromptRepository{db: db}
}

// ---------- Category ----------

func (r *PromptRepository) CreateCategory(ctx context.Context, c *domain.PromptCategory) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *PromptRepository) FindCategoryByID(ctx context.Context, id uint64) (*domain.PromptCategory, error) {
	var c domain.PromptCategory
	if err := r.db.WithContext(ctx).First(&c, id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PromptRepository) FindCategoryByName(ctx context.Context, name string) (*domain.PromptCategory, error) {
	var c domain.PromptCategory
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PromptRepository) ListCategoriesByType(ctx context.Context, typ string, page, pageSize int) ([]domain.PromptCategory, int64, error) {
	var list []domain.PromptCategory
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.PromptCategory{}).Where("type = ?", typ)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if err := query.Order("sort_order ASC, created_at DESC").Offset(offset).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *PromptRepository) UpdateCategory(ctx context.Context, c *domain.PromptCategory) error {
	return r.db.WithContext(ctx).Save(c).Error
}

func (r *PromptRepository) DeleteCategory(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.PromptCategory{}, id).Error
}

func (r *PromptRepository) CountPromptsByCategory(ctx context.Context, categoryID uint64) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&domain.Prompt{}).Where("category_id = ?", categoryID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// ---------- Prompt ----------

type PromptFilter struct {
	Type       string
	Status     *int
	CategoryID *uint64
	Tag        string
	Keyword    string
	Page       int
	PageSize   int
}

func (r *PromptRepository) CreatePrompt(ctx context.Context, p *domain.Prompt) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *PromptRepository) FindPromptByID(ctx context.Context, id uint64) (*domain.Prompt, error) {
	var p domain.Prompt
	if err := r.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PromptRepository) ListPrompts(ctx context.Context, filter PromptFilter) ([]domain.Prompt, int64, error) {
	var list []domain.Prompt
	var total int64
	query := r.db.WithContext(ctx).Model(&domain.Prompt{}).Where("type = ?", filter.Type)
	if filter.Status != nil {
		query = query.Where("status = ?", *filter.Status)
	}
	if filter.CategoryID != nil {
		query = query.Where("category_id = ?", *filter.CategoryID)
	}
	if strings.TrimSpace(filter.Tag) != "" {
		query = query.Where("JSON_SEARCH(tags, 'one', ?) IS NOT NULL", strings.TrimSpace(filter.Tag))
	}
	if strings.TrimSpace(filter.Keyword) != "" {
		kw := "%" + strings.ToLower(strings.TrimSpace(filter.Keyword)) + "%"
		query = query.Where("LOWER(title) LIKE ? OR LOWER(content) LIKE ?", kw, kw)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (filter.Page - 1) * filter.PageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(filter.PageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *PromptRepository) UpdatePrompt(ctx context.Context, p *domain.Prompt) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *PromptRepository) DeletePrompt(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Prompt{}, id).Error
}
