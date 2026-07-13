package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TokenRepository struct {
	db *gorm.DB
}

func NewTokenRepository(db *gorm.DB) *TokenRepository {
	return &TokenRepository{db: db}
}

func (r *TokenRepository) Create(ctx context.Context, token *domain.Token) error {
	return r.db.WithContext(ctx).Create(token).Error
}

func (r *TokenRepository) FindByID(ctx context.Context, id uint64) (*domain.Token, error) {
	var token domain.Token
	if err := r.db.WithContext(ctx).First(&token, id).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *TokenRepository) FindByIDForUpdate(ctx context.Context, tx *gorm.DB, id uint64) (*domain.Token, error) {
	var token domain.Token
	if tx != nil {
		if err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&token, id).Error; err != nil {
			return nil, err
		}
		return &token, nil
	}
	if err := r.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&token, id).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *TokenRepository) FindByKeyHash(ctx context.Context, hash string) (*domain.Token, error) {
	var token domain.Token
	if err := r.db.WithContext(ctx).Where("key_hash = ?", hash).First(&token).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *TokenRepository) ListByUserID(ctx context.Context, userID uint64, keyword string, page, pageSize int) ([]domain.Token, int64, error) {
	var tokens []domain.Token
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Token{}).Where("user_id = ?", userID)
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tokens).Error; err != nil {
		return nil, 0, err
	}

	return tokens, total, nil
}

func (r *TokenRepository) ListAll(ctx context.Context, keyword string, page, pageSize int) ([]domain.Token, int64, error) {
	var tokens []domain.Token
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Token{})
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tokens).Error; err != nil {
		return nil, 0, err
	}

	return tokens, total, nil
}

func (r *TokenRepository) Update(ctx context.Context, token *domain.Token) error {
	return r.db.WithContext(ctx).Save(token).Error
}

func (r *TokenRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Token{}, id).Error
}

func (r *TokenRepository) UpdateQuota(ctx context.Context, id uint64, delta int64) error {
	return r.db.WithContext(ctx).Model(&domain.Token{}).
		Where("id = ?", id).
		UpdateColumn("remain_quota", gorm.Expr("remain_quota + ?", delta)).Error
}

func (r *TokenRepository) UpdateLastUsedAt(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Model(&domain.Token{}).
		Where("id = ?", id).
		UpdateColumn("last_used_at", gorm.Expr("NOW()")).Error
}

// FindFirstActiveByUserID returns the first active token belonging to the user.
func (r *TokenRepository) FindFirstActiveByUserID(ctx context.Context, userID uint64) (*domain.Token, error) {
	var token domain.Token
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, domain.TokenActive).
		First(&token).Error; err != nil {
		return nil, err
	}
	return &token, nil
}
