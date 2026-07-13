package repository

import (
	"context"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PricingRepository struct {
	db *gorm.DB
}

func NewPricingRepository(db *gorm.DB) *PricingRepository {
	return &PricingRepository{db: db}
}

func (r *PricingRepository) Create(ctx context.Context, pricing *domain.Pricing) error {
	return r.db.WithContext(ctx).Create(pricing).Error
}

func (r *PricingRepository) FindByID(ctx context.Context, id uint64) (*domain.Pricing, error) {
	var p domain.Pricing
	if err := r.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PricingRepository) FindByModelAndGroup(ctx context.Context, modelName, group string) (*domain.Pricing, error) {
	var p domain.Pricing
	err := r.db.WithContext(ctx).
		Where("model_name = ? AND `group` = ? AND effective_from <= ?", modelName, group, time.Now().UTC()).
		Order("effective_from DESC").
		First(&p).Error
	return &p, err
}

// FindByModelAndGroupExact finds a pricing by model_name + group without effective_from filtering.
// Used for existence checks during batch upsert.
func (r *PricingRepository) FindByModelAndGroupExact(ctx context.Context, modelName, group string) (*domain.Pricing, error) {
	var p domain.Pricing
	err := r.db.WithContext(ctx).
		Where("model_name = ? AND `group` = ?", modelName, group).
		First(&p).Error
	return &p, err
}

func (r *PricingRepository) List(ctx context.Context, page, pageSize int, modelName, group string) ([]domain.Pricing, int64, error) {
	var pricings []domain.Pricing
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Pricing{})
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	if group != "" {
		query = query.Where("`group` = ?", group)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&pricings).Error; err != nil {
		return nil, 0, err
	}

	return pricings, total, nil
}

func (r *PricingRepository) Update(ctx context.Context, pricing *domain.Pricing) error {
	return r.db.WithContext(ctx).Save(pricing).Error
}

func (r *PricingRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Pricing{}, id).Error
}

// UpsertByNameAndGroup creates or updates a pricing record by model_name + group.
func (r *PricingRepository) UpsertByNameAndGroup(ctx context.Context, modelName, group string, req dto.CreatePricingRequest) (*domain.Pricing, error) {
	now := time.Now().UTC()
	billingMode := domain.BillingMode(req.BillingMode)
	if req.BillingMode == "" {
		billingMode = domain.BillingModeToken
	}
	pricing := &domain.Pricing{
		ModelName:         modelName,
		Group:             group,
		BillingMode:       billingMode,
		ModelRatio: func() float64 {
			if req.ModelRatio > 0 {
				return req.ModelRatio
			}
			if billingMode == domain.BillingModeToken {
				return 1 // default to 1× for token billing to avoid free consumption
			}
			return 0
		}(),
		CompletionRatio:   req.CompletionRatio,
		CachedTokensRatio: func() float64 {
			if req.CachedTokensRatio > 0 {
				return req.CachedTokensRatio
			}
			return 1
		}(),
		ImageRatio:        req.ImageRatio,
		EffectiveFrom:     now,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if req.FixedPriceCents != nil {
		pricing.FixedPriceCents = req.FixedPriceCents
	}
	if req.TieredExpr != "" {
		pricing.TieredExpr = &req.TieredExpr
	}

	assignments := map[string]any{
		"model_ratio":      req.ModelRatio,
		"completion_ratio": req.CompletionRatio,
		"image_ratio":      req.ImageRatio,
		"cached_tokens_ratio": func() float64 {
			if req.CachedTokensRatio > 0 {
				return req.CachedTokensRatio
			}
			return 1
		}(),
		"updated_at":       now,
	}
	if req.BillingMode != "" {
		assignments["billing_mode"] = billingMode
	}
	if req.FixedPriceCents != nil {
		assignments["fixed_price_cents"] = *req.FixedPriceCents
	}

	result := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "model_name"}, {Name: "group"}},
		DoUpdates: clause.Assignments(assignments),
	}).Create(pricing)
	if result.Error != nil {
		return nil, result.Error
	}
	// On conflict-update MySQL reports RowsAffected != 1; re-fetch the persisted record.
	if result.RowsAffected != 1 {
		return r.FindByModelAndGroupExact(ctx, modelName, group)
	}
	return pricing, nil
}

// GetPricedModelNames 返回所有已定价的模型名集合
func (r *PricingRepository) GetPricedModelNames(ctx context.Context) (map[string]bool, error) {
	var names []string
	if err := r.db.WithContext(ctx).Model(&domain.Pricing{}).
		Distinct("model_name").
		Pluck("model_name", &names).Error; err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(names))
	for _, n := range names {
		set[n] = true
	}
	return set, nil
}
