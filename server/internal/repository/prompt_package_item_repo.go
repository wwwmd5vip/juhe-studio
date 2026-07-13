package repository

import (
	"context"
	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type PromptPackageItemRepository struct{ db *gorm.DB }

func NewPromptPackageItemRepository(db *gorm.DB) *PromptPackageItemRepository { return &PromptPackageItemRepository{db: db} }

func (r *PromptPackageItemRepository) SetItems(ctx context.Context, packageID uint64, items []domain.PromptPackageItem) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("package_id = ?", packageID).Delete(&domain.PromptPackageItem{}).Error; err != nil { return err }
		if len(items) == 0 { return nil }
		return tx.CreateInBatches(items, 100).Error
	})
}

func (r *PromptPackageItemRepository) ListByPackageID(ctx context.Context, packageID uint64) ([]domain.PromptPackageItem, error) {
	var list []domain.PromptPackageItem
	if err := r.db.WithContext(ctx).Where("package_id = ?", packageID).Order("sort_order ASC, created_at ASC").Find(&list).Error; err != nil { return nil, err }
	return list, nil
}
