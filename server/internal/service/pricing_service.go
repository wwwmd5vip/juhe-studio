package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrPricingNotFound     = errors.New("pricing not found")
	ErrInvalidPricingValue = errors.New("pricing value cannot be negative")
)

// 预设定价来源
type PresetPricingSource struct {
	Name     string `json:"name"`
	BaseURL  string `json:"base_url"`
	Endpoint string `json:"endpoint"` // 空=自动探测
}

var PresetPricingSources = []PresetPricingSource{
	{Name: "models.dev 价格预设", BaseURL: "https://models.dev", Endpoint: "/api.json"},
}

const (
	pricingFetchTimeout = 15
	pricingMaxBytes     = 10 << 20 // 10MB
	floatEpsilon        = 1e-9
	// Price conversion: upstream prices are in USD, our ratio unit = 1 分/1K tokens = ¥0.01/1K
	// Conversion chain: USD → ×usdCnyRate → ¥ → ×100 → 分
	defaultUsdCnyRate = 7.2
)

type PricingService struct {
	pricingRepo *repository.PricingRepository
}

func NewPricingService(pricingRepo *repository.PricingRepository) *PricingService {
	return &PricingService{pricingRepo: pricingRepo}
}

func (s *PricingService) CreatePricing(ctx context.Context, req *dto.CreatePricingRequest) (*domain.Pricing, error) {
	group := req.Group
	if group == "" {
		group = "default"
	}

	if req.ModelRatio < 0 || req.CompletionRatio < 0 || req.CachedTokensRatio < 0 || req.ImageRatio < 0 {
		return nil, ErrInvalidPricingValue
	}
	if req.FixedPriceCents != nil && *req.FixedPriceCents < 0 {
		return nil, ErrInvalidPricingValue
	}

	effectiveFrom := time.Now().UTC()
	if req.EffectiveFrom != nil {
		t, err := time.Parse(time.RFC3339, *req.EffectiveFrom)
		if err == nil {
			effectiveFrom = t.UTC()
		}
	}

	completionRatio := req.CompletionRatio
	if completionRatio == 0 {
		completionRatio = 1
	}
	cachedRatio := req.CachedTokensRatio
	if cachedRatio == 0 {
		cachedRatio = 1
	}
	imageRatio := req.ImageRatio
	if imageRatio == 0 {
		imageRatio = 1
	}

	pricing := &domain.Pricing{
		ModelName:         req.ModelName,
		Group:             group,
		BillingMode:       domain.BillingMode(req.BillingMode),
		ModelRatio:        req.ModelRatio,
		CompletionRatio:   completionRatio,
		CachedTokensRatio: cachedRatio,
		ImageRatio:        imageRatio,
		EffectiveFrom:     effectiveFrom,
	}
	if req.FixedPriceCents != nil {
		pricing.FixedPriceCents = req.FixedPriceCents
	}
	if req.TieredExpr != "" {
		pricing.TieredExpr = &req.TieredExpr
	}

	if err := s.pricingRepo.Create(ctx, pricing); err != nil {
		return nil, err
	}
	return pricing, nil
}

func (s *PricingService) GetPricing(ctx context.Context, id uint64) (*domain.Pricing, error) {
	return s.pricingRepo.FindByID(ctx, id)
}

func (s *PricingService) ListPricing(ctx context.Context, page, pageSize int, modelName, group string) ([]domain.Pricing, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.pricingRepo.List(ctx, page, pageSize, modelName, group)
}

