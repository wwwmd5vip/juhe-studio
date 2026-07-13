package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/ws"
	"gorm.io/gorm"
)

var (
	ErrInsufficientQuota = errors.New("insufficient quota")
	ErrInvalidAmount     = errors.New("invalid amount")
	ErrNoImagePricing    = errors.New("no pricing configured for image generation")
)

type BillingService struct {
	db              *gorm.DB
	pricingRepo     *repository.PricingRepository
	userRepo        *repository.UserRepository
	tokenRepo       *repository.TokenRepository
	logRepo         *repository.LogRepository
	transactionRepo *repository.QuotaTransactionRepository
	dailyBillRepo   *repository.DailyBillRepository
	settingRepo     *repository.SettingRepository
	broadcaster     ws.Broadcaster
}

func NewBillingService(db *gorm.DB, pricingRepo *repository.PricingRepository, userRepo *repository.UserRepository, tokenRepo *repository.TokenRepository, logRepo *repository.LogRepository, transactionRepo *repository.QuotaTransactionRepository, dailyBillRepo *repository.DailyBillRepository, settingRepo *repository.SettingRepository, broadcaster ws.Broadcaster) *BillingService {
	return &BillingService{
		db:              db,
		pricingRepo:     pricingRepo,
		userRepo:        userRepo,
		tokenRepo:       tokenRepo,
		logRepo:         logRepo,
		transactionRepo: transactionRepo,
		dailyBillRepo:   dailyBillRepo,
		settingRepo:     settingRepo,
		broadcaster:     broadcaster,
	}
}

func (s *BillingService) ListTransactions(ctx context.Context, userID uint64, page, pageSize int) ([]domain.QuotaTransaction, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.transactionRepo.ListByUserID(ctx, userID, page, pageSize)
}

func (s *BillingService) ListFilteredTransactions(ctx context.Context, page, pageSize int, userID uint64, trType, startDate, endDate string) ([]dto.QuotaTransactionInfo, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	list, total, err := s.transactionRepo.ListFiltered(ctx, page, pageSize, userID, trType, startDate, endDate)
	if err != nil {
		return nil, 0, err
	}
	return ToQuotaTransactionInfoList(list), total, nil
}

func (s *BillingService) GetPricing(ctx context.Context, modelName, group string) (*domain.Pricing, error) {
	// 1. 先查指定分组
	pricing, err := s.pricingRepo.FindByModelAndGroup(ctx, modelName, group)
	if err == nil {
		return pricing, nil
	}
	// 2. 回退到 "default" 分组
	if group != "default" {
		pricing, err = s.pricingRepo.FindByModelAndGroup(ctx, modelName, "default")
		if err == nil {
			return pricing, nil
		}
	}
	// 将 GORM record-not-found 转换为业务错误，避免向客户端泄露 "record not found"
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrModelNotSupported
	}
	return nil, err
}

// CalculateChatCost returns cost in cents (quota).
// promptTokens = total prompt tokens, cachedPromptTokens = cache-hit tokens (subset of prompt),
// completionTokens = output tokens.
// Formula: (uncached_prompt × 1 + cached_prompt × cached_ratio + completion × completion_ratio) × model_ratio / 1000
func (s *BillingService) CalculateChatCost(pricing *domain.Pricing, promptTokens, cachedPromptTokens, completionTokens int) int64 {
	if pricing == nil {
		return 0
	}
	ratio := pricing.ModelRatio
	if ratio == 0 {
		ratio = 1
	}
	completionRatio := pricing.CompletionRatio
	if completionRatio == 0 {
		completionRatio = 1
	}
	cachedRatio := pricing.CachedTokensRatio
	// CachedTokensRatio=0 means no separate charge for cached tokens (default).

	uncachedPrompt := promptTokens - cachedPromptTokens
	if uncachedPrompt < 0 {
		uncachedPrompt = 0
	}

	// Use float64 multiplication directly to avoid precision loss from intermediate int() truncation
	effectiveTokens := float64(uncachedPrompt) + cachedRatio*float64(cachedPromptTokens) + completionRatio*float64(completionTokens)
	cost := math.Ceil(math.Round(effectiveTokens*ratio/1000.0*1e6) / 1e6)
	if cost > float64(math.MaxInt64) {
		return math.MaxInt64
	}
	if cost < 0 {
		return 0
	}
	return int64(cost)
}

