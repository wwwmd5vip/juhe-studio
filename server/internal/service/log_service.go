package service

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
)

type LogService struct {
	logRepo *repository.LogRepository
}

func NewLogService(logRepo *repository.LogRepository) *LogService {
	return &LogService{logRepo: logRepo}
}

func (s *LogService) List(ctx context.Context, userID uint64, page, pageSize int) ([]domain.Log, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.logRepo.List(ctx, userID, page, pageSize)
}

func (s *LogService) ListWithFilters(ctx context.Context, filter repository.LogFilter, page, pageSize int) ([]domain.Log, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.logRepo.ListWithFilters(ctx, filter, page, pageSize)
}

func ToLogInfo(log *domain.Log) dto.LogInfo {
	return dto.LogInfo{
		ID:               log.ID,
		UserID:           log.UserID,
		TokenID:          log.TokenID,
		ChannelID:        log.ChannelID,
		ModelName:        log.ModelName,
		RequestID:        log.RequestID,
		Type:             string(log.Type),
		Mode:             string(log.Mode),
		PromptTokens:     log.PromptTokens,
		CompletionTokens: log.CompletionTokens,
		TotalTokens:      log.TotalTokens,
		ImageN:           log.ImageN,
		QuotaUsed:        log.QuotaUsed,
		QuotaPreConsumed: log.QuotaPreConsumed,
		StatusCode:       log.StatusCode,
		UpstreamStatus:   log.UpstreamStatus,
		IPAddress:        log.IPAddress,
		UserAgent:        log.UserAgent,
		RequestContent:   log.RequestContent,
		ResponseContent:  log.ResponseContent,
		ErrorMessage:     log.ErrorMessage,
		UseTimeMs:        log.UseTimeMs,
		CreatedAt:        log.CreatedAt,
	}
}

func ToLogInfoList(logs []domain.Log) []dto.LogInfo {
	list := make([]dto.LogInfo, 0, len(logs))
	for i := range logs {
		list = append(list, ToLogInfo(&logs[i]))
	}
	return list
}
