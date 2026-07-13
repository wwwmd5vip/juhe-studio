package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrPromptNotFound             = errors.New("prompt not found")
	ErrPromptNotPublished         = errors.New("prompt not published")
	ErrPromptVersionNotFound      = errors.New("prompt version not found")
	ErrPromptNotPackage           = errors.New("prompt is not a package")
	ErrPromptPackageItemNotFound  = errors.New("prompt package item not found")
	ErrPromptPackageSelfReference = errors.New("package cannot reference itself")
	ErrCategoryNotFound           = errors.New("category not found")
	ErrCategoryNameExists         = errors.New("category name already exists")
	ErrCategoryHasPrompts         = errors.New("category still has prompts")
	ErrCategoryTypeMismatch       = errors.New("category type mismatch")
	ErrSortOrderOutOfRange        = errors.New("sort_order out of range")
	ErrTooManyVariables           = errors.New("too many variables")
	ErrVariableMissing            = errors.New("missing required variable")
	ErrInvalidVariableKey         = errors.New("invalid variable key")
	ErrInvalidVariableType        = errors.New("variable value must be string")
	ErrInvalidPromptType          = errors.New("invalid prompt type")
)

var variableKeyRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

type PromptService struct {
	db              *gorm.DB
	promptRepo      *repository.PromptRepository
	versionRepo     *repository.PromptVersionRepository
	packageItemRepo *repository.PromptPackageItemRepository
}

func NewPromptService(db *gorm.DB, promptRepo *repository.PromptRepository, versionRepo *repository.PromptVersionRepository, packageItemRepo *repository.PromptPackageItemRepository) *PromptService {
	return &PromptService{db: db, promptRepo: promptRepo, versionRepo: versionRepo, packageItemRepo: packageItemRepo}
}

func (s *PromptService) normalizeTags(tags []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if len(t) > 32 {
			continue
		}
		t = strings.ToLower(t)
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	if len(out) > 10 {
		out = out[:10]
	}
	return out
}

func (s *PromptService) validateVariables(variables map[string]string) error {
	if len(variables) > 32 {
		return ErrTooManyVariables
	}
	for k, v := range variables {
		if len(k) > 64 || !variableKeyRe.MatchString(k) {
			return fmt.Errorf("%w: %s", ErrInvalidVariableKey, k)
		}
		if len(v) > 256 {
			return fmt.Errorf("%w: %s", ErrInvalidVariableType, k)
		}
	}
	return nil
}

// ---------- Category ----------

func (s *PromptService) CreateCategory(ctx context.Context, promptType string, req *dto.CreateCategoryRequest) (*domain.PromptCategory, error) {
	if err := s.validatePromptType(promptType); err != nil {
		return nil, err
	}
	if req.SortOrder < -32768 || req.SortOrder > 32767 {
		return nil, ErrSortOrderOutOfRange
	}
	_, err := s.promptRepo.FindCategoryByName(ctx, req.Name)
	if err == nil {
		return nil, ErrCategoryNameExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	c := &domain.PromptCategory{
		Name:      req.Name,
		Type:      promptType,
		SortOrder: req.SortOrder,
	}
	if req.Description != "" {
		desc := req.Description
		c.Description = &desc
	}
	if err := s.promptRepo.CreateCategory(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *PromptService) ListCategories(ctx context.Context, promptType string, page, pageSize int) ([]domain.PromptCategory, int64, error) {
	if err := s.validatePromptType(promptType); err != nil {
		return nil, 0, err
	}
	page, pageSize = s.normalizePagination(page, pageSize)
	return s.promptRepo.ListCategoriesByType(ctx, promptType, page, pageSize)
}

func (s *PromptService) GetCategory(ctx context.Context, id uint64) (*domain.PromptCategory, error) {
	c, err := s.promptRepo.FindCategoryByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCategoryNotFound
		}
		return nil, err
	}
	return c, nil
}

