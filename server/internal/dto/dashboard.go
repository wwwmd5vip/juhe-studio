package dto

type DashboardStats struct {
	UserCount            int64 `json:"user_count"`
	TokenCount           int64 `json:"token_count"`
	ChannelCount         int64 `json:"channel_count"`
	ActiveChannelCount   int64 `json:"active_channel_count"`
	ModelCount           int64 `json:"model_count"`
	TodayRequestCount    int64 `json:"today_request_count"`
	TodayTokenCount      int64 `json:"today_token_count"`
	TodayQuotaConsumed   int64 `json:"today_quota_consumed"`
	TodayQuotaRecharged  int64 `json:"today_quota_recharged"`
	MonthQuotaConsumed   int64 `json:"month_quota_consumed"`
	ErrorChannelCount    int64 `json:"error_channel_count"`
}

type DashboardTrendItem struct {
	Date     string `json:"date"`
	Requests int64  `json:"requests"`
	Quota    int64  `json:"quota"`
}

// UsageHeatmapItem 模型使用热力图数据点
type UsageHeatmapItem struct {
	Hour      int    `json:"hour"`
	ModelName string `json:"model_name"`
	Count     int64  `json:"count"`
}

// TopUserItem 用户消费排行
type TopUserItem struct {
	UserID        uint64 `json:"user_id"`
	Username      string `json:"username"`
	QuotaConsumed int64  `json:"quota_consumed"`
	RequestCount  int64  `json:"request_count"`
}

// TopTokenItem Token 消费排行
type TopTokenItem struct {
	TokenID       uint64 `json:"token_id"`
	Name          string `json:"name"`
	KeyMask       string `json:"key_mask"`
	QuotaConsumed int64  `json:"quota_consumed"`
	RequestCount  int64  `json:"request_count"`
}

// ErrorRateChannelItem 渠道错误率
type ErrorRateChannelItem struct {
	ChannelID     uint64  `json:"channel_id"`
	ChannelName   string  `json:"channel_name"`
	Type          string  `json:"type"`
	TotalRequests int64   `json:"total_requests"`
	ErrorCount    int64   `json:"error_count"`
	ErrorRate     float64 `json:"error_rate"`
}

// ErrorRateModelItem 模型错误率
type ErrorRateModelItem struct {
	ModelName     string  `json:"model_name"`
	TotalRequests int64   `json:"total_requests"`
	ErrorCount    int64   `json:"error_count"`
	ErrorRate     float64 `json:"error_rate"`
}

// ErrorRateResponse 错误率响应
type ErrorRateResponse struct {
	Channels []ErrorRateChannelItem `json:"channels"`
	Models   []ErrorRateModelItem   `json:"models"`
}

// QuotaForecast 配额预测
type QuotaForecast struct {
	DailyAvgConsumption float64 `json:"daily_avg_consumption"`
	RemainingQuota      float64 `json:"remaining_quota"`
	EstimatedDays       int     `json:"estimated_days"`
	Trend               string  `json:"trend"` // "increasing", "decreasing", "stable"
}

// ChannelLoadItem 渠道负载信息
type ChannelLoadItem struct {
	ID                uint64  `json:"id"`
	Name              string  `json:"name"`
	Type              string  `json:"type"`
	Weight            int     `json:"weight"`
	Priority          int     `json:"priority"`
	Status            int     `json:"status"`
	RecentRequests1h  int64   `json:"recent_requests_1h"`
	WeightPct         float64 `json:"weight_pct"`
}
