package repository

import (
	"context"
	"testing"

	"github.com/juhe-management/server/internal/domain"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newChannelRepoTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.Channel{}, &domain.Ability{}))
	return db
}

func TestChannelRepository_UpdateChannelAndAbilities_Rollback(t *testing.T) {
	db := newChannelRepoTestDB(t)
	repo := NewChannelRepository(db)
	ctx := context.Background()

	channel := &domain.Channel{
		Type:   domain.ChannelTypeOpenAICompatible,
		Name:   "rollback-test",
		Keys:   "key1",
		Models: "gpt-4",
		Groups: "default",
		Status: domain.ChannelActive,
	}
	require.NoError(t, repo.Create(ctx, channel))

	// 构造重复 modelID，导致 abilities 唯一索引冲突，从而触发事务回滚
	badChannel := &domain.Channel{
		ID:       channel.ID,
		Type:     domain.ChannelTypeOpenAICompatible,
		Name:     channel.Name,
		Keys:     channel.Keys,
		Models:   "x",
		Groups:   "default",
		Priority: channel.Priority,
		Weight:   channel.Weight,
		Status:   channel.Status,
	}
	err := repo.UpdateChannelAndAbilities(ctx, badChannel, []string{"dup", "dup"})
	require.Error(t, err)

	updated, err := repo.FindByID(ctx, channel.ID)
	require.NoError(t, err)
	require.Equal(t, "gpt-4", updated.Models)
}
