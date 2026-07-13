package service

import (
	"context"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newSensitiveWordTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.Setting{}))
	return db
}

func TestSensitiveWordService_Check(t *testing.T) {
	db := newSensitiveWordTestDB(t)
	settingSvc := NewSettingService(repository.NewSettingRepository(db))
	svc := NewSensitiveWordService(settingSvc)
	ctx := context.Background()

	_, err := settingSvc.Set(ctx, "sensitive_words_enabled", "true", "bool", "", "")
	require.NoError(t, err)
	_, err = settingSvc.Set(ctx, "sensitive_words_list", `["bad", "worse"]`, "json", "", "")
	require.NoError(t, err)

	blocked, word := svc.Check(ctx, "this is a bad idea")
	require.True(t, blocked)
	require.Equal(t, "bad", word)

	blocked, _ = svc.Check(ctx, "this is fine")
	require.False(t, blocked)
}

func TestSensitiveWordService_Disabled(t *testing.T) {
	db := newSensitiveWordTestDB(t)
	settingSvc := NewSettingService(repository.NewSettingRepository(db))
	svc := NewSensitiveWordService(settingSvc)
	ctx := context.Background()

	_, err := settingSvc.Set(ctx, "sensitive_words_enabled", "false", "bool", "", "")
	require.NoError(t, err)

	blocked, _ := svc.Check(ctx, "this is a bad idea")
	require.False(t, blocked)
}