// CalculateImageCost returns cost in cents (quota). Returns error if pricing is missing.
func (s *BillingService) CalculateImageCost(pricing *domain.Pricing, n int) (int64, error) {
	if pricing == nil {
		return 0, ErrNoImagePricing
	}
	if pricing.FixedPriceCents == nil || *pricing.FixedPriceCents == 0 {
		return 0, ErrNoImagePricing
	}
	ratio := pricing.ImageRatio
	if ratio == 0 {
		ratio = 1
	}
	if n <= 0 {
		n = 1
	}
	return int64(math.Ceil(float64(*pricing.FixedPriceCents) * float64(n) * ratio)), nil
}

// CalculateEmbeddingCost estimates cost based on token count and model ratio.
func (s *BillingService) CalculateEmbeddingCost(pricing *domain.Pricing, estimatedTokens int) int64 {
	if pricing == nil {
		return 0
	}
	ratio := pricing.ModelRatio
	if ratio == 0 {
		ratio = 1
	}
	cost := float64(estimatedTokens) * ratio / 1000.0
	return int64(math.Ceil(cost))
}

// CalculateAudioCost calculates fixed audio generation cost per request.
func (s *BillingService) CalculateAudioCost(pricing *domain.Pricing) (int64, error) {
	if pricing == nil {
		return 0, ErrNoImagePricing
	}
	if pricing.FixedPriceCents == nil || *pricing.FixedPriceCents == 0 {
		return 0, ErrNoImagePricing
	}
	ratio := pricing.ModelRatio
	if ratio == 0 {
		ratio = 1
	}
	return int64(math.Ceil(float64(*pricing.FixedPriceCents) * ratio)), nil
}

