package repository

import (
	"context"
	"fmt"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type FeedbackFilter struct {
	Type      string
	StartDate string
	EndDate   string
}

type FeedbackRepository struct {
	db *gorm.DB
}

func NewFeedbackRepository(db *gorm.DB) *FeedbackRepository {
	return &FeedbackRepository{db: db}
}

func (r *FeedbackRepository) Create(ctx context.Context, feedback *domain.Feedback) error {
	return r.db.WithContext(ctx).Create(feedback).Error
}

func (r *FeedbackRepository) List(ctx context.Context, filter FeedbackFilter, page, pageSize int) ([]domain.Feedback, int64, error) {
	var feedbacks []domain.Feedback
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Feedback{})
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}
	if filter.StartDate != "" {
		query = query.Where("created_at >= ?", filter.StartDate)
	}
	if filter.EndDate != "" {
		query = query.Where("created_at <= ?", filter.EndDate+" 23:59:59")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count feedbacks: %w", err)
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&feedbacks).Error; err != nil {
		return nil, 0, fmt.Errorf("list feedbacks: %w", err)
	}

	return feedbacks, total, nil
}

func (r *FeedbackRepository) Delete(ctx context.Context, id uint) error {
	result := r.db.WithContext(ctx).Delete(&domain.Feedback{}, id)
	if result.Error != nil {
		return fmt.Errorf("delete feedback %d: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("feedback %d not found", id)
	}
	return nil
}
