package repository

import (
	"context"

	"github.com/juhe-management/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *UserRepository) FindByID(ctx context.Context, id uint64) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByIDForUpdate(ctx context.Context, tx *gorm.DB, id uint64) (*domain.User, error) {
	var user domain.User
	if tx != nil {
		if err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, id).Error; err != nil {
			return nil, err
		}
		return &user, nil
	}
	if err := r.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) List(ctx context.Context, page, pageSize int, keyword string) ([]domain.User, int64, error) {
	var users []domain.User
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.User{})
	if keyword != "" {
		query = query.Where("username LIKE ? OR email LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *UserRepository) Update(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *UserRepository) Delete(ctx context.Context, id uint64) error {
	return r.db.WithContext(ctx).Delete(&domain.User{}, id).Error
}

// FindByIDWithTx finds a user by ID within the given transaction.
func (r *UserRepository) FindByIDWithTx(ctx context.Context, tx *gorm.DB, id uint64) (*domain.User, error) {
	var user domain.User
	if err := tx.WithContext(ctx).First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// DeleteWithTx deletes a user by ID within the given transaction.
func (r *UserRepository) DeleteWithTx(ctx context.Context, tx *gorm.DB, id uint64) error {
	return tx.WithContext(ctx).Delete(&domain.User{}, id).Error
}

// UpdateWithTx updates a user within the given transaction.
func (r *UserRepository) UpdateWithTx(ctx context.Context, tx *gorm.DB, user *domain.User) error {
	return tx.WithContext(ctx).Save(user).Error
}

// IncrementPlaygroundTrials atomically increments the playground_trials_used counter.
func (r *UserRepository) IncrementPlaygroundTrials(ctx context.Context, userID uint64) error {
	return r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", userID).
		UpdateColumn("playground_trials_used", gorm.Expr("playground_trials_used + 1")).Error
}

// ClaimPlaygroundTrial atomically claims one free trial slot.
// Returns true if a trial was claimed (i.e., user was below the limit), false if limit reached.
// This prevents race conditions from concurrent requests.
func (r *UserRepository) ClaimPlaygroundTrial(ctx context.Context, userID uint64, maxTrials int) (bool, error) {
	result := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ? AND playground_trials_used < ?", userID, maxTrials).
		UpdateColumn("playground_trials_used", gorm.Expr("playground_trials_used + 1"))
	return result.RowsAffected > 0, result.Error
}

// CountByRole returns the number of users with the given role.
func (r *UserRepository) CountByRole(ctx context.Context, role domain.Role) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&domain.User{}).Where("role = ?", role).Count(&count).Error
	return count, err
}

// IsActive checks if a user exists and is in active status.
// Returns false if the user is not found, disabled, or pending.
func (r *UserRepository) IsActive(ctx context.Context, id uint64) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ? AND status = ?", id, domain.UserActive).Count(&count).Error
	return count > 0, err
}