func (s *PricingService) UpdatePricing(ctx context.Context, id uint64, req *dto.UpdatePricingRequest) (*domain.Pricing, error) {
	pricing, err := s.pricingRepo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrPricingNotFound
	}

	if req.BillingMode != nil && *req.BillingMode != "" {
		pricing.BillingMode = domain.BillingMode(*req.BillingMode)
	}
	// Always apply ratio updates — the admin frontend pre-fills all form fields
	// so zero values are explicitly intentional (free/disabled model).
	pricing.ModelRatio = req.ModelRatio
	pricing.CompletionRatio = req.CompletionRatio
	pricing.CachedTokensRatio = req.CachedTokensRatio
	pricing.ImageRatio = req.ImageRatio
	if req.FixedPriceCents != nil {
		pricing.FixedPriceCents = req.FixedPriceCents
	}
	if req.TieredExpr != nil {
		if *req.TieredExpr == "" {
			pricing.TieredExpr = nil
		} else {
			pricing.TieredExpr = req.TieredExpr
		}
	}
	if req.EffectiveFrom != nil {
		t, err := time.Parse(time.RFC3339, *req.EffectiveFrom)
		if err == nil {
			pricing.EffectiveFrom = t.UTC()
		}
	}

	if err := s.pricingRepo.Update(ctx, pricing); err != nil {
		return nil, err
	}
	return pricing, nil
}

func (s *PricingService) DeletePricing(ctx context.Context, id uint64) error {
	return s.pricingRepo.Delete(ctx, id)
}

// BatchUpsertPricing 批量创建或更新定价。若 overwrite=true，覆盖已有定价；否则仅创建不存在的。
func (s *PricingService) BatchUpsertPricing(ctx context.Context, modelName string, items []dto.CreatePricingRequest, overwrite bool) (int64, error) {
	if modelName == "" {
		return 0, errors.New("model_name is required")
	}
	if len(items) == 0 {
		return 0, errors.New("at least one pricing item is required")
	}

	var created int64
	for _, item := range items {
		item.ModelName = modelName
		if item.Group == "" {
			item.Group = "default"
		}
		existing, err := s.pricingRepo.FindByModelAndGroupExact(ctx, modelName, item.Group)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return created, err
		}
		if err == nil {
			if overwrite {
				updateReq := &dto.UpdatePricingRequest{
					BillingMode:       &item.BillingMode,
					ModelRatio:        item.ModelRatio,
					CompletionRatio:   item.CompletionRatio,
					CachedTokensRatio: item.CachedTokensRatio,
					FixedPriceCents:   item.FixedPriceCents,
					ImageRatio:        item.ImageRatio,
					TieredExpr:        &item.TieredExpr,
					EffectiveFrom:     item.EffectiveFrom,
				}
				if _, err := s.UpdatePricing(ctx, existing.ID, updateReq); err != nil {
					return created, err
				}
				created++
			}
			continue
		}
		if _, err := s.CreatePricing(ctx, &item); err != nil {
			return created, err
		}
		created++
	}
	return created, nil
}

// ========== 上游定价同步 ==========

// upstreamPricingItem 上游定价条目（标准数组格式 type2）
type upstreamPricingItem struct {
	ModelName       string  `json:"model_name"`
	ModelRatio      float64 `json:"model_ratio"`
	CompletionRatio float64 `json:"completion_ratio"`
	ImageRatio      float64 `json:"image_ratio"`
	FixedPriceCents int64   `json:"fixed_price_cents"`
	BillingMode     string  `json:"billing_mode"`
}

// SyncUpstreamPricing 从上游渠道同步定价（type2 数组格式）
func (s *PricingService) SyncUpstreamPricing(ctx context.Context, baseURL string, key string, modelNames []string) (int, error) {
	if len(baseURL) == 0 || len(modelNames) == 0 {
		return 0, nil
	}
	baseURL = strings.TrimRight(baseURL, "/")

	body, endpoint := fetchUpstreamPricing(ctx, baseURL, key)
	if body == nil {
		return 0, fmt.Errorf("failed to fetch upstream pricing from %s", baseURL)
	}

	// 根据端点类型选择解析策略
	switch endpoint {
	case "openrouter":
		return s.parseOpenRouterPricing(ctx, body, modelNames)
	case "models_dev":
		return s.parseModelsDevPricing(ctx, body, modelNames)
	case "ratio_config":
		return s.parseRatioConfigPricing(ctx, body, modelNames)
	default:
		return s.parsePricingArray(ctx, body, modelNames)
	}
}

