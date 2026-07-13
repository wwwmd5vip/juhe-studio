package repository

import (
	"context"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type EmailVerificationRepository struct {
	db *gorm.DB
}

func NewEmailVerificationRepository(db *gorm.DB) *EmailVerificationRepository {
	return &EmailVerificationRepository{db: db}
}

func (r *EmailVerificationRepository) Create(ctx context.Context, v *domain.EmailVerification) error {
	return r.db.WithContext(ctx).Create(v).Error
}

func (r *EmailVerificationRepository) FindByEmail(ctx context.Context, email string) (*domain.EmailVerification, error) {
	var v domain.EmailVerification
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&v).Error; err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *EmailVerificationRepository) UpdateVerified(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Model(&domain.EmailVerification{}).Where("id = ?", id).Update("verified", true).Error
}

func (r *EmailVerificationRepository) DeleteExpired(ctx context.Context) (int64, error) {
	result := r.db.WithContext(ctx).Where("expires_at < ?", time.Now()).Delete(&domain.EmailVerification{})
	return result.RowsAffected, result.Error
}

func (r *EmailVerificationRepository) FindByCode(ctx context.Context, code string) (*domain.EmailVerification, error) {
	var v domain.EmailVerification
	if err := r.db.WithContext(ctx).Where("code = ?", code).First(&v).Error; err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *EmailVerificationRepository) DeleteByEmail(ctx context.Context, email string) error {
	return r.db.WithContext(ctx).Where("email = ?", email).Delete(&domain.EmailVerification{}).Error
}
