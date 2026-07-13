package repository

import (
	"context"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

// isValidDate returns true if s is a valid "2006-01-02" date string.
// Invalid dates are silently ignored (not treated as errors) to maintain
// backward-compatible API behavior.
func isValidDate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

type LogFilter struct {
	UserID     uint64
	TokenID    uint64
	ModelName  string
	Keyword    string
	Type       string
	StatusCode int
	ChannelID  uint64
	IPAddress  string
	StartDate  string // "2006-01-02"
	EndDate    string // "2006-01-02"
}

type LogRepository struct {
	db *gorm.DB
}

func NewLogRepository(db *gorm.DB) *LogRepository {
	return &LogRepository{db: db}
}

func (r *LogRepository) Create(ctx context.Context, log *domain.Log) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *LogRepository) List(ctx context.Context, userID uint64, page, pageSize int) ([]domain.Log, int64, error) {
	return r.ListWithFilters(ctx, LogFilter{UserID: userID}, page, pageSize)
}

func (r *LogRepository) ListWithFilters(ctx context.Context, filter LogFilter, page, pageSize int) ([]domain.Log, int64, error) {
	var logs []domain.Log
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Log{})
	if filter.UserID > 0 {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.TokenID != 0 {
		query = query.Where("token_id = ?", filter.TokenID)
	}
	if filter.ModelName != "" {
		query = query.Where("model_name LIKE ?", "%"+filter.ModelName+"%")
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		query = query.Where("(request_content LIKE ? OR response_content LIKE ? OR error_message LIKE ?)", kw, kw, kw)
	}
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}
	if filter.StatusCode > 0 {
		query = query.Where("status_code = ?", filter.StatusCode)
	}
	if filter.ChannelID > 0 {
		query = query.Where("channel_id = ?", filter.ChannelID)
	}
	if filter.IPAddress != "" {
		query = query.Where("ip_address LIKE ?", "%"+filter.IPAddress+"%")
	}
	if filter.StartDate != "" {
		if isValidDate(filter.StartDate) {
			query = query.Where("created_at >= ?", filter.StartDate)
		}
	}
	if filter.EndDate != "" {
		if isValidDate(filter.EndDate) {
			query = query.Where("created_at <= ?", filter.EndDate+" 23:59:59")
		}
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// DeleteOlderThan deletes logs older than the given number of days in batches.
// Returns the gorm.DB result so the caller can inspect RowsAffected.
func (r *LogRepository) DeleteOlderThan(ctx context.Context, days, limit int) *gorm.DB {
	return r.db.WithContext(ctx).
		Where("created_at < DATE_SUB(NOW(), INTERVAL ? DAY)", days).
		Order("id ASC").
		Limit(limit).
		Delete(&domain.Log{})
}

// DB returns the underlying gorm.DB for custom queries.
func (r *LogRepository) DB() *gorm.DB {
	return r.db
}
