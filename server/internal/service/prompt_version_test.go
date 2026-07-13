package service

import (
	"context"
	"testing"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newPromptTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(
		&domain.User{},
		&domain.PromptCategory{},
		&domain.Prompt{},
		&domain.PromptVersion{},
		&domain.PromptPackageItem{},
	)
	require.NoError(t, err)
	return db
}

func createPromptTestUser(t *testing.T, db *gorm.DB) *domain.User {
	ctx := context.Background()
	user := &domain.User{
		Username:     "prompt-test-" + time.Now().Format("150405.000000"),
		PasswordHash: "hash",
		Role:         domain.RoleAdmin,
	}
	require.NoError(t, repository.NewUserRepository(db).Create(ctx, user))
	return user
}

func createPromptTestCategory(t *testing.T, db *gorm.DB, promptType string) *domain.PromptCategory {
	ctx := context.Background()
	cat := &domain.PromptCategory{
		Name:      "cat-" + time.Now().Format("150405.000000"),
		Type:      promptType,
		SortOrder: 0,
	}
	require.NoError(t, repository.NewPromptRepository(db).CreateCategory(ctx, cat))
	return cat
}

func createPromptTestPrompt(t *testing.T, db *gorm.DB, authorID uint64, categoryID uint64, promptType string, title string, content string, status domain.PromptStatus) *domain.Prompt {
	ctx := context.Background()
	p := &domain.Prompt{
		Type:       promptType,
		CategoryID: categoryID,
		Title:      title,
		Content:    content,
		AuthorID:   authorID,
	}
	p.SetVariables(map[string]string{"name": "string"})
	p.SetTags([]string{"test"})
	require.NoError(t, repository.NewPromptRepository(db).CreatePrompt(ctx, p))
	// gorm applies default status (published) when zero value is inserted,
	// so explicitly set the desired status after creation.
	require.NoError(t, db.Model(&domain.Prompt{}).Where("id = ?", p.ID).Update("status", status).Error)
	fresh, err := repository.NewPromptRepository(db).FindPromptByID(ctx, p.ID)
	require.NoError(t, err)
	return fresh
}

func newPromptServiceWithDB(t *testing.T) (*PromptService, *gorm.DB) {
	db := newPromptTestDB(t)
	svc := NewPromptService(
		db,
		repository.NewPromptRepository(db),
		repository.NewPromptVersionRepository(db),
		repository.NewPromptPackageItemRepository(db),
	)
	return svc, db
}

func TestPromptService_PublishCreatesVersion(t *testing.T) {
	svc, db := newPromptServiceWithDB(t)
	ctx := context.Background()
	user := createPromptTestUser(t, db)
	cat := createPromptTestCategory(t, db, domain.PromptTypeImage)

	p := createPromptTestPrompt(t, db, user.ID, cat.ID, domain.PromptTypeImage, "Draft Prompt", "Hello {{name}}", domain.PromptStatusDraft)
	require.Equal(t, domain.PromptStatusDraft, p.Status)

	published, err := svc.PublishPrompt(ctx, p.ID, user.ID)
	require.NoError(t, err)
	require.Equal(t, domain.PromptStatusPublished, published.Status)

	versions, total, err := svc.ListPromptVersions(ctx, p.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, versions, 1)
	require.Equal(t, "Draft Prompt", versions[0].Title)
	require.Equal(t, "Hello {{name}}", versions[0].Content)
}

func TestPromptService_RollbackPrompt(t *testing.T) {
	svc, db := newPromptServiceWithDB(t)
	ctx := context.Background()
	user := createPromptTestUser(t, db)
	cat := createPromptTestCategory(t, db, domain.PromptTypeImage)

	p := createPromptTestPrompt(t, db, user.ID, cat.ID, domain.PromptTypeImage, "Original Title", "Original content", domain.PromptStatusDraft)
	published, err := svc.PublishPrompt(ctx, p.ID, user.ID)
	require.NoError(t, err)
	firstVersionID := published.ID

	versions, total, err := svc.ListPromptVersions(ctx, p.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	firstVersionID = versions[0].ID

	statusDraft := int(domain.PromptStatusDraft)
	_, err = svc.UpdatePrompt(ctx, p.ID, &dto.UpdatePromptRequest{
		Title:   &[]string{"Updated Title"}[0],
		Content: &[]string{"Updated content"}[0],
		Status:  &statusDraft,
	})
	require.NoError(t, err)
	published2, err := svc.PublishPrompt(ctx, p.ID, user.ID)
	require.NoError(t, err)
	require.Equal(t, "Updated Title", published2.Title)
	require.Equal(t, "Updated content", published2.Content)

	versions, total, err = svc.ListPromptVersions(ctx, p.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)

	rolled, err := svc.RollbackPrompt(ctx, p.ID, firstVersionID, user.ID)
	require.NoError(t, err)
	require.Equal(t, "Original Title", rolled.Title)
	require.Equal(t, "Original content", rolled.Content)
	require.Equal(t, domain.PromptStatusPublished, rolled.Status)

	versions, total, err = svc.ListPromptVersions(ctx, p.ID, 1, 10)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
}

func TestPromptService_RenderPackage(t *testing.T) {
	svc, db := newPromptServiceWithDB(t)
	ctx := context.Background()
	user := createPromptTestUser(t, db)
	imageCat := createPromptTestCategory(t, db, domain.PromptTypeImage)
	packageCat := createPromptTestCategory(t, db, domain.PromptTypePackage)

	p1 := createPromptTestPrompt(t, db, user.ID, imageCat.ID, domain.PromptTypeImage, "Prompt One", "Hello {{name}}", domain.PromptStatusDraft)
	_, err := svc.PublishPrompt(ctx, p1.ID, user.ID)
	require.NoError(t, err)

	p2 := createPromptTestPrompt(t, db, user.ID, imageCat.ID, domain.PromptTypeImage, "Prompt Two", "Goodbye {{name}}", domain.PromptStatusDraft)
	_, err = svc.PublishPrompt(ctx, p2.ID, user.ID)
	require.NoError(t, err)

	pkg := createPromptTestPrompt(t, db, user.ID, packageCat.ID, domain.PromptTypePackage, "My Package", "package body", domain.PromptStatusDraft)
	_, err = svc.PublishPrompt(ctx, pkg.ID, user.ID)
	require.NoError(t, err)

	err = svc.SetPackageItems(ctx, pkg.ID, []struct {
		PromptID  uint64
		SortOrder int
	}{
		{PromptID: p1.ID, SortOrder: 1},
		{PromptID: p2.ID, SortOrder: 2},
	})
	require.NoError(t, err)

	results, err := svc.RenderPackage(ctx, pkg.ID, map[string]string{"name": "World"})
	require.NoError(t, err)
	require.Len(t, results, 2)

	require.Equal(t, p1.ID, results[0].PromptID)
	require.Equal(t, "Prompt One", results[0].Title)
	require.Equal(t, "Hello World", results[0].Content)

	require.Equal(t, p2.ID, results[1].PromptID)
	require.Equal(t, "Prompt Two", results[1].Title)
	require.Equal(t, "Goodbye World", results[1].Content)
}
