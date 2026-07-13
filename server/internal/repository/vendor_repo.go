package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
)

type VendorRepository struct {
	db *gorm.DB
}

func NewVendorRepository(db *gorm.DB) *VendorRepository {
	return &VendorRepository{db: db}
}

func (r *VendorRepository) Create(ctx context.Context, vendor *domain.Vendor) error {
	return r.db.WithContext(ctx).Create(vendor).Error
}

func (r *VendorRepository) FindByID(ctx context.Context, id uint64) (*domain.Vendor, error) {
	var v domain.Vendor
	if err := r.db.WithContext(ctx).First(&v, id).Error; err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *VendorRepository) FindByName(ctx context.Context, name string) (*domain.Vendor, error) {
	var v domain.Vendor
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&v).Error; err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *VendorRepository) List(ctx context.Context, page, pageSize int, keyword string) ([]domain.Vendor, int64, error) {
	var vendors []domain.Vendor
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Vendor{})
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("name ASC").Offset(offset).Limit(pageSize).Find(&vendors).Error; err != nil {
		return nil, 0, err
	}

	return vendors, total, nil
}

func (r *VendorRepository) Update(ctx context.Context, vendor *domain.Vendor) error {
	return r.db.WithContext(ctx).Save(vendor).Error
}

func (r *VendorRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.Vendor{}, id).Error
}
