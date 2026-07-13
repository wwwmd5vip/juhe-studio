package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrUserExists       = errors.New("username or email already exists")
	ErrUserNotFound     = errors.New("user not found")
	ErrInvalidRole      = errors.New("invalid role")
	ErrCannotDeleteSelf = errors.New("cannot delete yourself")
	ErrCannotDeleteRoot = errors.New("cannot delete root user")
)

type UserService struct {
	cfg            *config.Config
	db             *gorm.DB
	userRepo       *repository.UserRepository
	billingService *BillingService
}

func NewUserService(cfg *config.Config, db *gorm.DB, userRepo *repository.UserRepository, billingService *BillingService) *UserService {
	return &UserService{cfg: cfg, db: db, userRepo: userRepo, billingService: billingService}
}

func (s *UserService) CreateUser(ctx context.Context, req *dto.CreateUserRequest, operatorRole domain.Role) (*domain.User, error) {
	if _, err := s.userRepo.FindByUsername(ctx, req.Username); err == nil {
		return nil, ErrUserExists
	}
	if req.Email != "" {
		if _, err := s.userRepo.FindByEmail(ctx, req.Email); err == nil {
			return nil, ErrUserExists
		}
	}

	if !s.canManageRole(operatorRole, domain.Role(req.Role)) {
		return nil, ErrInvalidRole
	}

	hash, err := utils.HashPassword(req.Password, s.cfg.BcryptCost)
	if err != nil {
		return nil, err
	}

	group := req.Group
	if group == "" {
		group = "default"
	}

	user := &domain.User{
		Username:     req.Username,
		Email:        &req.Email,
		PasswordHash: hash,
		Role:         domain.Role(req.Role),
		Status:       domain.UserActive,
		Group:        group,
	}
	if req.Email == "" {
		user.Email = nil
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) ListUsers(ctx context.Context, page, pageSize int, keyword string) ([]domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.userRepo.List(ctx, page, pageSize, keyword)
}

func (s *UserService) GetUser(ctx context.Context, id uint64) (*domain.User, error) {
	return s.userRepo.FindByID(ctx, id)
}

func (s *UserService) UpdateUser(ctx context.Context, id uint64, req *dto.UpdateUserRequest, operatorRole domain.Role) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrUserNotFound
	}

	if req.Role != nil {
		if !s.canManageRole(operatorRole, domain.Role(*req.Role)) {
			return nil, ErrInvalidRole
		}
		// Prevent demoting the last admin to a non-admin role
		if user.Role >= domain.RoleAdmin && domain.Role(*req.Role) < domain.RoleAdmin {
			count, countErr := s.userRepo.CountByRole(ctx, domain.RoleAdmin)
			if countErr != nil {
				return nil, countErr
			}
			if count <= 1 {
				return nil, errors.New("cannot demote the last admin")
			}
		}
		user.Role = domain.Role(*req.Role)
	}
	if req.Email != nil {
		user.Email = req.Email
	}
	if req.Status != nil {
		user.Status = domain.UserStatus(*req.Status)
	}
	if req.Group != nil {
		user.Group = *req.Group
	}
	if req.Quota != nil {
		user.Quota = *req.Quota
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) DeleteUser(ctx context.Context, id uint64, operatorID uint64) error {
	if id == operatorID {
		return ErrCannotDeleteSelf
	}
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		return ErrUserNotFound
	}
	if user.Role == domain.RoleRoot {
		return ErrCannotDeleteRoot
	}
	return s.userRepo.Delete(ctx, id)
}

func (s *UserService) BatchDeleteUsers(ctx context.Context, ids []uint64, operatorID uint64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, id := range ids {
			if id == operatorID {
				return ErrCannotDeleteSelf
			}
			user, err := s.userRepo.FindByIDWithTx(ctx, tx, id)
			if err != nil {
				return ErrUserNotFound
			}
			if user.Role == domain.RoleRoot {
				return ErrCannotDeleteRoot
			}
			if err := s.userRepo.DeleteWithTx(ctx, tx, id); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *UserService) BatchUpdateUserStatus(ctx context.Context, ids []uint64, status int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, id := range ids {
			user, err := s.userRepo.FindByIDWithTx(ctx, tx, id)
			if err != nil {
				return err
			}
			if user.Role == domain.RoleRoot {
				return errors.New("cannot deactivate root user")
			}
			user.Status = domain.UserStatus(status)
			if err := s.userRepo.UpdateWithTx(ctx, tx, user); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *UserService) AdjustQuota(ctx context.Context, id uint64, amount int64, description string) (*domain.User, error) {
	if amount == 0 {
		return nil, ErrInvalidAmount
	}
	if _, err := s.userRepo.FindByID(ctx, id); err != nil {
		return nil, ErrUserNotFound
	}

	if err := s.billingService.RecordAdjust(ctx, id, amount, description); err != nil {
		return nil, err
	}

	return s.userRepo.FindByID(ctx, id)
}

func (s *UserService) UpdatePassword(ctx context.Context, id uint64, oldPassword, newPassword string) error {
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		return ErrUserNotFound
	}

	if !utils.CheckPassword(oldPassword, user.PasswordHash) {
		return errors.New("old password is incorrect")
	}

	if len(newPassword) < s.cfg.MinPasswordLength {
		return fmt.Errorf("new password must be at least %d characters", s.cfg.MinPasswordLength)
	}

	hash, err := utils.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		return err
	}

	user.PasswordHash = hash
	return s.userRepo.Update(ctx, user)
}

// AdminSetPassword 管理员重置用户密码（无需旧密码）
// operatorRole is checked against target user's role to prevent privilege escalation.
func (s *UserService) AdminSetPassword(ctx context.Context, id uint64, newPassword string, operatorRole domain.Role) error {
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		return ErrUserNotFound
	}
	if !s.canManageRole(operatorRole, user.Role) {
		return ErrInvalidRole
	}
	if len(newPassword) < s.cfg.MinPasswordLength {
		return fmt.Errorf("new password must be at least %d characters", s.cfg.MinPasswordLength)
	}
	hash, err := utils.HashPassword(newPassword, s.cfg.BcryptCost)
	if err != nil {
		return err
	}
	user.PasswordHash = hash
	return s.userRepo.Update(ctx, user)
}

func (s *UserService) canManageRole(operator, target domain.Role) bool {
	return operator > target
}