func (s *PromptService) UpdateCategory(ctx context.Context, id uint64, req *dto.UpdateCategoryRequest) (*domain.PromptCategory, error) {
	c, err := s.GetCategory(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil && *req.Name != c.Name {
		existing, err := s.promptRepo.FindCategoryByName(ctx, *req.Name)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err == nil && existing.ID != id {
			return nil, ErrCategoryNameExists
		}
		c.Name = *req.Name
	}
	if req.Description != nil {
		c.Description = req.Description
	}
	if req.SortOrder != nil {
		if *req.SortOrder < -32768 || *req.SortOrder > 32767 {
			return nil, ErrSortOrderOutOfRange
		}
		c.SortOrder = *req.SortOrder
	}
	if err := s.promptRepo.UpdateCategory(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *PromptService) DeleteCategory(ctx context.Context, id uint64) error {
	if _, err := s.GetCategory(ctx, id); err != nil {
		return err
	}
	count, err := s.promptRepo.CountPromptsByCategory(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrCategoryHasPrompts
	}
	return s.promptRepo.DeleteCategory(ctx, id)
}

// ---------- Prompt ----------

func (s *PromptService) CreatePrompt(ctx context.Context, authorID uint64, promptType string, req *dto.CreatePromptRequest) (*domain.Prompt, error) {
	if err := s.validatePromptType(promptType); err != nil {
		return nil, err
	}
	if _, err := s.requireCategoryForType(ctx, req.CategoryID, promptType); err != nil {
		return nil, err
	}
	if err := s.validateVariables(req.Variables); err != nil {
		return nil, err
	}
	p := &domain.Prompt{
		Type:       promptType,
		CategoryID: req.CategoryID,
		Title:      req.Title,
		Content:    req.Content,
		Status:     domain.PromptStatus(req.Status),
		AuthorID:   authorID,
	}
	p.SetVariables(req.Variables)
	p.SetTags(s.normalizeTags(req.Tags))
	if err := s.promptRepo.CreatePrompt(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *PromptService) ListPrompts(ctx context.Context, promptType string, page, pageSize int, categoryID *uint64, tag, keyword string, status *int) ([]domain.Prompt, int64, error) {
	if err := s.validatePromptType(promptType); err != nil {
		return nil, 0, err
	}
	page, pageSize = s.normalizePagination(page, pageSize)
	return s.promptRepo.ListPrompts(ctx, repository.PromptFilter{
		Type:       promptType,
		Status:     status,
		CategoryID: categoryID,
		Tag:        tag,
		Keyword:    keyword,
		Page:       page,
		PageSize:   pageSize,
	})
}

func (s *PromptService) GetPrompt(ctx context.Context, id uint64) (*domain.Prompt, error) {
	p, err := s.promptRepo.FindPromptByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPromptNotFound
		}
		return nil, err
	}
	return p, nil
}

func (s *PromptService) UpdatePrompt(ctx context.Context, id uint64, req *dto.UpdatePromptRequest) (*domain.Prompt, error) {
	p, err := s.GetPrompt(ctx, id)
	if err != nil {
		return nil, err
	}
	previousStatus := p.Status
	if req.CategoryID != nil {
		if _, err := s.requireCategoryForType(ctx, *req.CategoryID, p.Type); err != nil {
			return nil, err
		}
		p.CategoryID = *req.CategoryID
	}
	if req.Title != nil {
		p.Title = *req.Title
	}
	if req.Content != nil {
		p.Content = *req.Content
	}
	if req.Status != nil {
		p.Status = domain.PromptStatus(*req.Status)
	}
	if req.Tags != nil {
		p.SetTags(s.normalizeTags(req.Tags))
	}
	if req.Variables != nil {
		if err := s.validateVariables(req.Variables); err != nil {
			return nil, err
		}
		p.SetVariables(req.Variables)
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(p).Error; err != nil {
			return err
		}
		if p.Status == domain.PromptStatusPublished && previousStatus != domain.PromptStatusPublished {
			return createPromptVersion(tx, p)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return p, nil
}

// createPromptVersion inserts a new PromptVersion row within the given transaction.
func createPromptVersion(tx *gorm.DB, p *domain.Prompt) error {
	v := &domain.PromptVersion{
		PromptID:  p.ID,
		Title:     p.Title,
		Content:   p.Content,
		AuthorID:  p.AuthorID,
		Variables: p.Variables,
		Tags:      p.Tags,
	}
	return tx.Create(v).Error
}

func (s *PromptService) PublishPrompt(ctx context.Context, id uint64, authorID uint64) (*domain.Prompt, error) {
	p, err := s.GetPrompt(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.Status == domain.PromptStatusPublished {
		return p, nil
	}
	p.Status = domain.PromptStatusPublished
	p.AuthorID = authorID
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(p).Error; err != nil {
			return err
		}
		return createPromptVersion(tx, p)
	})
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *PromptService) ListPromptVersions(ctx context.Context, promptID uint64, page, pageSize int) ([]domain.PromptVersion, int64, error) {
	page, pageSize = s.normalizePagination(page, pageSize)
	return s.versionRepo.ListByPromptID(ctx, promptID, page, pageSize)
}

func (s *PromptService) RollbackPrompt(ctx context.Context, id uint64, versionID uint64, authorID uint64) (*domain.Prompt, error) {
	p, err := s.GetPrompt(ctx, id)
	if err != nil {
		return nil, err
	}
	v, err := s.versionRepo.FindByID(ctx, versionID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPromptVersionNotFound
		}
		return nil, err
	}
	if v.PromptID != p.ID {
		return nil, ErrPromptVersionNotFound
	}
	p.Title = v.Title
	p.Content = v.Content
	p.Variables = v.Variables
	p.Tags = v.Tags
	p.AuthorID = authorID
	p.Status = domain.PromptStatusPublished
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(p).Error; err != nil {
			return err
		}
		return createPromptVersion(tx, p)
	})
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *PromptService) SetPackageItems(ctx context.Context, packageID uint64, items []struct {
	PromptID  uint64
	SortOrder int
}) error {
	p, err := s.GetPrompt(ctx, packageID)
	if err != nil {
		return err
	}
	if p.Type != domain.PromptTypePackage {
		return ErrPromptNotPackage
	}
	// Validate: no self-reference and all referenced prompts exist.
	if len(items) > 0 {
		ids := make([]uint64, len(items))
		for i, it := range items {
			if it.PromptID == packageID {
				return ErrPromptPackageSelfReference
			}
			ids[i] = it.PromptID
		}
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.Prompt{}).Where("id IN ?", ids).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(ids)) {
			return ErrPromptNotFound
		}
	}
	newItems := make([]domain.PromptPackageItem, 0, len(items))
	for _, it := range items {
		newItems = append(newItems, domain.PromptPackageItem{PackageID: packageID, PromptID: it.PromptID, SortOrder: it.SortOrder})
	}
	return s.packageItemRepo.SetItems(ctx, packageID, newItems)
}

