package service

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
)

type AdminAuditLogService struct {
	repo *repository.AdminAuditLogRepository
}

func NewAdminAuditLogService(repo *repository.AdminAuditLogRepository) *AdminAuditLogService {
	return &AdminAuditLogService{repo: repo}
}

func (s *AdminAuditLogService) List(ctx context.Context, page, pageSize int, operatorID uint64, operatorName, action, targetType, startDate, endDate string) ([]domain.AdminAuditLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.List(ctx, page, pageSize, operatorID, operatorName, action, targetType, startDate, endDate)
}
