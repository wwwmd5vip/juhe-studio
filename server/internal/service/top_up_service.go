package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrTopUpNotFound      = errors.New("topup not found")
	ErrTopUpAlreadyDone   = errors.New("topup already processed")
	ErrInvalidTopUpAmount = errors.New("invalid topup amount")
	ErrTopUpNotRefundable = errors.New("topup not refundable")
)

type TopUpService struct {
	db             *gorm.DB
	topUpRepo      *repository.TopUpRepository
	packageRepo    *repository.QuotaPackageRepository
	billingService *BillingService
}

func NewTopUpService(db *gorm.DB, topUpRepo *repository.TopUpRepository, packageRepo *repository.QuotaPackageRepository, billingService *BillingService) *TopUpService {
	return &TopUpService{db: db, topUpRepo: topUpRepo, packageRepo: packageRepo, billingService: billingService}
}

func (s *TopUpService) CreateManualTopUp(ctx context.Context, userID, quotaGranted uint64) (*domain.TopUp, error) {
	if quotaGranted == 0 {
		return nil, ErrInvalidTopUpAmount
	}
	topUp := &domain.TopUp{
		UserID:        userID,
		AmountCents:   int64(quotaGranted),
		QuotaGranted:  int64(quotaGranted),
		Currency:      "CNY",
		PaymentMethod: "manual",
		PaymentStatus: domain.TopUpSuccess,
		PaidAt:        ptrTime(time.Now().UTC()),
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.topUpRepo.Create(ctx, tx, topUp); err != nil {
			return err
		}
		return s.billingService.RechargeTx(ctx, tx, userID, 0, int64(quotaGranted), "topup", fmt.Sprintf("%d", topUp.ID), "manual topup")
	}); err != nil {
		return nil, err
	}
	return topUp, nil
}

func (s *TopUpService) CreatePackageOrder(ctx context.Context, userID, packageID uint64, paymentMethod string) (*domain.TopUp, error) {
	pkg, err := s.packageRepo.FindByID(ctx, packageID)
	if err != nil {
		return nil, err
	}
	if pkg.Status != domain.QuotaPackageEnabled {
		return nil, errors.New("quota package not available")
	}
	topUp := &domain.TopUp{
		UserID:        userID,
		PackageID:     &packageID,
		AmountCents:   pkg.PriceCents,
		QuotaGranted:  pkg.QuotaValue,
		Currency:      pkg.Currency,
		PaymentMethod: paymentMethod,
		PaymentStatus: domain.TopUpPending,
	}
	if err := s.topUpRepo.Create(ctx, nil, topUp); err != nil {
		return nil, err
	}
	return topUp, nil
}

func (s *TopUpService) MarkPaid(ctx context.Context, orderID uint64, transactionID string) (*domain.TopUp, error) {
	return s.updateStatus(ctx, orderID, domain.TopUpSuccess, func(t *domain.TopUp, _ domain.TopUpStatus, tx *gorm.DB) error {
		now := time.Now().UTC()
		t.PaidAt = &now
		t.TransactionID = &transactionID
		quotaGranted := t.QuotaGranted
		// For subscription top-ups created with QuotaGranted=0, look up the plan's QuotaValue.
		if quotaGranted == 0 && t.PaymentMethod == "subscription" {
			var sub domain.UserSubscription
			// Match most recently created active subscription for this user
			if err := tx.WithContext(ctx).Where("user_id = ? AND status = ?", t.UserID, domain.UserSubscriptionActive).
				Order("created_at DESC").First(&sub).Error; err == nil {
				var plan domain.SubscriptionPlan
				if err := tx.WithContext(ctx).First(&plan, sub.PlanID).Error; err == nil {
					quotaGranted = plan.QuotaValue
				}
			}
		}
		return s.billingService.RechargeTx(ctx, tx, t.UserID, 0, quotaGranted, "topup", fmt.Sprintf("%d", t.ID), "package order")
	}, domain.TopUpPending)
}

func (s *TopUpService) MarkFailed(ctx context.Context, orderID uint64) (*domain.TopUp, error) {
	return s.updateStatus(ctx, orderID, domain.TopUpFailed, nil, domain.TopUpPending)
}