func (s *BillingService) PreConsume(ctx context.Context, userID, tokenID uint64, amount int64) error {
	if amount <= 0 {
		return nil
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		userRepo := repository.NewUserRepository(tx)
		tokenRepo := repository.NewTokenRepository(tx)

		user, err := userRepo.FindByIDForUpdate(ctx, tx, userID)
		if err != nil {
			return err
		}

		// Load token upfront so we can skip user quota check for unlimited tokens
		var token *domain.Token
		if tokenID > 0 {
			token, err = tokenRepo.FindByIDForUpdate(ctx, tx, tokenID)
			if err != nil {
				return err
			}
		}

		// Root users always bypass quota checks, but still track usage.
		// Unlimited tokens also bypass the user-level quota check.
		skipUserCheck := user.Role == domain.RoleRoot || (token != nil && token.UnlimitedQuota)
		if !skipUserCheck {
			if user.Quota < amount {
				return ErrInsufficientQuota
			}
			user.Quota -= amount
		}
		user.UsedQuota += amount
		if err := userRepo.Update(ctx, user); err != nil {
			return err
		}

		if token != nil && !token.UnlimitedQuota {
			if token.RemainQuota < amount {
				return ErrInsufficientQuota
			}
			token.RemainQuota -= amount
			if err := tokenRepo.Update(ctx, token); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	// Check quota low threshold after successful deduction
	s.CheckAndBroadcastQuotaLow(ctx, userID, tokenID)
	return nil
}

const DefaultQuotaLowThreshold = 1000 // 10 RMB in cents

// getQuotaLowThreshold reads the QUOTA_LOW_THRESHOLD setting, returning the default if unset.
func (s *BillingService) getQuotaLowThreshold(ctx context.Context) int64 {
	if s.settingRepo == nil {
		return DefaultQuotaLowThreshold
	}
	setting, err := s.settingRepo.FindByKey(ctx, "QUOTA_LOW_THRESHOLD")
	if err != nil || setting == nil {
		return DefaultQuotaLowThreshold
	}
	val, err := strconv.ParseInt(setting.Value, 10, 64)
	if err != nil || val <= 0 {
		return DefaultQuotaLowThreshold
	}
	return val
}

// CheckAndBroadcastQuotaLow checks if the user's remaining quota is below the threshold and broadcasts a ws event.
func (s *BillingService) CheckAndBroadcastQuotaLow(ctx context.Context, userID, tokenID uint64) {
	if s.broadcaster == nil {
		return
	}

	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return
	}

	threshold := s.getQuotaLowThreshold(ctx)

	if user.Quota >= threshold {
		return
	}

	s.broadcaster.Broadcast(ws.Event{
		Type: ws.EventQuotaLow,
		Data: ws.EventDataQuotaLow{
			UserID:         userID,
			KeyID:          tokenID,
			RemainingQuota: user.Quota,
			Threshold:      threshold,
		},
	})
}

func (s *BillingService) Refund(ctx context.Context, userID, tokenID uint64, amount int64) error {
	if amount <= 0 {
		return nil
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		userRepo := repository.NewUserRepository(tx)
		tokenRepo := repository.NewTokenRepository(tx)

		user, err := userRepo.FindByIDForUpdate(ctx, tx, userID)
		if err != nil {
			return err
		}
		// Root users bypass quota checks but still track UsedQuota for accurate accounting
		if user.Role != domain.RoleRoot {
			user.Quota += amount
			if user.UsedQuota >= amount {
				user.UsedQuota -= amount
			} else {
				user.UsedQuota = 0
			}
			if err := userRepo.Update(ctx, user); err != nil {
				return err
			}
		} else if user.UsedQuota >= amount {
			user.UsedQuota -= amount
			if err := userRepo.Update(ctx, user); err != nil {
				return err
			}
		}

		if tokenID > 0 {
			token, err := tokenRepo.FindByIDForUpdate(ctx, tx, tokenID)
			if err != nil {
				return err
			}
			if !token.UnlimitedQuota {
				token.RemainQuota += amount
				if err := tokenRepo.Update(ctx, token); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func (s *BillingService) Settle(ctx context.Context, userID, tokenID uint64, preConsumed, actual int64) error {
	diff := preConsumed - actual
	if diff > 0 {
		if err := s.Refund(ctx, userID, tokenID, diff); err != nil {
			return fmt.Errorf("settle refund failed: %w", err)
		}
		return nil
	}
	if diff < 0 {
		if err := s.PreConsume(ctx, userID, tokenID, -diff); err != nil {
			return fmt.Errorf("settle underpayment charge failed: %w", err)
		}
	}
	return nil
}

func (s *BillingService) CreateLog(ctx context.Context, log *domain.Log) (uint64, error) {
	if err := s.logRepo.Create(ctx, log); err != nil {
		return 0, err
	}
	return log.ID, nil
}

func (s *BillingService) Recharge(
	ctx context.Context,
	userID, tokenID uint64,
	amount int64,
	relatedType, relatedID, description string,
) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		return s.RechargeTx(ctx, tx, userID, tokenID, amount, relatedType, relatedID, description)
	})
}

func (s *BillingService) RechargeTx(
	ctx context.Context,
	tx *gorm.DB,
	userID, tokenID uint64,
	amount int64,
	relatedType, relatedID, description string,
) error {
	// Negative amounts represent refunds/deductions (valid).
	// Zero amount is a no-op (supports zero-quota subscription plans).
	if amount == 0 {
		return nil
	}
	userRepo := repository.NewUserRepository(tx)
	tokenRepo := repository.NewTokenRepository(tx)
	transactionRepo := repository.NewQuotaTransactionRepository(tx)

	user, err := userRepo.FindByIDForUpdate(ctx, tx, userID)
	if err != nil {
		return err
	}
	if amount < 0 && user.Quota < -amount {
		return ErrInsufficientQuota
	}
	user.Quota += amount
	if err := userRepo.Update(ctx, user); err != nil {
		return err
	}

	if tokenID > 0 {
		token, err := tokenRepo.FindByIDForUpdate(ctx, tx, tokenID)
		if err != nil {
			return err
		}
		if !token.UnlimitedQuota {
			if amount < 0 && token.RemainQuota < -amount {
				return ErrInsufficientQuota
			}
			token.RemainQuota += amount
			if err := tokenRepo.Update(ctx, token); err != nil {
				return err
			}
		}
	}

	trType := domain.QuotaTransactionTypeRecharge
	if amount < 0 {
		trType = domain.QuotaTransactionTypeRefund
	}
	t := &domain.QuotaTransaction{
		UserID:       userID,
		TokenID:      nilIfZero(tokenID),
		Type:         trType,
		Amount:       amount,
		BalanceAfter: user.Quota,
		Description:  strPtr(description),
	}
	if relatedType != "" {
		t.RelatedType = &relatedType
	}
	if relatedID != "" {
		t.RelatedID = &relatedID
	}
	return transactionRepo.Create(ctx, tx, t)
}

func (s *BillingService) RecordConsume(
	ctx context.Context,
	userID, tokenID uint64,
	amount int64,
	logID uint64,
) error {
	if amount <= 0 {
		return nil
	}
	return s.recordTransaction(ctx, userID, tokenID, domain.QuotaTransactionTypeConsume, -amount, "log", logIDToStr(logID), nil)
}

func (s *BillingService) RecordRefund(
	ctx context.Context,
	userID, tokenID uint64,
	amount int64,
	logID uint64,
) error {
	if amount <= 0 {
		return nil
	}
	return s.recordTransaction(ctx, userID, tokenID, domain.QuotaTransactionTypeRefund, amount, "log", logIDToStr(logID), nil)
}

func (s *BillingService) RecordAdjust(
	ctx context.Context,
	userID uint64,
	amount int64,
	description string,
) error {
		if amount == 0 {
			return nil // zero adjustment is a no-op
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		userRepo := repository.NewUserRepository(tx)
		transactionRepo := repository.NewQuotaTransactionRepository(tx)

		user, err := userRepo.FindByIDForUpdate(ctx, tx, userID)
		if err != nil {
			return err
		}
		if amount < 0 && user.Quota < -amount {
			return ErrInsufficientQuota
		}
		user.Quota += amount
		if err := userRepo.Update(ctx, user); err != nil {
			return err
		}

		t := &domain.QuotaTransaction{
			UserID:       userID,
			Type:         domain.QuotaTransactionTypeAdjust,
			Amount:       amount,
			BalanceAfter: user.Quota,
			Description:  strPtr(description),
		}
		return transactionRepo.Create(ctx, tx, t)
	})
}

func (s *BillingService) recordTransaction(
	ctx context.Context,
	userID, tokenID uint64,
	trType domain.QuotaTransactionType,
	amount int64,
	relatedType string,
	relatedID string,
	description *string,
) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		userRepo := repository.NewUserRepository(tx)
		transactionRepo := repository.NewQuotaTransactionRepository(tx)

		user, err := userRepo.FindByIDForUpdate(ctx, tx, userID)
		if err != nil {
			return err
		}

		t := &domain.QuotaTransaction{
			UserID:       userID,
			TokenID:      nilIfZero(tokenID),
			Type:         trType,
			Amount:       amount,
			BalanceAfter: user.Quota,
			RelatedType:  &relatedType,
			RelatedID:    &relatedID,
			Description:  description,
		}
		return transactionRepo.Create(ctx, tx, t)
	})
}

