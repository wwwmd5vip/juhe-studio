package service

import (
	"context"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newQuotaPackageTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared&_txlock=immediate&_busy_timeout=5000"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	err = db.AutoMigrate(&domain.QuotaPackage{}, &domain.TopUp{})
	require.NoError(t, err)
	return db
}

func newQuotaPackageServiceWithDB(t *testing.T) (*QuotaPackageService, *gorm.DB) {
	db := newQuotaPackageTestDB(t)
	svc := NewQuotaPackageService(db, repository.NewQuotaPackageRepository(db))
	return svc, db
}

func TestQuotaPackageService_Create_DefaultCurrency(t *testing.T) {
	svc, _ := newQuotaPackageServiceWithDB(t)
	ctx := context.Background()

	pkg, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "Basic",
		QuotaValue: 1000,
		PriceCents: 1000,
	})
	require.NoError(t, err)
	require.NotNil(t, pkg)
	require.Equal(t, "CNY", pkg.Currency)
	require.Equal(t, domain.QuotaPackageEnabled, pkg.Status)
	require.Equal(t, "Basic", pkg.Name)
	require.Equal(t, int64(1000), pkg.QuotaValue)
	require.Equal(t, int64(1000), pkg.PriceCents)

	withCurrency, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "Premium",
		QuotaValue: 5000,
		PriceCents: 5000,
		Currency:   "USD",
	})
	require.NoError(t, err)
	require.Equal(t, "USD", withCurrency.Currency)
}

func TestQuotaPackageService_List_OnlyEnabledFilter(t *testing.T) {
	svc, _ := newQuotaPackageServiceWithDB(t)
	ctx := context.Background()

	enabled, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "Enabled",
		QuotaValue: 1000,
		PriceCents: 1000,
	})
	require.NoError(t, err)

	disabled, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "Disabled",
		QuotaValue: 2000,
		PriceCents: 2000,
	})
	require.NoError(t, err)

	status := int(domain.QuotaPackageDisabled)
	_, err = svc.Update(ctx, disabled.ID, &dto.UpdateQuotaPackageRequest{Status: &status})
	require.NoError(t, err)

	all, total, err := svc.List(ctx, 1, 10, false, "")
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, all, 2)

	onlyEnabled, total, err := svc.List(ctx, 1, 10, true, "")
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, onlyEnabled, 1)
	require.Equal(t, enabled.ID, onlyEnabled[0].ID)
	require.Equal(t, domain.QuotaPackageEnabled, onlyEnabled[0].Status)
}

func TestQuotaPackageService_Get(t *testing.T) {
	svc, _ := newQuotaPackageServiceWithDB(t)
	ctx := context.Background()

	pkg, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "Gettable",
		QuotaValue: 1000,
		PriceCents: 1000,
	})
	require.NoError(t, err)

	got, err := svc.Get(ctx, pkg.ID)
	require.NoError(t, err)
	require.Equal(t, pkg.ID, got.ID)

	_, err = svc.Get(ctx, 9999)
	require.ErrorIs(t, err, ErrQuotaPackageNotFound)
}

func TestQuotaPackageService_Update_Fields(t *testing.T) {
	svc, _ := newQuotaPackageServiceWithDB(t)
	ctx := context.Background()

	pkg, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "Original",
		QuotaValue: 1000,
		PriceCents: 1000,
	})
	require.NoError(t, err)

	newName := "Updated"
	newQuota := int64(5000)
	newPrice := int64(5000)
	newStatus := int(domain.QuotaPackageDisabled)
	newSortOrder := 5

	updated, err := svc.Update(ctx, pkg.ID, &dto.UpdateQuotaPackageRequest{
		Name:       &newName,
		QuotaValue: &newQuota,
		PriceCents: &newPrice,
		Status:     &newStatus,
		SortOrder:  &newSortOrder,
	})
	require.NoError(t, err)
	require.Equal(t, "Updated", updated.Name)
	require.Equal(t, int64(5000), updated.QuotaValue)
	require.Equal(t, int64(5000), updated.PriceCents)
	require.Equal(t, domain.QuotaPackageDisabled, updated.Status)
	require.Equal(t, 5, updated.SortOrder)

	partialName := "Partial"
	partial, err := svc.Update(ctx, pkg.ID, &dto.UpdateQuotaPackageRequest{
		Name: &partialName,
	})
	require.NoError(t, err)
	require.Equal(t, "Partial", partial.Name)
	require.Equal(t, int64(5000), partial.QuotaValue)
}

func TestQuotaPackageService_Update_NotFound(t *testing.T) {
	svc, _ := newQuotaPackageServiceWithDB(t)
	ctx := context.Background()

	newName := "Missing"
	_, err := svc.Update(ctx, 9999, &dto.UpdateQuotaPackageRequest{Name: &newName})
	require.ErrorIs(t, err, ErrQuotaPackageNotFound)
}

func TestQuotaPackageService_Delete(t *testing.T) {
	svc, db := newQuotaPackageServiceWithDB(t)
	ctx := context.Background()

	pkg, err := svc.Create(ctx, &dto.CreateQuotaPackageRequest{
		Name:       "ToDelete",
		QuotaValue: 1000,
		PriceCents: 1000,
	})
	require.NoError(t, err)

	err = svc.Delete(ctx, pkg.ID)
	require.NoError(t, err)

	_, err = repository.NewQuotaPackageRepository(db).FindByID(ctx, pkg.ID)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}