func (s *PromptService) ListPackageItems(ctx context.Context, packageID uint64) ([]domain.PromptPackageItem, error) {
	if _, err := s.GetPrompt(ctx, packageID); err != nil {
		return nil, err
	}
	return s.packageItemRepo.ListByPackageID(ctx, packageID)
}

func (s *PromptService) RenderPackage(ctx context.Context, packageID uint64, variables map[string]string) ([]dto.RenderPackageItemResult, error) {
	p, err := s.GetPrompt(ctx, packageID)
	if err != nil {
		return nil, err
	}
	if p.Type != domain.PromptTypePackage {
		return nil, ErrPromptNotPackage
	}
	if p.Status != domain.PromptStatusPublished {
		return nil, ErrPromptNotPublished
	}
	items, err := s.packageItemRepo.ListByPackageID(ctx, packageID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []dto.RenderPackageItemResult{}, nil
	}
	// Batch query all child prompts to avoid N+1.
	childIDs := make([]uint64, len(items))
	for i, item := range items {
		childIDs[i] = item.PromptID
	}
	var children []domain.Prompt
	if err := s.db.WithContext(ctx).Where("id IN ?", childIDs).Find(&children).Error; err != nil {
		return nil, err
	}
	childMap := make(map[uint64]*domain.Prompt, len(children))
	for i := range children {
		childMap[children[i].ID] = &children[i]
	}
	results := make([]dto.RenderPackageItemResult, 0, len(items))
	for _, item := range items {
		child, ok := childMap[item.PromptID]
		if !ok {
			return nil, ErrPromptNotFound
		}
		content, err := s.renderPromptContent(child, variables)
		if err != nil {
			return nil, err
		}
		results = append(results, dto.RenderPackageItemResult{
			PromptID: child.ID,
			Title:    child.Title,
			Content:  content,
		})
	}
	return results, nil
}

func (s *PromptService) DeletePrompt(ctx context.Context, id uint64) error {
	if _, err := s.GetPrompt(ctx, id); err != nil {
		return err
	}

	// Check if this prompt is referenced as a child item in any other package
	var refCount int64
	if err := s.db.WithContext(ctx).Model(&domain.PromptPackageItem{}).
		Where("prompt_id = ? AND package_id != ?", id, id).Count(&refCount).Error; err != nil {
		return err
	}
	if refCount > 0 {
		return fmt.Errorf("无法删除：该提示词被 %d 个封装功能引用，请先从封装功能中移除后再删除", refCount)
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("prompt_id = ?", id).Delete(&domain.PromptVersion{}).Error; err != nil {
			return err
		}
		if err := tx.Where("package_id = ? OR prompt_id = ?", id, id).Delete(&domain.PromptPackageItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&domain.Prompt{}, id).Error
	})
}

func (s *PromptService) RenderPrompt(ctx context.Context, id uint64, variables map[string]string) (string, error) {
	p, err := s.GetPrompt(ctx, id)
	if err != nil {
		return "", err
	}
	return s.renderPromptContent(p, variables)
}

func (s *PromptService) renderPromptContent(p *domain.Prompt, variables map[string]string) (string, error) {
	if p.Status != domain.PromptStatusPublished {
		return "", ErrPromptNotPublished
	}
	declared := p.GetVariables()
	required := make(map[string]bool, len(declared))
	for name := range declared {
		required[name] = true
	}
	return utils.RenderTemplate(p.Content, variables, required)
}

func (s *PromptService) validatePromptType(promptType string) error {
	if promptType == domain.PromptTypeImage ||
		promptType == domain.PromptTypeAgent ||
		promptType == domain.PromptTypePackage {
		return nil
	}
	return fmt.Errorf("%w: %s", ErrInvalidPromptType, promptType)
}

func (s *PromptService) requireCategoryForType(ctx context.Context, categoryID uint64, promptType string) (*domain.PromptCategory, error) {
	category, err := s.GetCategory(ctx, categoryID)
	if err != nil {
		return nil, err
	}
	if category.Type != promptType {
		return nil, fmt.Errorf("%w: category type %s does not match prompt type %s", ErrCategoryTypeMismatch, category.Type, promptType)
	}
	return category, nil
}

func (s *PromptService) normalizePagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}