func nilIfZero(v uint64) *uint64 {
	if v == 0 {
		return nil
	}
	return &v
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func logIDToStr(id uint64) string {
	return strconv.FormatUint(id, 10)
}

func (s *BillingService) AggregateDailyBill(ctx context.Context, date time.Time) error {
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)

	return s.db.Transaction(func(tx *gorm.DB) error {
		dailyRepo := repository.NewDailyBillRepository(tx)

		// 1. Delete existing data for the date
		if err := dailyRepo.DeleteByDate(ctx, tx, date); err != nil {
			return err
		}

		// 2. Aggregate consumption from logs
		type consumeRow struct {
			UserID       uint64
			ModelName    string
			RequestCount int64
			TokenCount   int64
			QuotaUsed    int64
		}
		var consumeRows []consumeRow
		if err := tx.WithContext(ctx).Model(&domain.Log{}).
			Select("user_id", "model_name", "COUNT(*) as request_count", "SUM(total_tokens) as token_count", "SUM(quota_used) as quota_used").
			Where("created_at >= ? AND created_at < ?", start, end).
			Group("user_id, model_name").
			Scan(&consumeRows).Error; err != nil {
			return err
		}

		// 3. Aggregate recharge from quota_transactions
		type rechargeRow struct {
			UserID uint64
			Amount int64
		}
		var rechargeRows []rechargeRow
		if err := tx.WithContext(ctx).Model(&domain.QuotaTransaction{}).
			Select("user_id", "SUM(amount) as amount").
			Where("type IN ? AND created_at >= ? AND created_at < ?", []domain.QuotaTransactionType{domain.QuotaTransactionTypeRecharge, domain.QuotaTransactionTypeAdjust}, start, end).
			Group("user_id").
			Scan(&rechargeRows).Error; err != nil {
			return err
		}

		// 4. Build daily bills
		billsByKey := make(map[string]*domain.DailyBill)
		for _, r := range consumeRows {
			key := fmt.Sprintf("%d|%s", r.UserID, r.ModelName)
			billsByKey[key] = &domain.DailyBill{
				BillDate:      start,
				UserID:        r.UserID,
				ModelName:     r.ModelName,
				RequestCount:  int(r.RequestCount),
				TokenCount:    int(r.TokenCount),
				QuotaConsumed: r.QuotaUsed,
			}
		}

		for _, r := range rechargeRows {
			key := fmt.Sprintf("%d|__recharge__", r.UserID)
			if bill, ok := billsByKey[key]; ok {
				bill.QuotaRecharged = r.Amount
			} else {
				billsByKey[key] = &domain.DailyBill{
					BillDate:       start,
					UserID:         r.UserID,
					ModelName:      "",
					QuotaRecharged: r.Amount,
				}
			}
		}

		if len(billsByKey) == 0 {
			return nil
		}

		bills := make([]domain.DailyBill, 0, len(billsByKey))
		for _, bill := range billsByKey {
			bills = append(bills, *bill)
		}

		return dailyRepo.CreateBatch(ctx, tx, bills)
	})
}