// SyncPresetPricing 从预设来源（models.dev 等）同步定价
func (s *PricingService) SyncPresetPricing(ctx context.Context, preset PresetPricingSource, modelNames []string) (int, error) {
	if len(modelNames) == 0 {
		return 0, nil
	}

	body, _, err := fetchRawURL(ctx, preset.BaseURL, preset.Endpoint)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch %s: %w", preset.Name, err)
	}

	if strings.Contains(preset.BaseURL, "models.dev") {
		return s.parseModelsDevPricing(ctx, body, modelNames)
	}
	// fallback: try array format
	return s.parsePricingArray(ctx, body, modelNames)
}

// ========== 网络获取 ==========

// fetchUpstreamPricing 尝试多个端点获取定价数据，返回 body + 端点类型标识
func fetchUpstreamPricing(ctx context.Context, baseURL, key string) ([]byte, string) {
	// 端点探测列表：{路径, 类型标识}
	type endpointProbe struct {
		path     string
		endpoint string
	}
	probes := []endpointProbe{
		{"/api/ratio_config", "ratio_config"},
		{"/api/pricing", "pricing"},
		{"/pricing", "pricing"},
	}

	for _, probe := range probes {
		body, err := fetchWithAuth(ctx, baseURL+probe.path, key)
		if err == nil && body != nil {
			return body, probe.endpoint
		}
	}
	return nil, ""
}

// fetchWithAuth 带认证的 GET 请求
func fetchWithAuth(ctx context.Context, url, key string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	client := &http.Client{Timeout: time.Duration(pricingFetchTimeout) * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	limited := io.LimitReader(resp.Body, pricingMaxBytes)
	return io.ReadAll(limited)
}

// fetchRawURL 无认证 GET 请求
func fetchRawURL(ctx context.Context, baseURL, path string) ([]byte, string, error) {
	url := strings.TrimRight(baseURL, "/") + path
	body, err := fetchWithAuth(ctx, url, "")
	return body, "", err
}

// ========== 解析策略 ==========

// parsePricingArray 解析 type2 数组格式: [{model_name, model_ratio, ...}]
func (s *PricingService) parsePricingArray(ctx context.Context, body []byte, modelNames []string) (int, error) {
	var items []upstreamPricingItem
	if err := json.Unmarshal(body, &items); err != nil {
		return 0, fmt.Errorf("failed to parse pricing array: %w", err)
	}

	localModels := modelNameSet(modelNames)
	created := 0
	for _, item := range items {
		name := strings.TrimSpace(item.ModelName)
		if name == "" || !localModels[strings.ToLower(name)] {
			continue
		}
		req := dto.CreatePricingRequest{
			ModelName:       name,
			Group:           "default",
			BillingMode:     "token",
			ModelRatio:      item.ModelRatio,
			CompletionRatio: item.CompletionRatio,
			ImageRatio:      item.ImageRatio,
		}
		if item.BillingMode == "fixed" {
			req.BillingMode = "fixed"
			req.FixedPriceCents = &item.FixedPriceCents
		} else if item.BillingMode != "" {
			req.BillingMode = item.BillingMode
		}
		if _, err := s.pricingRepo.UpsertByNameAndGroup(ctx, name, "default", req); err != nil {
			continue
		}
		created++
	}
	return created, nil
}

// parseRatioConfigPricing 解析 type1 map 格式:
//
//	{model_ratio: {model: val, ...}, completion_ratio: {model: val, ...}}
func (s *PricingService) parseRatioConfigPricing(ctx context.Context, body []byte, modelNames []string) (int, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return 0, err
	}

	// 兼容两种外层：{success, data: {...}} 或直接是 ratio map
	dataRaw := body
	if wrapperData, ok := raw["data"]; ok {
		// 带 success wrapper 的情况
		if successRaw, ok := raw["success"]; ok {
			var success bool
			if json.Unmarshal(successRaw, &success) == nil && !success {
				var msg string
				json.Unmarshal(raw["message"], &msg)
				return 0, fmt.Errorf("upstream returned failure: %s", msg)
			}
		}
		dataRaw = wrapperData
	}

	type modelRatioMap map[string]float64

	// 解析 data 中的各倍率字段
	var data struct {
		ModelRatio            modelRatioMap `json:"model_ratio"`
		CompletionRatio       modelRatioMap `json:"completion_ratio"`
		ImageRatio            modelRatioMap `json:"image_ratio"`
		ModelPrice            modelRatioMap `json:"model_price"`
		BillingModeMap        map[string]string `json:"billing_mode"`
	}
	if err := json.Unmarshal(dataRaw, &data); err != nil {
		// Try as direct ratio_config without wrapper
		var direct struct {
			ModelRatio      modelRatioMap `json:"model_ratio"`
			CompletionRatio modelRatioMap `json:"completion_ratio"`
			ImageRatio      modelRatioMap `json:"image_ratio"`
			ModelPrice      modelRatioMap `json:"model_price"`
		}
		if err2 := json.Unmarshal(dataRaw, &direct); err2 != nil {
			return 0, fmt.Errorf("failed to parse ratio config: %w", err)
		}
		data.ModelRatio = direct.ModelRatio
		data.CompletionRatio = direct.CompletionRatio
		data.ImageRatio = direct.ImageRatio
		data.ModelPrice = direct.ModelPrice
	}

	localModels := modelNameSet(modelNames)
	created := 0

	for name := range localModels {
		var hasRatio, hasPrice bool
		req := dto.CreatePricingRequest{
			ModelName:   name,
			Group:       "default",
			BillingMode: "token",
		}

		if ratio, ok := data.ModelRatio[name]; ok {
			req.ModelRatio = ratio
			hasRatio = true
		}
		if ratio, ok := data.CompletionRatio[name]; ok {
			req.CompletionRatio = ratio
		}
		if ratio, ok := data.ImageRatio[name]; ok {
			req.ImageRatio = ratio
		}

		if price, ok := data.ModelPrice[name]; ok && price > 0 {
			req.BillingMode = "fixed"
			cents := int64(math.Round(price * 100))
			req.FixedPriceCents = &cents
			hasPrice = true
		}

		if !hasRatio && !hasPrice {
			continue
		}

		if _, err := s.pricingRepo.UpsertByNameAndGroup(ctx, name, "default", req); err != nil {
			continue
		}
		created++
	}
	return created, nil
}

