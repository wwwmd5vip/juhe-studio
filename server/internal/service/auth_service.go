package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/juhe-management/server/internal/common/email"
	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/config"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrInvalidCredentials   = errors.New("invalid username or password")
	ErrUserDisabled         = errors.New("user is disabled")
	ErrEmailAlreadyVerified = errors.New("email already verified")
	ErrVerificationExpired  = errors.New("verification code expired or not found")
	ErrInvalidCode          = errors.New("invalid verification code")
	ErrSMTPNotConfigured    = errors.New("smtp not configured, registration disabled")
	ErrRegistrationDisabled = errors.New("registration is currently disabled")
	ErrPasswordTooShort     = errors.New("password is too short")
)

type AuthService struct {
	cfg                   *config.Config
	db                    *gorm.DB
	userRepo              *repository.UserRepository
	emailVerificationRepo *repository.EmailVerificationRepository
	emailSender           *email.Sender
	settingService        *SettingService
}

func NewAuthService(cfg *config.Config, db *gorm.DB, userRepo *repository.UserRepository, emailVerificationRepo *repository.EmailVerificationRepository, emailSender *email.Sender, settingService *SettingService) *AuthService {
	return &AuthService{
		cfg:                   cfg,
		db:                    db,
		userRepo:              userRepo,
		emailVerificationRepo: emailVerificationRepo,
		emailSender:           emailSender,
		settingService:        settingService,
	}
}

// dummyBcryptHash 用于在用户不存在时消除时序侧信道
var dummyBcryptHash = "$2a$10$XvIKnDOyoJHNdQAiTra6TuXkgQmFariQ.zi3Abe0rTAvCN0Vkach2"

func (s *AuthService) Login(ctx context.Context, username, password string) (string, time.Time, *domain.User, error) {
	user, err := s.userRepo.FindByUsername(ctx, username)
	if err != nil {
		utils.CheckPassword(password, dummyBcryptHash)
		return "", time.Time{}, nil, ErrInvalidCredentials
	}

	if user.Status == domain.UserDisabled {
		return "", time.Time{}, nil, ErrUserDisabled
	}
	if user.Status == domain.UserPending {
		return "", time.Time{}, nil, errors.New("请先验证邮箱后再登录")
	}

	if !utils.CheckPassword(password, user.PasswordHash) {
		return "", time.Time{}, nil, ErrInvalidCredentials
	}

	ttl := 24 * time.Hour
	expiresAt := time.Now().Add(ttl)
	token, err := utils.GenerateJWT(s.cfg.JWT.Secret, user.ID, int(user.Role), ttl)
	if err != nil {
		return "", time.Time{}, nil, err
	}

	return token, expiresAt, user, nil
}

