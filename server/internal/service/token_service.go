package service

import (
	"context"
	"errors"
	"time"

	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
)

var (
	ErrTokenNotFound = errors.New("token not found")
	ErrUnauthorized  = errors.New("unauthorized")
)

type TokenDailyStat struct {
	Date      string `json:"date"`
	Requests  int64  `json:"requests"`
	Tokens    int64  `json:"tokens"`
	QuotaUsed int64  `json:"quota_used"`
}

type TokenService struct {
	tokenRepo *repository.TokenRepository
	userRepo  *repository.UserRepository
	logRepo   *repository.LogRepository
}

func NewTokenService(tokenRepo *repository.TokenRepository, userRepo *repository.UserRepository, logRepo *repository.LogRepository) *TokenService {
	return &TokenService{tokenRepo: tokenRepo, userRepo: userRepo, logRepo: logRepo}
}

func (s *TokenService) CreateToken(ctx context.Context, userID uint64, req *dto.CreateTokenRequest) (*domain.Token, string, error) {
	fullKey, hash, mask, err := utils.GenerateAPIKey()
	if err != nil {
		return nil, "", err
	}

	group := req.Group
	if group == "" {
		group = "default"
	}

	// Validate remain_quota
	if req.RemainQuota < 0 {
		return nil, "", errors.New("token remain_quota must be non-negative")
	}
	if userID > 0 && req.RemainQuota > 0 {
		user, userErr := s.userRepo.FindByID(ctx, userID)
		if userErr == nil && req.RemainQuota > user.Quota {
			return nil, "", errors.New("token remain_quota cannot exceed user's total quota")
		}
	}

	modelLimits := utils.StringifyJSON(req.ModelLimits)

	token := &domain.Token{
		UserID:             userID,
		Name:               req.Name,
		KeyHash:            hash,
		KeyMask:            mask,
		Status:             domain.TokenActive,
		RemainQuota:        req.RemainQuota,
		UnlimitedQuota:     req.UnlimitedQuota,
		ModelLimitsEnabled: len(req.ModelLimits) > 0,
		ModelLimits:        modelLimits,
		Group:              group,
		CrossGroupRetry:    req.CrossGroupRetry,
		RateLimit:          req.RateLimit,
	}
	if req.AllowedIPs != "" {
		v := req.AllowedIPs
		token.AllowedIPs = &v
	}

	if err := s.tokenRepo.Create(ctx, token); err != nil {
		return nil, "", err
	}

	return token, fullKey, nil
}

func (s *TokenService) ListTokens(ctx context.Context, userID uint64, keyword string, page, pageSize int) ([]domain.Token, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	if userID == 0 {
		return s.tokenRepo.ListAll(ctx, keyword, page, pageSize)
	}
	return s.tokenRepo.ListByUserID(ctx, userID, keyword, page, pageSize)
}

func (s *TokenService) GetToken(ctx context.Context, userID uint64, tokenID uint64, isAdmin bool) (*domain.Token, error) {
	token, err := s.tokenRepo.FindByID(ctx, tokenID)
	if err != nil {
		return nil, ErrTokenNotFound
	}
	if !isAdmin && token.UserID != userID {
		return nil, ErrUnauthorized
	}
	return token, nil
}

func (s *TokenService) UpdateToken(ctx context.Context, userID uint64, tokenID uint64, req *dto.UpdateTokenRequest, isAdmin bool) (*domain.Token, error) {
	token, err := s.GetToken(ctx, userID, tokenID, isAdmin)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		token.Name = req.Name
	}
	if req.Status != nil {
		token.Status = domain.TokenStatus(*req.Status)
	}
	if req.RemainQuota != nil {
		if *req.RemainQuota < 0 {
			return nil, errors.New("token remain_quota must be non-negative")
		}
		user, userErr := s.userRepo.FindByID(ctx, token.UserID)
		if userErr == nil && *req.RemainQuota > user.Quota {
			return nil, errors.New("token remain_quota cannot exceed user's total quota")
		}
		token.RemainQuota = *req.RemainQuota
	}
	if req.UnlimitedQuota != nil {
		token.UnlimitedQuota = *req.UnlimitedQuota
	}
	if req.Group != "" {
		token.Group = req.Group
	}
	if req.ModelLimits != nil {
		token.ModelLimitsEnabled = len(req.ModelLimits) > 0
		token.ModelLimits = utils.StringifyJSON(req.ModelLimits)
	}
	if req.AllowedIPs != nil {
		token.AllowedIPs = req.AllowedIPs
	}
	if req.RateLimit != nil {
		token.RateLimit = *req.RateLimit
	}
	if req.CrossGroupRetry != nil {
		token.CrossGroupRetry = *req.CrossGroupRetry
	}

	if err := s.tokenRepo.Update(ctx, token); err != nil {
		return nil, err
	}
	return token, nil
}

func (s *TokenService) DeleteToken(ctx context.Context, userID uint64, tokenID uint64, isAdmin bool) error {
	token, err := s.GetToken(ctx, userID, tokenID, isAdmin)
	if err != nil {
		return err
	}
	return s.tokenRepo.Delete(ctx, token.ID)
}

func (s *TokenService) BatchDeleteTokens(ctx context.Context, userID uint64, ids []uint64, isAdmin bool) error {
	for _, id := range ids {
		if err := s.DeleteToken(ctx, userID, id, isAdmin); err != nil {
			return err
		}
	}
	return nil
}

func (s *TokenService) ValidateToken(ctx context.Context, key string) (*domain.Token, *domain.User, error) {
	hash := utils.HashAPIKey(key)
	token, err := s.tokenRepo.FindByKeyHash(ctx, hash)
	if err != nil {
		return nil, nil, ErrUnauthorized
	}
	if token.Status != domain.TokenActive {
		return nil, nil, ErrUnauthorized
	}

	user, err := s.userRepo.FindByID(ctx, token.UserID)
	if err != nil {
		return nil, nil, ErrUnauthorized
	}
	if user.Status != domain.UserActive {
		return nil, nil, ErrUnauthorized
	}

	return token, user, nil
}

func (s *TokenService) UpdateLastUsedAt(ctx context.Context, tokenID uint64) error {
	return s.tokenRepo.UpdateLastUsedAt(ctx, tokenID)
}

// GetTokenStats returns 30-day daily consumption trend for a specific token.
// Uses the logs table grouped by DATE(created_at).
func (s *TokenService) GetTokenStats(ctx context.Context, tokenID uint64, days int) ([]TokenDailyStat, error) {
	if days <= 0 {
		days = 30
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -days)

	var stats []TokenDailyStat
	err := s.logRepo.DB().WithContext(ctx).
		Model(&domain.Log{}).
		Select("DATE(created_at) as date, COUNT(*) as requests, COALESCE(SUM(total_tokens), 0) as tokens, COALESCE(SUM(quota_used), 0) as quota_used").
		Where("token_id = ? AND created_at >= ?", tokenID, cutoff).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&stats).Error

	return stats, err
}

// RevealTokenKey API Key 明文仅在创建时返回，不再存储
func (s *TokenService) RevealTokenKey(ctx context.Context, tokenID uint64) (string, error) {
	return "", errors.New("key only visible at creation time")
}
