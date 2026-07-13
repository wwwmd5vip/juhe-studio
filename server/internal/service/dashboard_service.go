package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"gorm.io/gorm"
)

type DashboardService struct {
	db *gorm.DB
}

func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{db: db}
}

func (s *DashboardService) GetStats(ctx context.Context) (*dto.DashboardStats, error) {
	stats := &dto.DashboardStats{}
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error

	// Phase 1: 6 independent count queries in parallel
	wg.Add(6)

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.User{}).Count(&count).Error; err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.UserCount = count
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.Token{}).Count(&count).Error; err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.TokenCount = count
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.Channel{}).Count(&count).Error; err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.ChannelCount = count
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.Model{}).Count(&count).Error; err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.ModelCount = count
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.Channel{}).
			Where("status = ?", domain.ChannelActive).Count(&count).Error; err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.ActiveChannelCount = count
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		var count int64
		if err := s.db.WithContext(ctx).Model(&domain.Channel{}).
			Where("status = ?", domain.ChannelDisabled).Count(&count).Error; err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.ErrorChannelCount = count
		mu.Unlock()
	}()

	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}

	// Phase 2: 2 aggregate queries in parallel
	now := time.Now().UTC()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	wg.Add(2)

	// today_sum: aggregate from daily_bills
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		dayStats, err := s.aggregateDailyBillDay(ctx, todayStart)
		if err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.TodayRequestCount = dayStats.RequestCount
		stats.TodayTokenCount = dayStats.TokenCount
		stats.TodayQuotaConsumed = dayStats.QuotaConsumed
		stats.TodayQuotaRecharged = dayStats.QuotaRecharged
		mu.Unlock()
	}()

	// total_quota_sum: aggregateConsumed for month
	go func() {
		defer wg.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in dashboard stats goroutine: %v", r)
			}
		}()
		monthConsumed, err := s.aggregateConsumed(ctx, monthStart, monthEnd)
		if err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
			return
		}
		mu.Lock()
		stats.MonthQuotaConsumed = monthConsumed
		mu.Unlock()
	}()

	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}

	return stats, nil
}

type dayAggResult struct {
	RequestCount   int64
	TokenCount     int64
	QuotaConsumed  int64
	QuotaRecharged int64
}

func (s *DashboardService) aggregateDailyBillDay(ctx context.Context, date time.Time) (*dayAggResult, error) {
	var res dayAggResult
	err := s.db.WithContext(ctx).
		Model(&domain.DailyBill{}).
		Select("COALESCE(SUM(request_count), 0) AS request_count, COALESCE(SUM(token_count), 0) AS token_count, COALESCE(SUM(quota_consumed), 0) AS quota_consumed, COALESCE(SUM(quota_recharged), 0) AS quota_recharged").
		Where("bill_date = ?", date).
		Scan(&res).Error
	return &res, err
}

func (s *DashboardService) aggregateConsumed(ctx context.Context, start, end time.Time) (int64, error) {
	var total int64
	err := s.db.WithContext(ctx).
		Model(&domain.DailyBill{}).
		Select("COALESCE(SUM(quota_consumed), 0)").
		Where("bill_date >= ? AND bill_date < ?", start, end).
		Scan(&total).Error
	return total, err
}

// GetModelCapabilityStats 统计所有模型的能力分布
func (s *DashboardService) GetModelCapabilityStats(ctx context.Context) (map[string]int, error) {
	var models []domain.Model
	if err := s.db.WithContext(ctx).Where("status = 1").Find(&models).Error; err != nil {
		return nil, err
	}

	stats := make(map[string]int)
	for _, m := range models {
		for _, cap := range m.Capabilities {
			stats[string(cap)]++
		}
	}
	return stats, nil
}

// GetUsageHeatmap 获取模型使用热力图数据
func (s *DashboardService) GetUsageHeatmap(ctx context.Context, days int) ([]dto.UsageHeatmapItem, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	type row struct {
		Hour      int
		ModelName string
		Count     int64
	}
	var rows []row
	err := s.db.WithContext(ctx).Model(&domain.Log{}).
		Select("HOUR(created_at) AS hour, model_name, COUNT(*) AS count").
		Where("created_at >= ?", cutoff).
		Group("HOUR(created_at), model_name").
		Order("hour, model_name").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]dto.UsageHeatmapItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.UsageHeatmapItem{
			Hour:      r.Hour,
			ModelName: r.ModelName,
			Count:     r.Count,
		})
	}
	return result, nil
}