func (s *AuthService) Register(ctx context.Context, username, emailAddr, password string) error {
	// Check registration enabled — default to enabled on setting read error
	enabled, settingErr := s.settingService.GetBool(ctx, "registration_enabled")
	if settingErr != nil {
		// Setting not found or DB error — log and default to allowing registration
		log.Printf("WARNING: failed to read registration_enabled setting: %v, defaulting to enabled", settingErr)
	} else if !enabled {
		return ErrRegistrationDisabled
	}

	// Check email verification required
	emailVerificationRequired, _ := s.settingService.GetBool(ctx, "email_verification_required")

	// Check password length
	minLenStr, _ := s.settingService.GetString(ctx, "password_min_length")
	minLen := 8
	if minLenStr != "" {
		if n, err := strconv.Atoi(minLenStr); err == nil && n > 0 {
			minLen = n
		}
	}
	if len(password) < minLen {
		return fmt.Errorf("%w: minimum %d characters required", ErrPasswordTooShort, minLen)
	}

	// Check SMTP config when verification is required
	if emailVerificationRequired {
		smtpHost, _ := s.settingService.GetString(ctx, "smtp_host")
		if smtpHost == "" {
			return ErrSMTPNotConfigured
		}
	}

	// Check username uniqueness
	if _, err := s.userRepo.FindByUsername(ctx, username); err == nil {
		return ErrUserExists
	}
	// Check email uniqueness
	if _, err := s.userRepo.FindByEmail(ctx, emailAddr); err == nil {
		return ErrUserExists
	}

	// Hash password
	hash, err := utils.HashPassword(password, s.cfg.BcryptCost)
	if err != nil {
		return err
	}

	// Create user (role=1 normal user)
	// When email verification is required, status=pending; otherwise status=active.
	emailStr := emailAddr
	status := domain.UserActive
	if emailVerificationRequired {
		status = domain.UserPending
	}
	user := &domain.User{
		Username:     username,
		Email:        &emailStr,
		PasswordHash: hash,
		Role:         domain.RoleUser,
		Status:       status,
		Group:        "default",
	}

	// If email verification is not required, just create the user.
	if !emailVerificationRequired {
		return s.userRepo.Create(ctx, user)
	}

	// Generate verification code
	code := email.GenerateCode()

	// Create user + verification record in a single transaction.
	// Email sending is deferred to after the transaction commits (network IO).
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Where("email = ?", emailAddr).Delete(&domain.EmailVerification{}).Error; err != nil {
			return err
		}
		verification := &domain.EmailVerification{
			Email:     emailAddr,
			Code:      code,
			Verified:  false,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}
		return tx.Create(verification).Error
	}); err != nil {
		return err
	}

	// Send verification email (outside transaction)
	return s.emailSender.SendVerificationEmail(ctx, emailAddr, code)
}

func (s *AuthService) VerifyEmail(ctx context.Context, code string) error {
	v, err := s.emailVerificationRepo.FindByCode(ctx, code)
	if err != nil {
		return ErrVerificationExpired
	}

	if v.Verified {
		return ErrEmailAlreadyVerified
	}

	if time.Now().After(v.ExpiresAt) {
		return ErrVerificationExpired
	}

	// Mark verification record as verified + activate user in a single transaction.
	// Use atomic CAS (WHERE verified = false) to prevent TOCTOU race.
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&domain.EmailVerification{}).Where("id = ? AND verified = ?", v.ID, false).Update("verified", true)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrEmailAlreadyVerified
		}
		var user domain.User
		if err := tx.Where("email = ?", v.Email).First(&user).Error; err != nil {
			return err
		}
		user.Status = domain.UserActive
		return tx.Save(&user).Error
	})
}

func (s *AuthService) VerifyPassword(ctx context.Context, userID uint64, password string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return ErrInvalidCredentials
	}

	if user.Status == domain.UserDisabled {
		return ErrUserDisabled
	}
	if user.Status == domain.UserPending {
		return errors.New("请先验证邮箱")
	}

	if !utils.CheckPassword(password, user.PasswordHash) {
		return ErrInvalidCredentials
	}

	return nil
}

var ErrEmailNotFound = errors.New("email not found")

// ResendVerification regenerates and sends a new verification code for the given email
func (s *AuthService) ResendVerification(ctx context.Context, emailAddr string) error {
	// Check email exists in EmailVerification table (has an existing registration)
	v, err := s.emailVerificationRepo.FindByEmail(ctx, emailAddr)
	if err != nil {
		return ErrEmailNotFound
	}

	if v.Verified {
		return ErrEmailAlreadyVerified
	}

	// Generate new code
	code := email.GenerateCode()

	// Delete old verification record + create new one in a single transaction.
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("email = ?", emailAddr).Delete(&domain.EmailVerification{}).Error; err != nil {
			return err
		}
		verification := &domain.EmailVerification{
			Email:     emailAddr,
			Code:      code,
			Verified:  false,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}
		return tx.Create(verification).Error
	}); err != nil {
		return err
	}

	// Send verification email (outside transaction)
	return s.emailSender.SendVerificationEmail(ctx, emailAddr, code)
}
