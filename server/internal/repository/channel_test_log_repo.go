package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type ChannelTestLogRepository struct {
	db *gorm.DB
}

func NewChannelTestLogRepository(db *gorm.DB) *ChannelTestLogRepository {
	return &ChannelTestLogRepository{db: db}
}

func (r *ChannelTestLogRepository) Create(ctx context.Context, log *domain.ChannelTestLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *ChannelTestLogRepository) ListByChannel(ctx context.Context, channelID uint64, page, pageSize int) ([]domain.ChannelTestLog, int64, error) {
	var logs []domain.ChannelTestLog
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.ChannelTestLog{}).Where("channel_id = ?", channelID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("probed_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}