// GetTopUsers 获取用户消费排行
func (s *DashboardService) GetTopUsers(ctx context.Context, days, limit int) ([]dto.TopUserItem, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	type row struct {
		UserID       uint64
		Username     string
		QuotaConsumed int64
		RequestCount int64
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Table("logs l").
		Select("l.user_id, u.username, COALESCE(SUM(l.quota_used), 0) AS quota_consumed, COUNT(*) AS request_count").
		Joins("JOIN users u ON u.id = l.user_id").
		Where("l.created_at >= ?", cutoff).
		Group("l.user_id, u.username").
		Order("quota_consumed DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]dto.TopUserItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.TopUserItem{
			UserID:        r.UserID,
			Username:      r.Username,
			QuotaConsumed: r.QuotaConsumed,
			RequestCount:  r.RequestCount,
		})
	}
	return result, nil
}

// GetTopTokens 获取 Token 消费排行
func (s *DashboardService) GetTopTokens(ctx context.Context, days, limit int) ([]dto.TopTokenItem, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	type row struct {
		TokenID       uint64
		Name          string
		KeyMask       string
		QuotaConsumed int64
		RequestCount  int64
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Table("logs l").
		Select("l.token_id, t.name, t.key_mask, COALESCE(SUM(l.quota_used), 0) AS quota_consumed, COUNT(*) AS request_count").
		Joins("JOIN tokens t ON t.id = l.token_id").
		Where("l.created_at >= ? AND l.token_id IS NOT NULL", cutoff).
		Group("l.token_id, t.name, t.key_mask").
		Order("quota_consumed DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]dto.TopTokenItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.TopTokenItem{
			TokenID:       r.TokenID,
			Name:          r.Name,
			KeyMask:       r.KeyMask,
			QuotaConsumed: r.QuotaConsumed,
			RequestCount:  r.RequestCount,
		})
	}
	return result, nil
}

// GetErrorRate 获取错误率统计
func (s *DashboardService) GetErrorRate(ctx context.Context, days int) (*dto.ErrorRateResponse, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -days)

	// 渠道维度
	type chRow struct {
		ChannelID     uint64
		ChannelName   string
		Type          string
		TotalRequests int64
		ErrorCount    int64
	}
	var chRows []chRow
	if err := s.db.WithContext(ctx).
		Table("logs l").
		Select("l.channel_id, c.name AS channel_name, c.type, COUNT(*) AS total_requests, COALESCE(SUM(CASE WHEN l.status_code >= 400 THEN 1 ELSE 0 END), 0) AS error_count").
		Joins("JOIN channels c ON c.id = l.channel_id").
		Where("l.created_at >= ? AND l.channel_id IS NOT NULL", cutoff).
		Group("l.channel_id, c.name, c.type").
		Order("error_count DESC").
		Scan(&chRows).Error; err != nil {
		return nil, err
	}

	// 模型维度
	type mRow struct {
		ModelName     string
		TotalRequests int64
		ErrorCount    int64
	}
	var mRows []mRow
	if err := s.db.WithContext(ctx).
		Model(&domain.Log{}).
		Select("model_name, COUNT(*) AS total_requests, COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0) AS error_count").
		Where("created_at >= ?", cutoff).
		Group("model_name").
		Order("error_count DESC").
		Scan(&mRows).Error; err != nil {
		return nil, err
	}

	resp := &dto.ErrorRateResponse{
		Channels: make([]dto.ErrorRateChannelItem, 0, len(chRows)),
		Models:   make([]dto.ErrorRateModelItem, 0, len(mRows)),
	}
	for _, r := range chRows {
		var rate float64
		if r.TotalRequests > 0 {
			rate = float64(r.ErrorCount) / float64(r.TotalRequests) * 100
		}
		resp.Channels = append(resp.Channels, dto.ErrorRateChannelItem{
			ChannelID:     r.ChannelID,
			ChannelName:   r.ChannelName,
			Type:          r.Type,
			TotalRequests: r.TotalRequests,
			ErrorCount:    r.ErrorCount,
			ErrorRate:     rate,
		})
	}
	for _, r := range mRows {
		var rate float64
		if r.TotalRequests > 0 {
			rate = float64(r.ErrorCount) / float64(r.TotalRequests) * 100
		}
		resp.Models = append(resp.Models, dto.ErrorRateModelItem{
			ModelName:     r.ModelName,
			TotalRequests: r.TotalRequests,
			ErrorCount:    r.ErrorCount,
			ErrorRate:     rate,
		})
	}
	return resp, nil
}