// parseOpenRouterPricing 解析 OpenRouter /v1/models 响应
//
//	model_ratio = prompt_price_per_token * 1_000 * 500 (USD/CNY ≈ 500)
//	completion_ratio = completion_price / prompt_price
func (s *PricingService) parseOpenRouterPricing(ctx context.Context, body []byte, modelNames []string) (int, error) {
	var orResp struct {
		Data []struct {
			ID      string `json:"id"`
			Pricing struct {
				Prompt         string `json:"prompt"`
				Completion     string `json:"completion"`
				InputCacheRead string `json:"input_cache_read"`
			} `json:"pricing"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &orResp); err != nil {
		return 0, fmt.Errorf("failed to parse OpenRouter response: %w", err)
	}

	localModels := modelNameSet(modelNames)
	created := 0

	for _, m := range orResp.Data {
		name := strings.TrimSpace(m.ID)
		if name == "" || !localModels[strings.ToLower(name)] {
			continue
		}

		promptPrice, err1 := strconv.ParseFloat(m.Pricing.Prompt, 64)
		completionPrice, err2 := strconv.ParseFloat(m.Pricing.Completion, 64)

		if err1 != nil && err2 != nil {
			continue
		}
		if promptPrice < 0 || completionPrice < 0 {
			continue
		}
		if promptPrice == 0 && completionPrice == 0 {
			// Free model
			if _, err := s.pricingRepo.UpsertByNameAndGroup(ctx, name, "default", dto.CreatePricingRequest{
				ModelName: name, Group: "default", BillingMode: "token", ModelRatio: 0, CompletionRatio: 1,
			}); err == nil {
				created++
			}
			continue
		}
		if promptPrice <= 0 {
			continue
		}

		// promptPrice is USD per token → ratio = promptPrice * 1000 * USD/CNY rate
		ratio := roundRatio(promptPrice * 100000 * defaultUsdCnyRate)
		compRatio := roundRatio(completionPrice / promptPrice)

		req := dto.CreatePricingRequest{
			ModelName:       name,
			Group:           "default",
			BillingMode:     "token",
			ModelRatio:      ratio,
			CompletionRatio: compRatio,
		}
		if _, err := s.pricingRepo.UpsertByNameAndGroup(ctx, name, "default", req); err != nil {
			continue
		}
		created++
	}
	return created, nil
}

// parseModelsDevPricing 解析 models.dev /api.json 响应
//
//	Response: {provider: {models: {model_name: {cost: {input, output, cache_read}}}}}
//	costs are USD per 1M tokens
//	model_ratio = input_cost / 1000 * USD_CNY
//	completion_ratio = output_cost / input_cost
//	每个模型跨厂商取最便宜的
func (s *PricingService) parseModelsDevPricing(ctx context.Context, body []byte, modelNames []string) (int, error) {
	type costInfo struct {
		Input     *float64 `json:"input"`
		Output    *float64 `json:"output"`
		CacheRead *float64 `json:"cache_read"`
	}
	type modelInfo struct {
		Cost costInfo `json:"cost"`
	}
	type providerData struct {
		Models map[string]modelInfo `json:"models"`
	}

	var upstream map[string]providerData
	if err := json.Unmarshal(body, &upstream); err != nil {
		return 0, fmt.Errorf("failed to parse models.dev response: %w", err)
	}

	type candidate struct {
		input  float64
		output float64
	}
	selected := make(map[string]candidate)

	providers := make([]string, 0, len(upstream))
	for p := range upstream {
		providers = append(providers, p)
	}
	sort.Strings(providers)


	for _, provider := range providers {
		pd := upstream[provider]
		for modelName, mi := range pd.Models {
			if mi.Cost.Input == nil {
				continue
			}
			input := *mi.Cost.Input
			if math.IsNaN(input) || math.IsInf(input, 0) || input < 0 {
				continue
			}
			var output float64
			if mi.Cost.Output != nil {
				output = *mi.Cost.Output
				if math.IsNaN(output) || math.IsInf(output, 0) || output < 0 {
					continue
				}
			}

			existing, exists := selected[modelName]
			if !exists || (input > 0 && (existing.input == 0 || input < existing.input)) {
				selected[modelName] = candidate{input: input, output: output}
			}
		}
	}

	localModels := modelNameSet(modelNames)
	created := 0

	for name, c := range selected {
		if !localModels[strings.ToLower(name)] {
			continue
		}
		if c.input == 0 {
			// Free model
			if _, err := s.pricingRepo.UpsertByNameAndGroup(ctx, name, "default", dto.CreatePricingRequest{
				ModelName: name, Group: "default", BillingMode: "token", ModelRatio: 0, CompletionRatio: 1,
			}); err == nil {
				created++
			}
			continue
		}

		// input cost is USD per 1M tokens → divide by 1000 then multiply by USD/CNY
		ratio := roundRatio(c.input * defaultUsdCnyRate / 10)
		compRatio := 1.0
		if c.output > 0 {
			compRatio = roundRatio(c.output / c.input)
		}

		req := dto.CreatePricingRequest{
			ModelName:       name,
			Group:           "default",
			BillingMode:     "token",
			ModelRatio:      ratio,
			CompletionRatio: compRatio,
		}
		if _, err := s.pricingRepo.UpsertByNameAndGroup(ctx, name, "default", req); err != nil {
			continue
		}
		created++
	}
	return created, nil
}

// ========== 辅助函数 ==========

// modelNameSet 构建小写模型名集合
func modelNameSet(names []string) map[string]bool {
	set := make(map[string]bool, len(names))
	for _, n := range names {
		set[strings.ToLower(n)] = true
	}
	return set
}

// roundRatio 四舍五入到 6 位小数
func roundRatio(v float64) float64 {
	return math.Round(v*1e6) / 1e6
}
