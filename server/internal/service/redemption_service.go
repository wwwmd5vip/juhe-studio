package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrRedemptionNotFound = errors.New("invalid redemption code")
	ErrRedemptionUsed     = errors.New("redemption code already used")
	ErrRedemptionExpired  = errors.New("redemption code expired")
)

type RedemptionService struct {
	db             *gorm.DB
	redemptionRepo *repository.RedemptionRepository
	billingService *BillingService
}

func NewRedemptionService(db *gorm.DB, redemptionRepo *repository.RedemptionRepository, billingService *BillingService) *RedemptionService {
	return &RedemptionService{
		db:             db,
		redemptionRepo: redemptionRepo,
		billingService: billingService,
	}
}

func (s *RedemptionService) GenerateCodes(ctx context.Context, req *dto.GenerateRedemptionCodesRequest, adminID uint64) ([]domain.Redemption, error) {
	codes := make([]*domain.Redemption, 0, req.Count)
	for i := 0; i < req.Count; i++ {
		code, err := s.generateUniqueCode(ctx, req.Prefix)
		if err != nil {
			return nil, err
		}
		codes = append(codes, &domain.Redemption{
			Code:       code,
			QuotaValue: req.QuotaValue,
			ExpiresAt:  req.ExpiresAt,
		})
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		return s.redemptionRepo.CreateBatch(ctx, tx, codes)
	}); err != nil {
		return nil, err
	}
	result := make([]domain.Redemption, len(codes))
	for i, c := range codes {
		result[i] = *c
	}
	return result, nil
}

func (s *RedemptionService) Redeem(ctx context.Context, userID uint64, code string) (*domain.Redemption, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, ErrRedemptionNotFound
	}
	var rd *domain.Redemption
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var err error
		rd, err = s.redemptionRepo.FindByCodeForUpdate(ctx, tx, code)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRedemptionNotFound
			}
			return err
		}
		if rd.Status == domain.RedemptionUsed {
			return ErrRedemptionUsed
		}
		if rd.ExpiresAt != nil && rd.ExpiresAt.Before(time.Now().UTC()) {
			return ErrRedemptionExpired
		}
		rd.Status = domain.RedemptionUsed
		rd.UsedBy = &userID
		now := time.Now().UTC()
		rd.UsedAt = &now
		if err := s.redemptionRepo.Update(ctx, tx, rd); err != nil {
			return err
		}
		return s.billingService.RechargeTx(ctx, tx, userID, 0, rd.QuotaValue, "redemption", fmt.Sprintf("%d", rd.ID), "redemption code")
	}); err != nil {
		return nil, err
	}
	return rd, nil
}

func (s *RedemptionService) List(ctx context.Context, status *int, page, pageSize int) ([]domain.Redemption, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.redemptionRepo.List(ctx, status, page, pageSize)
}

func (s *RedemptionService) DeleteUnused(ctx context.Context, id uint64) error {
	rd, err := s.redemptionRepo.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRedemptionNotFound
		}
		return err
	}
	if rd.Status == domain.RedemptionUsed {
		return ErrRedemptionUsed
	}
	return s.redemptionRepo.DeleteUnused(ctx, id)
}

const maxCodeGenAttempts = 3

func (s *RedemptionService) generateUniqueCode(ctx context.Context, prefix string) (string, error) {
	for attempt := 0; attempt < maxCodeGenAttempts; attempt++ {
		code, err := randomCode(prefix)
		if err != nil {
			return "", err
		}
		exists, err := s.redemptionRepo.ExistsByCode(ctx, code)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", fmt.Errorf("failed to generate unique code after %d attempts", maxCodeGenAttempts)
}

func randomCode(prefix string) (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	code := hex.EncodeToString(b)
	if prefix != "" {
		code = strings.ToUpper(prefix) + "-" + strings.ToUpper(code)
	}
	return code, nil
}