// GetQuotaForecast 配额使用预测
func (s *DashboardService) GetQuotaForecast(ctx context.Context, userID uint64) (*dto.QuotaForecast, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -30)
	type dailyRow struct {
		Date  string
		Usage int64
	}
	var rows []dailyRow
	if err := s.db.WithContext(ctx).Model(&domain.Log{}).
		Select("DATE(created_at) AS date, COALESCE(SUM(quota_used), 0) AS `usage`").
		Where("user_id = ? AND created_at >= ?", userID, cutoff).
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	var totalUsage int64
	for _, r := range rows {
		totalUsage += r.Usage
	}

	activeDays := len(rows)
	if activeDays == 0 {
		activeDays = 30
	}

	dailyAvg := float64(totalUsage) / float64(activeDays)

	// Get user quota
	var user domain.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, err
	}

	remaining := float64(user.Quota)
	estimatedDays := 0
	if dailyAvg > 0 {
		estimatedDays = int(remaining / dailyAvg)
	} else if remaining > 0 {
		estimatedDays = 9999 // effectively unlimited
	}

	// Determine trend: compare first half vs second half
	trend := "stable"
	mid := len(rows) / 2
	if len(rows) >= 2 && mid > 0 {
		var firstHalf, secondHalf int64
		for i, r := range rows {
			if i < mid {
				firstHalf += r.Usage
			} else {
				secondHalf += r.Usage
			}
		}
		firstAvg := float64(firstHalf) / float64(mid)
		secondAvg := float64(secondHalf) / float64(len(rows)-mid)
		if secondAvg > firstAvg*1.2 {
			trend = "increasing"
		} else if secondAvg < firstAvg*0.8 {
			trend = "decreasing"
		}
	}

	return &dto.QuotaForecast{
		DailyAvgConsumption: dailyAvg,
		RemainingQuota:      remaining,
		EstimatedDays:       estimatedDays,
		Trend:               trend,
	}, nil
}

// GetChannelLoadOverview 获取所有启用渠道的负载概览
func (s *DashboardService) GetChannelLoadOverview(ctx context.Context) ([]dto.ChannelLoadItem, error) {
	type chRow struct {
		ID              uint64
		Name            string
		Type            string
		Weight          int
		Priority        int
		Status          int
		RequestCount    int64
	}
	var rows []chRow
	oneHourAgo := time.Now().UTC().Add(-1 * time.Hour)
	if err := s.db.WithContext(ctx).
		Table("channels c").
		Select("c.id, c.name, c.type, c.weight, c.priority, c.status, COALESCE(COUNT(l.id), 0) AS request_count").
		Joins("LEFT JOIN logs l ON l.channel_id = c.id AND l.created_at >= ?", oneHourAgo).
		Where("c.status = 1").
		Group("c.id, c.name, c.type, c.weight, c.priority, c.status").
		Order("request_count DESC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	// Calculate total weight
	var totalWeight int
	for _, r := range rows {
		totalWeight += r.Weight
	}

	result := make([]dto.ChannelLoadItem, 0, len(rows))
	for _, r := range rows {
		weightPct := float64(0)
		if totalWeight > 0 {
			weightPct = float64(r.Weight) / float64(totalWeight) * 100
		}
		result = append(result, dto.ChannelLoadItem{
			ID:               r.ID,
			Name:             r.Name,
			Type:             r.Type,
			Weight:           r.Weight,
			Priority:         r.Priority,
			Status:           r.Status,
			RecentRequests1h: r.RequestCount,
			WeightPct:        weightPct,
		})
	}
	return result, nil
}

func (s *DashboardService) GetTrends(ctx context.Context, userID uint64, days int) ([]dto.DashboardTrendItem, error) {
	type row struct {
		BillDate time.Time
		Requests int64
		Quota    int64
	}
	var rows []row
	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	query := s.db.WithContext(ctx).Model(&domain.DailyBill{}).
		Select("bill_date, COALESCE(SUM(request_count), 0) AS requests, COALESCE(SUM(quota_consumed), 0) AS quota").
		Where("bill_date >= ?", cutoff)
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.Group("bill_date").Order("bill_date ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]dto.DashboardTrendItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.DashboardTrendItem{
			Date:     r.BillDate.Format("2006-01-02"),
			Requests: r.Requests,
			Quota:    r.Quota,
		})
	}
	return result, nil
}
