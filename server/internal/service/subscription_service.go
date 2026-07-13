package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrSubscriptionPlanNotFound = errors.New("subscription plan not found")
	ErrSubscriptionNotFound     = errors.New("subscription not found")
	ErrSubscriptionNotActive    = errors.New("subscription not active")
)

type SubscriptionService struct {
	db             *gorm.DB
	planRepo       *repository.SubscriptionPlanRepository
	subRepo        *repository.UserSubscriptionRepository
	topUpRepo      *repository.TopUpRepository
	billingService *BillingService
}

func NewSubscriptionService(db *gorm.DB, planRepo *repository.SubscriptionPlanRepository, subRepo *repository.UserSubscriptionRepository, topUpRepo *repository.TopUpRepository, billingService *BillingService) *SubscriptionService {
	return &SubscriptionService{db: db, planRepo: planRepo, subRepo: subRepo, topUpRepo: topUpRepo, billingService: billingService}
}

func (s *SubscriptionService) CreatePlan(ctx context.Context, req *dto.CreateSubscriptionPlanRequest) (*domain.SubscriptionPlan, error) {
	plan := &domain.SubscriptionPlan{
		Name:           req.Name,
		QuotaValue:     req.QuotaValue,
		PriceCents:     req.PriceCents,
		Currency:       req.Currency,
		IntervalMonths: req.IntervalMonths,
		Status:         domain.SubscriptionPlanEnabled,
		SortOrder:      req.SortOrder,
	}
	if plan.Currency == "" {
		plan.Currency = "CNY"
	}
	if plan.IntervalMonths <= 0 {
		plan.IntervalMonths = 1
	}
	return plan, s.planRepo.Create(ctx, nil, plan)
}

func (s *SubscriptionService) ListPlans(ctx context.Context, onlyEnabled bool, page, pageSize int) ([]domain.SubscriptionPlan, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.planRepo.List(ctx, onlyEnabled, page, pageSize)
}

func (s *SubscriptionService) Subscribe(ctx context.Context, userID, planID uint64) (*domain.UserSubscription, error) {
	plan, err := s.planRepo.FindByID(ctx, planID)
	if err != nil {
		return nil, ErrSubscriptionPlanNotFound
	}
	if plan.Status != domain.SubscriptionPlanEnabled {
		return nil, errors.New("subscription plan not available")
	}

	now := time.Now().UTC()
	expiresAt := now.AddDate(0, plan.IntervalMonths, 0)
	sub := &domain.UserSubscription{
		UserID:       userID,
		PlanID:       planID,
		Status:       domain.UserSubscriptionActive,
		StartedAt:    now,
		ExpiresAt:    expiresAt,
		LastBilledAt: &now,
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// Check for existing active subscription (prevent stacking) — FOR UPDATE locks matching rows and gap, preventing concurrent inserts
		var existing domain.UserSubscription
		if err := tx.WithContext(ctx).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND status = ?", userID, domain.UserSubscriptionActive).
			First(&existing).Error; err == nil {
			return errors.New("user already has an active subscription")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// Re-read plan inside transaction to prevent TOCTOU
		var txPlan domain.SubscriptionPlan
		if err := tx.WithContext(ctx).First(&txPlan, planID).Error; err != nil {
			return ErrSubscriptionPlanNotFound
		}
		if txPlan.Status != domain.SubscriptionPlanEnabled {
			return errors.New("subscription plan not available")
		}
		sub.ExpiresAt = now.AddDate(0, txPlan.IntervalMonths, 0)

		if err := s.subRepo.Create(ctx, tx, sub); err != nil {
			return err
		}
		// Create a PENDING top-up order — payment must be confirmed via webhook or admin
		topUp := &domain.TopUp{
			UserID:        userID,
			QuotaGranted:  0, // quota granted only on MarkPaid
			AmountCents:   txPlan.PriceCents,
			Currency:      txPlan.Currency,
			PaymentMethod: "subscription",
			PaymentStatus: domain.TopUpPending,
		}
		if err := s.topUpRepo.Create(ctx, tx, topUp); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return sub, nil
}


func (s *SubscriptionService) createTopUpAndRechargeTx(ctx context.Context, tx *gorm.DB, userID, planID uint64, quotaValue, priceCents int64, currency, description string) error {
	topUp := &domain.TopUp{
		UserID:        userID,
		QuotaGranted:  quotaValue,
		AmountCents:   priceCents,
		Currency:      currency,
		PaymentMethod: "subscription",
		PaymentStatus: domain.TopUpSuccess,
		PaidAt:        ptrTime(time.Now().UTC()),
	}
	if err := s.topUpRepo.Create(ctx, tx, topUp); err != nil {
		return err
	}
	return s.billingService.RechargeTx(ctx, tx, userID, 0, quotaValue, "subscription", fmt.Sprintf("%d", topUp.ID), description)
}

func (s *SubscriptionService) Cancel(ctx context.Context, userID, subscriptionID uint64) (*domain.UserSubscription, error) {
	var sub *domain.UserSubscription
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var err error
		sub, err = s.subRepo.FindByIDForUpdate(ctx, tx, subscriptionID)
		if err != nil {
			return ErrSubscriptionNotFound
		}
		if sub.UserID != userID {
			return ErrSubscriptionNotFound
		}
		if sub.Status != domain.UserSubscriptionActive {
			return ErrSubscriptionNotActive
		}
		sub.Status = domain.UserSubscriptionCancelled
		return s.subRepo.Update(ctx, tx, sub)
	}); err != nil {
		return nil, err
	}
	return sub, nil
}

