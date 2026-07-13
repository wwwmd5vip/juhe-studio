package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type ModelRepository struct {
	db *gorm.DB
}

func NewModelRepository(db *gorm.DB) *ModelRepository {
	return &ModelRepository{db: db}
}

func (r *ModelRepository) Create(ctx context.Context, model *domain.Model) error {
	return r.db.WithContext(ctx).Create(model).Error
}

func (r *ModelRepository) FirstOrCreate(ctx context.Context, model *domain.Model) error {
	return r.db.WithContext(ctx).
		Where(domain.Model{ModelName: model.ModelName}).
		FirstOrCreate(model).Error
}

func (r *ModelRepository) FindByID(ctx context.Context, id uint64) (*domain.Model, error) {
	var m domain.Model
	if err := r.db.WithContext(ctx).First(&m, id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ModelRepository) FindByName(ctx context.Context, name string) (*domain.Model, error) {
	var m domain.Model
	if err := r.db.WithContext(ctx).Where("model_name = ?", name).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ModelRepository) List(ctx context.Context, page, pageSize int, keyword, typeFilter string) ([]domain.Model, int64, error) {
	var models []domain.Model
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Model{})
	if keyword != "" {
		query = query.Where("model_name LIKE ? OR display_name LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if typeFilter != "" {
		query = query.Where("type = ?", typeFilter)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}

	return models, total, nil
}

func (r *ModelRepository) ListByChannel(ctx context.Context, page, pageSize int, keyword string, channelID uint64) ([]domain.Model, int64, error) {
	var channel domain.Channel
	if err := r.db.WithContext(ctx).First(&channel, channelID).Error; err != nil {
		return nil, 0, err
	}

	modelNames := SplitComma(channel.Models)
	if len(modelNames) == 0 {
		return []domain.Model{}, 0, nil
	}

	var models []domain.Model
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Model{}).Where("model_name IN ?", modelNames)
	if keyword != "" {
		query = query.Where("model_name LIKE ? OR display_name LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}

	return models, total, nil
}

func (r *ModelRepository) Update(ctx context.Context, model *domain.Model) error {
	return r.db.WithContext(ctx).Save(model).Error
}

func (r *ModelRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Model{}, id).Error
}

func (r *ModelRepository) FindVendorByName(ctx context.Context, name string) (*domain.Vendor, error) {
	var v domain.Vendor
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&v).Error; err != nil {
		return nil, err
	}
	return &v, nil
}

type ModelTypeAndCapabilities struct {
	ModelType    string
	Capabilities []string
}

// FindTypeAndCapabilitiesByNames 返回 model_name → {type, capabilities} 的映射
func (r *ModelRepository) FindTypeAndCapabilitiesByNames(ctx context.Context, names []string) (map[string]ModelTypeAndCapabilities, error) {
	if len(names) == 0 {
		return nil, nil
	}
	type row struct {
		ModelName    string `gorm:"column:model_name"`
		Type         string `gorm:"column:type"`
		Capabilities string `gorm:"column:capabilities"`
	}
	var rows []row
	if err := r.db.WithContext(ctx).Model(&domain.Model{}).
		Select("model_name, type, capabilities").
		Where("model_name IN ?", names).
		Find(&rows).Error; err != nil {
		return nil, err
	}

	resultMap := make(map[string]ModelTypeAndCapabilities, len(rows))
	for _, r := range rows {
		var caps []string
		if r.Capabilities != "" && r.Capabilities != "null" {
			if err := json.Unmarshal([]byte(r.Capabilities), &caps); err != nil {
				return nil, fmt.Errorf("unmarshal capabilities for model %s: %w", r.ModelName, err)
			}
		}
		resultMap[r.ModelName] = ModelTypeAndCapabilities{
			ModelType:    r.Type,
			Capabilities: caps,
		}
	}
	return resultMap, nil
}
