package service

import (
	"context"
	"errors"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var ErrQuotaPackageNotFound = errors.New("quota package not found")

type QuotaPackageService struct {
	db   *gorm.DB
	repo *repository.QuotaPackageRepository
}

func NewQuotaPackageService(db *gorm.DB, repo *repository.QuotaPackageRepository) *QuotaPackageService {
	return &QuotaPackageService{db: db, repo: repo}
}

func (s *QuotaPackageService) Create(ctx context.Context, req *dto.CreateQuotaPackageRequest) (*domain.QuotaPackage, error) {
	if req.QuotaValue < 0 {
		return nil, errors.New("quota_value must be non-negative")
	}
	if req.PriceCents < 0 {
		return nil, errors.New("price_cents must be non-negative")
	}
	currency := req.Currency
	if currency == "" {
		currency = "CNY"
	}
	pkg := &domain.QuotaPackage{
		Name:       req.Name,
		QuotaValue: req.QuotaValue,
		PriceCents: req.PriceCents,
		Currency:   currency,
		Status:     domain.QuotaPackageEnabled,
		SortOrder:  req.SortOrder,
	}
	if err := s.repo.Create(ctx, pkg); err != nil {
		return nil, err
	}
	return pkg, nil
}

func (s *QuotaPackageService) List(ctx context.Context, page, pageSize int, onlyEnabled bool, keyword string) ([]domain.QuotaPackage, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.repo.List(ctx, onlyEnabled, page, pageSize, keyword)
}

func (s *QuotaPackageService) Get(ctx context.Context, id uint64) (*domain.QuotaPackage, error) {
	pkg, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrQuotaPackageNotFound
		}
		return nil, err
	}
	return pkg, nil
}

func (s *QuotaPackageService) Update(ctx context.Context, id uint64, req *dto.UpdateQuotaPackageRequest) (*domain.QuotaPackage, error) {
	pkg, err := s.repo.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrQuotaPackageNotFound
		}
		return nil, err
	}
	if req.Name != nil {
		pkg.Name = *req.Name
	}
	if req.QuotaValue != nil {
		if *req.QuotaValue < 0 {
			return nil, errors.New("quota_value must be non-negative")
		}
		pkg.QuotaValue = *req.QuotaValue
	}
	if req.PriceCents != nil {
		if *req.PriceCents < 0 {
			return nil, errors.New("price_cents must be non-negative")
		}
		pkg.PriceCents = *req.PriceCents
	}
	if req.Status != nil {
		pkg.Status = domain.QuotaPackageStatus(*req.Status)
	}
	if req.SortOrder != nil {
		pkg.SortOrder = *req.SortOrder
	}
	if err := s.repo.Update(ctx, pkg); err != nil {
		return nil, err
	}
	return pkg, nil
}

func (s *QuotaPackageService) Delete(ctx context.Context, id uint64) error {
	// Prevent deletion if any top-ups reference this package
	var count int64
	if err := s.db.WithContext(ctx).Model(&domain.TopUp{}).Where("package_id = ?", id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("cannot delete: quota package is referenced by existing top-up orders")
	}
	return s.repo.Delete(ctx, id)
}

func (s *QuotaPackageService) BatchUpdateStatus(ctx context.Context, ids []uint64, status int) error {
	if len(ids) == 0 {
		return errors.New("ids is required")
	}
	return s.db.WithContext(ctx).Model(&domain.QuotaPackage{}).Where("id IN ?", ids).Update("status", status).Error
}

func (s *QuotaPackageService) BatchDelete(ctx context.Context, ids []uint64) error {
	if len(ids) == 0 {
		return errors.New("ids is required")
	}
	return s.db.WithContext(ctx).Delete(&domain.QuotaPackage{}, ids).Error
}