func (s *SubscriptionService) ListByUser(ctx context.Context, userID uint64, page, pageSize int) ([]domain.UserSubscription, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.subRepo.ListByUserID(ctx, userID, page, pageSize)
}

func (s *SubscriptionService) ListPendingRenewal(ctx context.Context, before time.Time, page, pageSize int) ([]domain.UserSubscription, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.subRepo.FindPendingRenewal(ctx, before, page, pageSize)
}

// ListPendingRenewalAfterID uses cursor-based pagination to avoid skipping
// subscriptions whose expires_at changes after renewal.
func (s *SubscriptionService) ListPendingRenewalAfterID(ctx context.Context, before time.Time, afterID uint64, limit int) ([]domain.UserSubscription, error) {
	return s.subRepo.FindPendingRenewalAfterID(ctx, before, afterID, limit)
}

func (s *SubscriptionService) UpdatePlan(ctx context.Context, id uint64, req *dto.UpdateSubscriptionPlanRequest) (*domain.SubscriptionPlan, error) {
	plan, err := s.planRepo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrSubscriptionPlanNotFound
	}
	if req.Name != nil {
		plan.Name = *req.Name
	}
	if req.QuotaValue != nil {
		plan.QuotaValue = *req.QuotaValue
	}
	if req.PriceCents != nil {
		plan.PriceCents = *req.PriceCents
	}
	if req.Currency != nil {
		plan.Currency = *req.Currency
	}
	if req.IntervalMonths != nil {
		plan.IntervalMonths = *req.IntervalMonths
	}
	if req.Status != nil {
		plan.Status = domain.SubscriptionPlanStatus(*req.Status)
	}
	if req.SortOrder != nil {
		plan.SortOrder = *req.SortOrder
	}
	return plan, s.planRepo.Update(ctx, nil, plan)
}

func (s *SubscriptionService) DeletePlan(ctx context.Context, id uint64) error {
	if _, err := s.planRepo.FindByID(ctx, id); err != nil {
		return ErrSubscriptionPlanNotFound
	}
	var count int64
	if err := s.db.WithContext(ctx).Model(&domain.UserSubscription{}).
		Where("plan_id = ? AND status = ?", id, domain.UserSubscriptionActive).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("cannot delete plan with active subscriptions")
	}
	return s.planRepo.Delete(ctx, id)
}

func (s *SubscriptionService) Renew(ctx context.Context, subscriptionID uint64) (*domain.UserSubscription, error) {
	var sub *domain.UserSubscription
	var insufficientBalance bool
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var err error
		sub, err = s.subRepo.FindByIDForUpdate(ctx, tx, subscriptionID)
		if err != nil {
			return err
		}
		if sub.Status != domain.UserSubscriptionActive {
			return ErrSubscriptionNotActive
		}
		// Only renew subscriptions that have expired (idempotency — prevents double-granting quota)
		if sub.ExpiresAt.After(time.Now().UTC()) {
			return errors.New("subscription not yet due for renewal")
		}
		// Re-read plan inside transaction to prevent TOCTOU
		var plan domain.SubscriptionPlan
		if err := tx.WithContext(ctx).First(&plan, sub.PlanID).Error; err != nil {
			return err
		}
		// Check user balance and deduct subscription price before granting quota
		userRepo := repository.NewUserRepository(tx)
		user, err := userRepo.FindByIDForUpdate(ctx, tx, sub.UserID)
		if err != nil {
			return err
		}
		if user.Quota < plan.PriceCents {
			// Insufficient balance — mark subscription as expired and commit
			sub.Status = domain.UserSubscriptionExpired
			if err := s.subRepo.Update(ctx, tx, sub); err != nil {
				return err
			}
			insufficientBalance = true
			return nil
		}
		// Deduct subscription price from user balance
		user.Quota -= plan.PriceCents
		if err := userRepo.Update(ctx, user); err != nil {
			return err
		}
			renewedAt := time.Now().UTC()
		if err := s.createTopUpAndRechargeTx(ctx, tx, sub.UserID, plan.ID, plan.QuotaValue, plan.PriceCents, plan.Currency, fmt.Sprintf("subscription renewal %d", sub.ID)); err != nil {
			return err
		}
		sub.ExpiresAt = renewedAt.AddDate(0, plan.IntervalMonths, 0)
		sub.LastBilledAt = &renewedAt
		return s.subRepo.Update(ctx, tx, sub)
	}); err != nil {
		return nil, err
	}
	if insufficientBalance {
		return sub, ErrInsufficientQuota
	}
	return sub, nil
}