func (s *TopUpService) RefundOrder(ctx context.Context, orderID uint64) (*domain.TopUp, error) {
	return s.updateStatus(ctx, orderID, domain.TopUpRefunded, func(t *domain.TopUp, originalStatus domain.TopUpStatus, tx *gorm.DB) error {
		if originalStatus != domain.TopUpSuccess {
			return ErrTopUpNotRefundable
		}
		return s.billingService.RechargeTx(ctx, tx, t.UserID, 0, -t.QuotaGranted, "refund", fmt.Sprintf("%d", t.ID), "topup refund")
	}, domain.TopUpPending, domain.TopUpSuccess)
}

func (s *TopUpService) updateStatus(ctx context.Context, orderID uint64, status domain.TopUpStatus, after func(*domain.TopUp, domain.TopUpStatus, *gorm.DB) error, allowedStatuses ...domain.TopUpStatus) (*domain.TopUp, error) {
	var topUp *domain.TopUp
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		t, err := s.topUpRepo.FindByIDForUpdate(ctx, tx, orderID)
		if err != nil {
			return err
		}
		if !containsTopUpStatus(allowedStatuses, t.PaymentStatus) {
			return ErrTopUpAlreadyDone
		}
		originalStatus := t.PaymentStatus
		t.PaymentStatus = status
		if err := s.topUpRepo.Update(ctx, tx, t); err != nil {
			return err
		}
		if after != nil {
			if err := after(t, originalStatus, tx); err != nil {
				return err
			}
		}
		topUp = t
		return nil
	}); err != nil {
		return nil, err
	}
	return topUp, nil
}

func containsTopUpStatus(statuses []domain.TopUpStatus, status domain.TopUpStatus) bool {
	for _, s := range statuses {
		if s == status {
			return true
		}
	}
	return false
}

func (s *TopUpService) List(ctx context.Context, userID *uint64, page, pageSize int, status, startDate, endDate string) ([]domain.TopUp, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.topUpRepo.List(ctx, userID, page, pageSize, status, startDate, endDate)
}

func (s *TopUpService) Get(ctx context.Context, id uint64) (*domain.TopUp, error) {
	return s.topUpRepo.FindByID(ctx, id)
}

func normalizePagination(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}

// BatchUpdateStatus updates the payment_status of multiple top-up orders.
// When marking as paid, it also recharges the user's quota via RechargeTx.
// Status transitions are validated: only Pending orders can move to Success/Failed.
func (s *TopUpService) BatchUpdateStatus(ctx context.Context, ids []uint64, status string) (int, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids is required")
	}
	if status == "" {
		return 0, errors.New("status is required")
	}

	var targetStatus domain.TopUpStatus
	switch status {
	case "paid":
		targetStatus = domain.TopUpSuccess
	case "failed":
		targetStatus = domain.TopUpFailed
	default:
		return 0, fmt.Errorf("invalid status: %s (must be paid or failed)", status)
	}

	affected := 0
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// Fetch orders with row lock to prevent races
		var orders []domain.TopUp
		if err := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id IN ?", ids).Find(&orders).Error; err != nil {
			return err
		}

		for i := range orders {
			order := &orders[i]

			// Only allow transition from Pending
			if order.PaymentStatus != domain.TopUpPending {
				continue
			}
			order.PaymentStatus = targetStatus
			affected++

			if targetStatus == domain.TopUpSuccess {
				now := time.Now().UTC()
				order.PaidAt = &now
			}

			updates := map[string]interface{}{"payment_status": targetStatus}
			if targetStatus == domain.TopUpSuccess {
				updates["paid_at"] = order.PaidAt
			}
			if err := tx.WithContext(ctx).Model(&order).Updates(updates).Error; err != nil {
				return err
			}

			// Recharge quota when marking as paid
			if targetStatus == domain.TopUpSuccess {
				quotaGranted := order.QuotaGranted
				// For subscription orders with QuotaGranted=0, look up plan value
				if quotaGranted == 0 && order.PaymentMethod == "subscription" {
					var sub domain.UserSubscription
					if err := tx.WithContext(ctx).Where("user_id = ? AND status = ?", order.UserID, domain.UserSubscriptionActive).
						Order("created_at DESC").First(&sub).Error; err == nil {
						var plan domain.SubscriptionPlan
						if err := tx.WithContext(ctx).First(&plan, sub.PlanID).Error; err == nil {
							quotaGranted = plan.QuotaValue
						}
					}
				}
				if err := s.billingService.RechargeTx(ctx, tx, order.UserID, 0,
					quotaGranted, "topup", fmt.Sprintf("%d", order.ID), "batch mark paid"); err != nil {
					return err
				}
			}
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return affected, nil
}

func ptrTime(t time.Time) *time.Time { return &t }