func (s *BillingService) ListDailyBills(ctx context.Context, userID uint64, start, end time.Time, page, pageSize int) ([]domain.DailyBill, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.dailyBillRepo.ListByUserAndDateRange(ctx, userID, start, end, page, pageSize)
}

func (s *BillingService) ListMonthlyBills(ctx context.Context, userID uint64, startMonth, endMonth string, page, pageSize int) ([]dto.MonthlyBillInfo, int64, error) {
	start, err := time.Parse("2006-01", startMonth)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid start_month format, expected YYYY-MM: %w", err)
	}
	end, err := time.Parse("2006-01", endMonth)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid end_month format, expected YYYY-MM: %w", err)
	}
	end = time.Date(end.Year(), end.Month()+1, 0, 23, 59, 59, 999999999, time.UTC)

	page, pageSize = normalizePagination(page, pageSize)

	// Use the appropriate date-formatting function for the database dialect
	dateFunc := "DATE_FORMAT(bill_date, '%Y-%m')"
	if s.db.Dialector.Name() == "sqlite" {
		dateFunc = "strftime('%Y-%m', bill_date)"
	}

	// Count distinct months
	countSQL := fmt.Sprintf("SELECT COUNT(DISTINCT %s) FROM daily_bills WHERE user_id = ? AND bill_date >= ? AND bill_date <= ?", dateFunc)
	var total int64
	if err := s.db.WithContext(ctx).Raw(countSQL, userID, start, end).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	// Paginated aggregation query
	offset := (page - 1) * pageSize
	querySQL := fmt.Sprintf(
		"SELECT %s as month, SUM(request_count) as request_count, SUM(token_count) as token_count, SUM(quota_consumed) as quota_consumed, SUM(quota_recharged) as quota_recharged FROM daily_bills WHERE user_id = ? AND bill_date >= ? AND bill_date <= ? GROUP BY month ORDER BY month LIMIT ? OFFSET ?",
		dateFunc,
	)

	var result []dto.MonthlyBillInfo
	if err := s.db.WithContext(ctx).Raw(querySQL, userID, start, end, pageSize, offset).Scan(&result).Error; err != nil {
		return nil, 0, err
	}

	return result, total, nil
}
