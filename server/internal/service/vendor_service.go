package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrVendorNotFound    = errors.New("vendor not found")
	ErrVendorHasModels   = errors.New("vendor is still referenced by models")
)

type VendorService struct {
	db         *gorm.DB
	vendorRepo *repository.VendorRepository
}

func NewVendorService(db *gorm.DB, vendorRepo *repository.VendorRepository) *VendorService {
	return &VendorService{db: db, vendorRepo: vendorRepo}
}

func (s *VendorService) Create(ctx context.Context, req *dto.CreateVendorRequest) (*domain.Vendor, error) {
	vendor := &domain.Vendor{
		Name: req.Name,
	}
	if req.Description != "" {
		vendor.Description = &req.Description
	}
	if req.IconURL != "" {
		vendor.IconURL = &req.IconURL
	}

	if err := s.vendorRepo.Create(ctx, vendor); err != nil {
		return nil, err
	}
	return vendor, nil
}

func (s *VendorService) Get(ctx context.Context, id uint64) (*domain.Vendor, error) {
	vendor, err := s.vendorRepo.FindByID(ctx, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrVendorNotFound
		}
		return nil, err
	}
	return vendor, nil
}

func (s *VendorService) List(ctx context.Context, page, pageSize int, keyword string) ([]domain.Vendor, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.vendorRepo.List(ctx, page, pageSize, keyword)
}

func (s *VendorService) Update(ctx context.Context, id uint64, req *dto.UpdateVendorRequest) (*domain.Vendor, error) {
	vendor, err := s.vendorRepo.FindByID(ctx, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrVendorNotFound
		}
		return nil, err
	}

	if req.Name != nil {
		vendor.Name = *req.Name
	}
	if req.Description != nil {
		vendor.Description = req.Description
	}
	if req.IconURL != nil {
		vendor.IconURL = req.IconURL
	}

	if err := s.vendorRepo.Update(ctx, vendor); err != nil {
		return nil, err
	}
	return vendor, nil
}

func (s *VendorService) Delete(ctx context.Context, id uint64) error {
	// Check if any models reference this vendor before deleting
	var count int64
	if err := s.db.WithContext(ctx).Model(&domain.Model{}).Where("vendor_id = ?", id).Count(&count).Error; err != nil {
		return fmt.Errorf("check model references: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("%w: %d model(s)", ErrVendorHasModels, count)
	}
	return s.vendorRepo.Delete(ctx, id)
}

func ToVendorInfo(v *domain.Vendor) dto.VendorInfo {
	return dto.VendorInfo{
		ID:          v.ID,
		Name:        v.Name,
		Description: v.Description,
		IconURL:     v.IconURL,
		CreatedAt:   v.CreatedAt,
		UpdatedAt:   v.UpdatedAt,
	}
}

func VendorInfoList(vendors []domain.Vendor) []dto.VendorInfo {
	result := make([]dto.VendorInfo, len(vendors))
	for i := range vendors {
		result[i] = ToVendorInfo(&vendors[i])
	}
	return result
}
