package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	adaptor "github.com/juhe-management/server/internal/relay/channel"
	"github.com/juhe-management/server/internal/repository"
	"github.com/juhe-management/server/internal/ws"
	"gorm.io/gorm"
)

var (
	ErrChannelNotFound         = errors.New("channel not found")
	ErrUnsupportedChannelType  = errors.New("unsupported channel type")
	ErrChannelBaseURLEmpty     = errors.New("channel base url is empty")
	ErrChannelKeysEmpty        = errors.New("channel keys is empty")
	ErrUpstreamUnreachable     = errors.New("upstream unreachable")
	ErrUpstreamStatus          = errors.New("upstream returned")
	ErrInvalidUpstreamResponse = errors.New("invalid upstream response")
	ErrEmptyModelName          = errors.New("model_name cannot be empty")
	ErrDuplicateModelName      = errors.New("duplicate model_name")
)

type ChannelService struct {
	channelRepo     *repository.ChannelRepository
	modelRepo       *repository.ModelRepository
	testLogRepo     *repository.ChannelTestLogRepository
	broadcaster     ws.Broadcaster
}

func NewChannelService(channelRepo *repository.ChannelRepository, modelRepo *repository.ModelRepository, testLogRepo *repository.ChannelTestLogRepository, broadcaster ws.Broadcaster) *ChannelService {
	return &ChannelService{channelRepo: channelRepo, modelRepo: modelRepo, testLogRepo: testLogRepo, broadcaster: broadcaster}
}

// GetChannelTypes 返回所有支持的渠道类型信息
func (s *ChannelService) GetChannelTypes() []dto.ChannelTypeInfo {
	types := make([]dto.ChannelTypeInfo, 0, len(domain.ValidChannelTypes))
	for _, ct := range domain.ValidChannelTypes {
		types = append(types, dto.ChannelTypeInfo{
			Type:       string(ct),
			DefaultURL: domain.GetDefaultBaseURL(ct),
		})
	}
	return types
}

// GetDistinctGroups 返回所有不重复的分组名
func (s *ChannelService) GetDistinctGroups(ctx context.Context) ([]string, error) {
	return s.channelRepo.ListDistinctGroups(ctx)
}

func (s *ChannelService) CreateChannel(ctx context.Context, req *dto.CreateChannelRequest) (*domain.Channel, error) {
	channelType := domain.ChannelType(req.Type)
	baseURL := req.BaseURL
	if baseURL == "" {
		baseURL = domain.GetDefaultBaseURL(channelType)
	}

	// SSRF protection: validate base URL
	if baseURL != "" {
		if err := validateBaseURL(baseURL); err != nil {
			return nil, err
		}
	}

	channel := &domain.Channel{
		Type:           channelType,
		Name:           req.Name,
		Keys:           req.Keys,
		Models:         req.Models,
		Weight:         req.Weight,
		Priority:       req.Priority,
		TimeoutSeconds: req.TimeoutSeconds,
		AutoBan:        req.AutoBan,
		Status:         domain.ChannelActive,
		AuthType:       domain.AuthTypeAPIKey,
	}
	if req.AuthType != "" {
		channel.AuthType = domain.AuthType(req.AuthType)
	}
	if baseURL != "" {
		channel.BaseURL = &baseURL
	}
	if req.Groups != "" {
		channel.Groups = req.Groups
	} else {
		channel.Groups = "default"
	}
	channel.ModelMapping = utils.StringifyJSON(req.ModelMapping)
	channel.StatusCodeMapping = utils.StringifyJSON(req.StatusCodeMapping)

	if err := s.channelRepo.Create(ctx, channel); err != nil {
		return nil, err
	}

	if err := s.rebuildAbilities(ctx, channel); err != nil {
		return nil, err
	}

	return channel, nil
}

func (s *ChannelService) GetChannel(ctx context.Context, id uint64) (*domain.Channel, error) {
	return s.channelRepo.FindByID(ctx, id)
}

func (s *ChannelService) ListChannels(ctx context.Context, page, pageSize int, keyword, typeFilter string, statusFilter int) ([]domain.Channel, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.channelRepo.List(ctx, page, pageSize, keyword, typeFilter, statusFilter)
}

// ListAllActive returns all active channels without pagination (for health checks etc.).
func (s *ChannelService) ListAllActive(ctx context.Context) ([]domain.Channel, error) {
	return s.channelRepo.ListAllActive(ctx)
}

func (s *ChannelService) UpdateChannel(ctx context.Context, id uint64, req *dto.UpdateChannelRequest) (*domain.Channel, error) {
	channel, err := s.channelRepo.FindByID(ctx, id)
	if err != nil {
		return nil, ErrChannelNotFound
	}

	if req.Type != "" {
		channel.Type = domain.ChannelType(req.Type)
	}
	if req.Name != "" {
		channel.Name = req.Name
	}
	if req.AuthType != "" {
		channel.AuthType = domain.AuthType(req.AuthType)
	}
	if req.BaseURL != "" {
		if err := validateBaseURL(req.BaseURL); err != nil {
			return nil, err
		}
		channel.BaseURL = &req.BaseURL
	}
	if req.Keys != "" {
		channel.Keys = req.Keys
	}
	if req.Models != "" {
		channel.Models = req.Models
	}
	if req.Groups != "" {
		channel.Groups = req.Groups
	}
	if req.Weight != nil {
		channel.Weight = *req.Weight
	}
	if req.Priority != nil {
		channel.Priority = *req.Priority
	}
	if req.TimeoutSeconds != nil {
		channel.TimeoutSeconds = *req.TimeoutSeconds
	}
	if req.AutoBan != nil {
		channel.AutoBan = *req.AutoBan
	}
	if req.Status != nil {
		channel.Status = domain.ChannelStatus(*req.Status)
	}
	if req.ModelMapping != nil {
		channel.ModelMapping = utils.StringifyJSON(req.ModelMapping)
	}
	if req.StatusCodeMapping != nil {
		channel.StatusCodeMapping = utils.StringifyJSON(req.StatusCodeMapping)
	}

	if err := s.rebuildAbilities(ctx, channel); err != nil {
		return nil, err
	}

	// 自动将渠道模型注册到模型管理
	if req.Models != "" {
		modelIDs := repository.SplitComma(req.Models)
		vendorID := s.inferVendorID(ctx, channel.Type)
		for _, modelID := range modelIDs {
			modelType, caps := inferModelCapabilities(channel.Type, modelID)
			now := time.Now().UTC()
			existingModel, err := s.modelRepo.FindByName(ctx, modelID)
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("find model %s: %w", modelID, err)
			}
			if existingModel != nil {
				existingModel.Type = modelType
				if len(existingModel.Capabilities) == 0 {
					existingModel.Capabilities = domain.ModelCapabilities(caps)
				}
				existingModel.VendorID = vendorID
				existingModel.UpdatedAt = now
				if err := s.modelRepo.Update(ctx, existingModel); err != nil {
					return nil, fmt.Errorf("update model %s: %w", modelID, err)
				}
			} else {
				if err := s.modelRepo.FirstOrCreate(ctx, &domain.Model{
					ModelName:    modelID,
					Type:         modelType,
					Capabilities: domain.ModelCapabilities(caps),
					VendorID:     vendorID,
					Status:       1,
					MatchRule:    domain.ModelMatchExact,
					CreatedAt:    now,
					UpdatedAt:    now,
				}); err != nil {
					return nil, fmt.Errorf("create model %s: %w", modelID, err)
				}
			}
		}
	}

	return channel, nil
}

func (s *ChannelService) DeleteChannel(ctx context.Context, id uint64) error {
	return s.channelRepo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("channel_id = ?", id).Delete(&domain.Ability{}).Error; err != nil {
			return err
		}
		if err := tx.Where("channel_id = ?", id).Delete(&domain.ChannelTestLog{}).Error; err != nil {
			return err
		}
		return tx.Delete(&domain.Channel{}, id).Error
	})
}

func (s *ChannelService) TestChannel(ctx context.Context, id uint64) (responseTimeMs int, err error) {
	channel, err := s.channelRepo.FindByID(ctx, id)
	if err != nil {
		return 0, ErrChannelNotFound
	}

	baseURL := ""
	if channel.BaseURL != nil {
		baseURL = strings.TrimRight(*channel.BaseURL, "/")
	}
	if baseURL == "" {
		return 0, errors.New("channel has no base_url")
	}
	if channel.Type == domain.ChannelTypeVolcEngine {
		baseURL = normalizeVolcEngineBaseURL(baseURL)
	}

	key := ""
	keys := repository.SplitLines(channel.Keys)
	if len(keys) > 0 {
		key = keys[0]
	}

	probeURL := baseURL + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, probeURL, nil)
	if err != nil {
		return 0, err
	}
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	timeout := time.Duration(channel.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	start := time.Now()
	resp, err := client.Do(req)
	elapsed := int(time.Since(start).Milliseconds())

	testLog := &domain.ChannelTestLog{
		ChannelID:      id,
		ResponseTimeMs: elapsed,
		ProbedAt:       time.Now().UTC(),
	}

	if err != nil {
		testLog.Success = false
		testLog.ErrorMessage = fmt.Sprintf("probe failed: %s", err.Error())
		_ = s.testLogRepo.Create(ctx, testLog)
		return elapsed, fmt.Errorf("probe failed: %w", err)
	}
	defer resp.Body.Close()

	// Evaluate /models probe result, but don't treat it as authoritative
	// for LLM channels — the chat probe below is the real test.
	modelsOK := true
	var modelsErrMsg string

	if resp.StatusCode >= http.StatusInternalServerError {
		modelsOK = false
		modelsErrMsg = fmt.Sprintf("models probe returned status %d", resp.StatusCode)
	} else if resp.StatusCode == http.StatusUnauthorized && key == "" {
		// 未授权但可连通，视为可连接
	} else if resp.StatusCode >= http.StatusBadRequest {
		modelsOK = false
		modelsErrMsg = fmt.Sprintf("models probe returned status %d", resp.StatusCode)
	}

	// For LLM-type channels, always probe chat completions as the authoritative check.
	// /models may be unavailable even when the channel is fully functional.
	if s.shouldProbeChat(channel.Type) {
		chatElapsed, chatErr := s.probeChatCompletion(ctx, channel, baseURL, key)
		testLog.ResponseTimeMs += chatElapsed
		if chatErr != nil {
			testLog.Success = false
			testLog.ErrorMessage = fmt.Sprintf("chat probe failed: %s", chatErr.Error())
			if !modelsOK {
				testLog.ErrorMessage = fmt.Sprintf("models probe returned status %d; %s",
					resp.StatusCode, testLog.ErrorMessage)
			}
			_ = s.testLogRepo.Create(ctx, testLog)
			return testLog.ResponseTimeMs, fmt.Errorf("chat probe failed: %w", chatErr)
		}
		// Chat probe succeeded — channel is healthy.
		testLog.Success = true
		if !modelsOK {
			// Log models probe failure for diagnostics, but don't fail the check.
			testLog.ErrorMessage = modelsErrMsg
		}
	} else {
		// Non-LLM channels (Jimeng, Kling): /models probe IS the authoritative check.
		if !modelsOK {
			testLog.Success = false
			testLog.ErrorMessage = modelsErrMsg
			_ = s.testLogRepo.Create(ctx, testLog)
			return testLog.ResponseTimeMs, fmt.Errorf("%s", modelsErrMsg)
		}
		testLog.Success = true
	}

	_ = s.testLogRepo.Create(ctx, testLog)
	return testLog.ResponseTimeMs, nil
}

// shouldProbeChat returns true if the channel type supports chat completions.
func (s *ChannelService) shouldProbeChat(ct domain.ChannelType) bool {
	return ct != domain.ChannelTypeJimeng && ct != domain.ChannelTypeKling
}

// ListTestLogs returns paginated test logs for a channel.
func (s *ChannelService) ListTestLogs(ctx context.Context, channelID uint64, page, pageSize int) ([]domain.ChannelTestLog, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	return s.testLogRepo.ListByChannel(ctx, channelID, page, pageSize)
}

// probeChatCompletion sends a lightweight chat completion request to verify the channel.
func (s *ChannelService) probeChatCompletion(ctx context.Context, channel *domain.Channel, baseURL, key string) (responseTimeMs int, err error) {
	// Determine the chat endpoint
	chatURL := baseURL + "/chat/completions"
	if channel.Type == domain.ChannelTypeOllama {
		chatURL = baseURL + "/api/chat"
	}

	// Pick the first model from the channel's configured models
	models := repository.SplitComma(channel.Models)
	modelName := "gpt-3.5-turbo" // fallback
	if len(models) > 0 && models[0] != "" {
		modelName = models[0]
	}

	reqBody := map[string]interface{}{
		"model":      modelName,
		"messages":   []map[string]string{{"role": "user", "content": "ping"}},
		"max_tokens": 1,
		"stream":     false,
	}
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return 0, fmt.Errorf("marshal probe body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, chatURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	timeout := time.Duration(channel.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	start := time.Now()
	resp, err := client.Do(req)
	elapsed := int(time.Since(start).Milliseconds())
	if err != nil {
		return elapsed, fmt.Errorf("chat probe failed: %w", err)
	}
	defer resp.Body.Close()

	// Drain the response body
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= http.StatusInternalServerError {
		return elapsed, fmt.Errorf("chat probe returned status %d", resp.StatusCode)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return elapsed, fmt.Errorf("chat probe returned status %d", resp.StatusCode)
	}
	return elapsed, nil
}

// TestChannelFromConfig 根据表单配置测试连通性（无需已保存的渠道 ID）
func (s *ChannelService) TestChannelFromConfig(ctx context.Context, req *dto.TestChannelFromConfigRequest) (*dto.TestChannelFromConfigResponse, error) {
	ct := domain.ChannelType(req.Type)
	var validType bool
	for _, vt := range domain.ValidChannelTypes {
		if vt == ct {
			validType = true
			break
		}
	}
	if !validType {
		return nil, ErrUnsupportedChannelType
	}

	// jimeng 不支持 /models 探测
	if ct == domain.ChannelTypeJimeng {
		return nil, ErrUnsupportedChannelType
	}

	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = domain.GetDefaultBaseURL(ct)
	}
	if baseURL == "" {
		return nil, ErrChannelBaseURLEmpty
	}
	baseURL = strings.TrimRight(baseURL, "/")

	if err := validateBaseURL(baseURL); err != nil {
		return nil, fmt.Errorf("invalid base URL: %w", err)
	}

	key := ""
	keysList := repository.SplitLines(req.Keys)
	if len(keysList) > 0 {
		key = keysList[0]
	}

	probeURL := baseURL + "/models"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, probeURL, nil)
	if err != nil {
		return nil, err
	}
	if key != "" {
		httpReq.Header.Set("Authorization", "Bearer "+key)
	}

	timeout := time.Duration(req.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	start := time.Now()
	resp, err := client.Do(httpReq)
	elapsed := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, fmt.Errorf("probe failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusInternalServerError {
		return nil, fmt.Errorf("probe returned status %d", resp.StatusCode)
	}
	if resp.StatusCode == http.StatusUnauthorized && key == "" {
		return &dto.TestChannelFromConfigResponse{ResponseTimeMs: elapsed}, nil
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("probe returned status %d", resp.StatusCode)
	}
	return &dto.TestChannelFromConfigResponse{ResponseTimeMs: elapsed}, nil
}

func (s *ChannelService) RecordFailure(ctx context.Context, id uint64, errMsg string, threshold int) error {
	channel, err := s.channelRepo.FindByID(ctx, id)
	if err != nil {
		return ErrChannelNotFound
	}

	now := time.Now().UTC()
	consecutive, err := s.channelRepo.RecordFailure(ctx, id, errMsg, now)
	if err != nil {
		return err
	}

	if channel.AutoBan && threshold > 0 && consecutive >= int64(threshold) {
		// Re-fetch to get fresh counters — rebuildAbilities does tx.Save which
		// would otherwise overwrite the atomic increment with stale values.
		channel, err = s.channelRepo.FindByID(ctx, id)
		if err != nil {
			return err
		}
		channel.Status = domain.ChannelError

		// Broadcast auto-ban event to WebSocket clients
		if s.broadcaster != nil {
			s.broadcaster.Broadcast(ws.Event{
				Type: ws.EventChannelAutoBanned,
				Data: ws.EventDataAutoBanned{
					ChannelID:           channel.ID,
					ChannelName:         channel.Name,
					ConsecutiveFailures: int(consecutive),
				},
			})
		}
		return s.rebuildAbilities(ctx, channel)
	}

	return nil
}

func (s *ChannelService) RecordSuccess(ctx context.Context, id uint64, responseTimeMs int) error {
	now := time.Now().UTC()
	return s.channelRepo.RecordSuccess(ctx, id, responseTimeMs, now)
}

// ResetAllConsecutiveFailures 重置所有渠道的连续失败计数，并恢复被自动禁用的渠道。
// 应在服务重启时调用，避免重启前累积的失败次数导致渠道在重启后立即被禁用。
func (s *ChannelService) ResetAllConsecutiveFailures(ctx context.Context) (recovered int64, err error) {
	return s.channelRepo.ResetAllConsecutiveFailures(ctx)
}

func (s *ChannelService) rebuildAbilities(ctx context.Context, channel *domain.Channel) error {
	models := repository.SplitComma(channel.Models)

	modelIDs := make([]string, 0, len(models))
	seen := map[string]bool{}
	for _, m := range models {
		if !seen[m] {
			seen[m] = true
			modelIDs = append(modelIDs, m)
		}
	}

	return s.channelRepo.UpdateChannelAndAbilities(ctx, channel, modelIDs)
}

// upstreamModelInfo 上游拉取到的单个模型元数据
type upstreamModelInfo struct {
	ID               string
	Type             domain.ModelType
	Capabilities     []domain.ModelCapability
	InputModalities  []string
	OutputModalities []string
	ContextWindow    int
	MaxOutputTokens  int
}

// normalizeVolcEngineBaseURL 将用户可能误填的方舟控制端/旧路径转换为数据面 Base URL。
func normalizeVolcEngineBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	baseURL = strings.TrimRight(baseURL, "/")
	baseURL = strings.Replace(baseURL, "/api/coding/v3", "/api/v3", 1)
	baseURL = strings.Replace(baseURL, "/api/coding", "/api/v3", 1)
	if !strings.Contains(baseURL, "/api/v3") {
		baseURL += "/api/v3"
	}
	return baseURL
}

// listVolcEngineModels 拉取火山引擎方舟模型列表，解析完整能力数据。
// 火山引擎方舟数据面 API 返回 domain / features / modalities / task_type / token_limits 等富数据。
func (s *ChannelService) listVolcEngineModels(ctx context.Context, channel *domain.Channel) ([]upstreamModelInfo, error) {
	keys := repository.SplitLines(channel.Keys)
	if len(keys) == 0 {
		return nil, ErrChannelKeysEmpty
	}
	if channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
		return nil, ErrChannelBaseURLEmpty
	}

	baseURL := normalizeVolcEngineBaseURL(*channel.BaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/models", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+keys[0])

	timeout := time.Duration(channel.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, ErrUpstreamUnreachable
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w %d: %s", ErrUpstreamStatus, resp.StatusCode, string(bytes.TrimSpace(bodyBytes)))
	}

	var list dto.VolcengineModelList
	if err := json.Unmarshal(bodyBytes, &list); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidUpstreamResponse, err.Error())
	}

	result := make([]upstreamModelInfo, 0, len(list.Data))
	for _, m := range list.Data {
		id := strings.TrimSpace(m.ID)
		if id == "" {
			continue
		}
		// 过滤已下线的模型
		if m.Status == "Shutdown" {
			continue
		}

		info := upstreamModelInfo{ID: id}
		info.Type, info.Capabilities = parseVolcengineModel(m)
		info.InputModalities = m.Modalities.InputModalities
		info.OutputModalities = m.Modalities.OutputModalities
		info.ContextWindow = m.TokenLimits.MaxInputTokens
		info.MaxOutputTokens = m.TokenLimits.MaxOutputTokens
		result = append(result, info)
	}

	result = dedupUpstreamModels(result)
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result, nil
}

// volcengineDomainToModelType 火山引擎 domain 映射到 ModelType
var volcengineDomainToModelType = map[string]domain.ModelType{
	"LLM":             domain.ModelTypeLLM,
	"VLM":             domain.ModelTypeLLM,
	"Embedding":       domain.ModelTypeEmbedding,
	"ImageGeneration": domain.ModelTypeImage,
	"VideoGeneration": domain.ModelTypeVideo,
	"3DGeneration":    domain.ModelTypeImage,
	"Router":          domain.ModelTypeLLM,
}

// parseVolcengineModel 解析火山引擎单个模型的类型和能力
func parseVolcengineModel(m dto.VolcengineModel) (domain.ModelType, []domain.ModelCapability) {
	// 1. domain → ModelType
	mt := domain.ModelTypeLLM
	if t, ok := volcengineDomainToModelType[m.Domain]; ok {
		mt = t
	}

	var caps []domain.ModelCapability

	// 2. features.tools.function_calling → CapFunctionCall
	if m.Features.Tools != nil && m.Features.Tools.FunctionCalling {
		caps = append(caps, domain.CapFunctionCall)
	}

	// 3. features.structured_outputs.json_schema → CapStructuredOutput
	if m.Features.StructuredOutputs != nil && m.Features.StructuredOutputs.JSONSchema {
		caps = append(caps, domain.CapStructuredOutput)
	}

	// 4. modalities → vision/audio-input/video-input/audio-output
	for _, mod := range m.Modalities.InputModalities {
		switch mod {
		case "image":
			caps = append(caps, domain.CapVision)
		case "audio":
			caps = append(caps, domain.CapAudioInput)
		case "video":
			caps = append(caps, domain.CapVideoInput)
		}
	}
	for _, mod := range m.Modalities.OutputModalities {
		switch mod {
		case "audio":
			caps = append(caps, domain.CapAudioOutput)
		case "image":
			caps = append(caps, domain.CapImageGeneration)
		}
	}

	// 5. domain 专属能力
	switch m.Domain {
	case "Embedding":
		caps = append(caps, domain.CapEmbedding)
	case "ImageGeneration":
		caps = append(caps, domain.CapImageGeneration)
	case "VideoGeneration":
		caps = append(caps, domain.CapVideoGeneration)
	}

	// 6. task_type 补充推断
	for _, tt := range m.TaskType {
		switch tt {
		case "TextEmbedding", "ImageEmbedding":
			if !containsCap(caps, domain.CapEmbedding) {
				caps = append(caps, domain.CapEmbedding)
			}
		case "TextToImage", "ImageToImage":
			if !containsCap(caps, domain.CapImageGeneration) {
				caps = append(caps, domain.CapImageGeneration)
			}
		}
	}

	// 7. 模型名补充推理（针对 deepseek/kimi/qwen/glm 等第三方模型）
	if mt == domain.ModelTypeLLM {
		lower := strings.ToLower(m.ID)
		if hasVisionCapability(lower) && !containsCap(caps, domain.CapVision) {
			caps = append(caps, domain.CapVision)
		}
		if hasReasoningCapability(lower) && !containsCap(caps, domain.CapReasoning) {
			caps = append(caps, domain.CapReasoning)
		}
	}

	return mt, dedupCapabilities(caps)
}

func containsCap(caps []domain.ModelCapability, target domain.ModelCapability) bool {
	for _, c := range caps {
		if c == target {
			return true
		}
	}
	return false
}

func dedupCapabilities(caps []domain.ModelCapability) []domain.ModelCapability {
	if len(caps) == 0 {
		return nil
	}
	seen := make(map[domain.ModelCapability]bool, len(caps))
	out := make([]domain.ModelCapability, 0, len(caps))
	for _, c := range caps {
		if !seen[c] {
			seen[c] = true
			out = append(out, c)
		}
	}
	return out
}

// dedupUpstreamModels 按 ID 去重，保留首次出现的条目
func dedupUpstreamModels(models []upstreamModelInfo) []upstreamModelInfo {
	if len(models) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(models))
	out := make([]upstreamModelInfo, 0, len(models))
	for _, m := range models {
		if !seen[m.ID] {
			seen[m.ID] = true
			out = append(out, m)
		}
	}
	return out
}

func (s *ChannelService) listOpenAIModels(ctx context.Context, channel *domain.Channel) ([]upstreamModelInfo, error) {
	keys := repository.SplitLines(channel.Keys)
	if len(keys) == 0 {
		return nil, ErrChannelKeysEmpty
	}
	if channel.BaseURL == nil || *channel.BaseURL == "" {
		return nil, ErrChannelBaseURLEmpty
	}

	baseURL := strings.TrimSpace(*channel.BaseURL)
	baseURL = strings.TrimRight(baseURL, "/")
	baseURL = strings.TrimSuffix(baseURL, "/v1")

	timeout := time.Duration(channel.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	// Try /v1/models first (OpenAI standard), then fall back to /models
	// for APIs like VolcEngine ARK that use /api/v3/models.
	urls := []string{baseURL + "/v1/models", baseURL + "/models"}
	var resp *http.Response
	var lastErr error
	for _, u := range urls {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+keys[0])

		resp, err = client.Do(req)
		if err != nil {
			lastErr = ErrUpstreamUnreachable
			continue
		}
		if resp.StatusCode == http.StatusNotFound {
			resp.Body.Close()
			lastErr = fmt.Errorf("%w %d", ErrUpstreamStatus, resp.StatusCode)
			continue // try next URL
		}
		break // got a non-404 response
	}
	if resp == nil {
		return nil, lastErr
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w %d", ErrUpstreamStatus, resp.StatusCode)
	}

	var list dto.OpenAIModelList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, ErrInvalidUpstreamResponse
	}

	result := make([]upstreamModelInfo, 0, len(list.Data))
	for _, m := range list.Data {
		id := strings.TrimSpace(m.ID)
		if id == "" {
			continue
		}
		// OpenAI 兼容接口无额外能力数据，保留本地推断
		mt, caps := inferModelCapabilities(channel.Type, id)
		result = append(result, upstreamModelInfo{
			ID:           id,
			Type:         mt,
			Capabilities: caps,
		})
	}
	result = dedupUpstreamModels(result)
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result, nil
}

// listOllamaModels 拉取 Ollama 模型列表
func (s *ChannelService) listOllamaModels(ctx context.Context, ch *domain.Channel) ([]upstreamModelInfo, error) {
	keys := repository.SplitLines(ch.Keys)
	key := ""
	if len(keys) > 0 {
		key = keys[0]
	}
	timeout := ch.TimeoutSeconds
	if timeout <= 0 {
		timeout = 30
	}
	ollamaAdaptor := adaptor.NewOllamaAdaptor(timeout)
	tags, err := ollamaAdaptor.FetchModels(ctx, defaultStr2(ch.BaseURL, ""), key)
	if err != nil {
		return nil, fmt.Errorf("ollama fetch models: %w", err)
	}
	result := make([]upstreamModelInfo, 0, len(tags))
	for _, t := range tags {
		mt, caps := inferModelCapabilities(ch.Type, t.Name)
		result = append(result, upstreamModelInfo{
			ID:           t.Name,
			Type:         mt,
			Capabilities: caps,
		})
	}
	result = dedupUpstreamModels(result)
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	return result, nil
}

// listGeminiModels 拉取 Gemini 模型列表，解析 supportedGenerationMethods 和 token limits。
func (s *ChannelService) listGeminiModels(ctx context.Context, channel *domain.Channel) ([]upstreamModelInfo, error) {
	keys := repository.SplitLines(channel.Keys)
	if len(keys) == 0 {
		return nil, ErrChannelKeysEmpty
	}

	baseURL := strings.TrimSpace(*channel.BaseURL)
	baseURL = strings.TrimRight(baseURL, "/")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/v1beta/models", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-goog-api-key", keys[0]) // use header to avoid leaking via proxy/load-balancer access logs

	timeout := time.Duration(channel.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, ErrUpstreamUnreachable
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w %d", ErrUpstreamStatus, resp.StatusCode)
	}

	var result dto.GeminiModelList
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, ErrInvalidUpstreamResponse
	}

	models := make([]upstreamModelInfo, 0, len(result.Models))
	for _, m := range result.Models {
		// 提取模型名（从 "models/gemini-2.0-flash" 格式）
		name := strings.TrimPrefix(m.Name, "models/")
		if name == "" || name == m.Name {
			continue
		}

		caps := parseGeminiGenerationMethods(m.SupportedGenerationMethods)
		// 视觉模型补充 CapVision
		lower := strings.ToLower(name)
		if strings.Contains(lower, "vision") || strings.Contains(lower, "gemini-2") || strings.Contains(lower, "gemini-1.5") {
			if !containsCap(caps, domain.CapVision) {
				caps = append(caps, domain.CapVision)
			}
		}
		// 推理模型
		if strings.Contains(lower, "thinking") || strings.Contains(lower, "flash-thinking") {
			caps = append(caps, domain.CapReasoning)
		}

		models = append(models, upstreamModelInfo{
			ID:              name,
			Type:            domain.ModelTypeLLM,
			Capabilities:    dedupCapabilities(caps),
			ContextWindow:   m.InputTokenLimit,
			MaxOutputTokens: m.OutputTokenLimit,
		})
	}

	models = dedupUpstreamModels(models)
	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	return models, nil
}

// parseGeminiGenerationMethods 将 Gemini 的 supportedGenerationMethods 映射为能力标签
func parseGeminiGenerationMethods(methods []string) []domain.ModelCapability {
	var caps []domain.ModelCapability
	for _, method := range methods {
		switch method {
		case "generateContent":
			// 基本文本生成，不额外打标
		case "embedContent":
			caps = append(caps, domain.CapEmbedding)
		case "countTokens":
			// 内部能力，不对外展示
		}
	}
	// Gemini 所有模型默认支持 function calling（通过 native tool use）
	caps = append(caps, domain.CapFunctionCall)
	return caps
}

// listUpstreamModels 渠道类型感知的模型列表拉取，返回富数据。
func (s *ChannelService) listUpstreamModels(ctx context.Context, channel *domain.Channel) ([]upstreamModelInfo, error) {
	switch channel.Type {
	case domain.ChannelTypeOllama:
		return s.listOllamaModels(ctx, channel)
	case domain.ChannelTypeGemini:
		return s.listGeminiModels(ctx, channel)
	case domain.ChannelTypeAnthropic:
		return s.listOpenAIModels(ctx, channel)
	case domain.ChannelTypeVolcEngine:
		return s.listVolcEngineModels(ctx, channel)
	default:
		return s.listOpenAIModels(ctx, channel)
	}
}

func (s *ChannelService) FetchUpstreamModels(ctx context.Context, channelID uint64) (*dto.FetchUpstreamModelsResponse, error) {
	channel, err := s.channelRepo.FindByID(ctx, channelID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrChannelNotFound
		}
		return nil, err
	}

	// jimeng 当前不支持自动拉取
	if channel.Type == domain.ChannelTypeJimeng {
		return nil, fmt.Errorf("%w: jimeng channel does not support auto-fetch models", ErrUnsupportedChannelType)
	}
	// mxapi 固定模型列表，不从上游拉取
	if channel.Type == domain.ChannelTypeMXAPI {
		modelIDs := []string{"juhe-nano", "juhe-nano-pro", "juhe-nano2", "juhe-gpt-image-2"}
		channel.Models = strings.Join(modelIDs, ",")
		if err := s.channelRepo.UpdateChannelAndAbilities(ctx, channel, modelIDs); err != nil {
			return nil, err
		}

		vendorID := s.inferVendorID(ctx, channel.Type)
		for _, id := range modelIDs {
			modelType, caps := inferModelCapabilities(channel.Type, id)
			now := time.Now().UTC()
			existingModel, _ := s.modelRepo.FindByName(ctx, id)
			if existingModel != nil {
				existingModel.Type = modelType
				existingModel.Capabilities = domain.ModelCapabilities(caps)
				existingModel.VendorID = vendorID
				existingModel.UpdatedAt = now
				_ = s.modelRepo.Update(ctx, existingModel)
			} else {
				s.modelRepo.FirstOrCreate(ctx, &domain.Model{
					ModelName:    id,
					Type:         modelType,
					Capabilities: domain.ModelCapabilities(caps),
					VendorID:     vendorID,
					Status:       1,
					MatchRule:    domain.ModelMatchExact,
					CreatedAt:    now,
					UpdatedAt:    now,
				})
			}
		}

		return &dto.FetchUpstreamModelsResponse{
			Fetched: len(modelIDs),
			Models:  modelIDs,
		}, nil
	}
	if channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
		return nil, ErrChannelBaseURLEmpty
	}

	log.Printf("fetching upstream models for channel %d (%s), current models: %s", channelID, channel.Type, channel.Models)

	upstreamModels, err := s.listUpstreamModels(ctx, channel)
	if err != nil {
		return nil, err
	}

	modelIDs := make([]string, 0, len(upstreamModels))
	details := make([]dto.FetchedModelDetail, 0, len(upstreamModels))
	for _, m := range upstreamModels {
		modelIDs = append(modelIDs, m.ID)
		details = append(details, dto.FetchedModelDetail{
			ModelName:        m.ID,
			Type:             string(m.Type),
			Capabilities:     capabilityStrings(m.Capabilities),
			InputModalities:  m.InputModalities,
			OutputModalities: m.OutputModalities,
			ContextWindow:    m.ContextWindow,
			MaxOutputTokens:  m.MaxOutputTokens,
		})
	}

	channel.Models = strings.Join(modelIDs, ",")
	if err := s.channelRepo.UpdateChannelAndAbilities(ctx, channel, modelIDs); err != nil {
		return nil, err
	}

	log.Printf("fetched %d models for channel %d, new models: %s", len(modelIDs), channel.ID, strings.Join(modelIDs, ","))

	// 自动注册模型实体，使用上游返回的能力数据
	vendorID := s.inferVendorID(ctx, channel.Type)
	for _, m := range upstreamModels {
		now := time.Now().UTC()
		existingModel, err := s.modelRepo.FindByName(ctx, m.ID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("find model %s: %w", m.ID, err)
		}
		if existingModel != nil {
			existingModel.Type = m.Type
			if len(existingModel.Capabilities) == 0 {
				existingModel.Capabilities = domain.ModelCapabilities(m.Capabilities)
			}
			existingModel.VendorID = vendorID
			existingModel.InputModalities = m.InputModalities
			existingModel.OutputModalities = m.OutputModalities
			existingModel.ContextWindow = m.ContextWindow
			existingModel.MaxOutputTokens = m.MaxOutputTokens
			existingModel.UpdatedAt = now
			if err := s.modelRepo.Update(ctx, existingModel); err != nil {
				return nil, fmt.Errorf("update model %s: %w", m.ID, err)
			}
		} else {
			if err := s.modelRepo.FirstOrCreate(ctx, &domain.Model{
				ModelName:       m.ID,
				Type:            m.Type,
				Capabilities:    domain.ModelCapabilities(m.Capabilities),
				InputModalities: domain.StringSlice(m.InputModalities),
				OutputModalities: domain.StringSlice(m.OutputModalities),
				VendorID:        vendorID,
				ContextWindow:   m.ContextWindow,
				MaxOutputTokens: m.MaxOutputTokens,
				Status:          1,
				MatchRule:       domain.ModelMatchExact,
				CreatedAt:       now,
				UpdatedAt:       now,
			}); err != nil {
				return nil, fmt.Errorf("create model %s: %w", m.ID, err)
			}
		}
	}

	return &dto.FetchUpstreamModelsResponse{
		Fetched: len(modelIDs),
		Models:  modelIDs,
		Details: details,
	}, nil
}

// capabilityStrings 将 []ModelCapability 转换为 []string
func capabilityStrings(caps []domain.ModelCapability) []string {
	if len(caps) == 0 {
		return nil
	}
	s := make([]string, len(caps))
	for i, c := range caps {
		s[i] = string(c)
	}
	return s
}

// inferVendorID 根据渠道类型推断厂商
func (s *ChannelService) inferVendorID(ctx context.Context, ct domain.ChannelType) *uint64 {
	// 查找或创建厂商
	vendorName := string(ct)
	vendor, err := s.modelRepo.FindVendorByName(ctx, vendorName)
	if err == nil {
		return &vendor.ID
	}
	// 厂商不存在时返回 nil（后续可手动关联）
	return nil
}

// InferModelCapabilities 根据渠道类型和模型名推断类型和能力
func InferModelCapabilities(ct domain.ChannelType, modelName string) (domain.ModelType, []domain.ModelCapability) {
	return inferModelCapabilities(ct, modelName)
}

// inferModelCapabilities 根据渠道类型和模型名推断类型和能力
// 参考 Cherry Studio 的模型能力推断逻辑 + 本系统渠道特性
func inferModelCapabilities(ct domain.ChannelType, modelName string) (domain.ModelType, []domain.ModelCapability) {
	lower := strings.ToLower(modelName)

	// --- 渠道类型优先判断（覆盖模型名匹配） ---
	switch ct {
	case domain.ChannelTypeJimeng, domain.ChannelTypeMXAPI:
		return domain.ModelTypeImage, []domain.ModelCapability{domain.CapImageGeneration}
	case domain.ChannelTypeKling:
		return domain.ModelTypeVideo, []domain.ModelCapability{domain.CapVideoGeneration}
	case domain.ChannelTypeAnthropic:
		return domain.ModelTypeLLM, []domain.ModelCapability{domain.CapFunctionCall, domain.CapVision, domain.CapReasoning}
	case domain.ChannelTypeGemini:
		caps := []domain.ModelCapability{domain.CapVision, domain.CapReasoning}
		if strings.Contains(lower, "flash") {
			caps = append(caps, domain.CapAudioInput)
		}
		return domain.ModelTypeLLM, caps
	}

	// --- 基于模型名的通用推断（适用于 OpenAI / OpenAI兼容 / DeepSeek / 硅基流动 等） ---
	mt, caps := inferByModelName(lower)
	if mt != "" {
		return mt, caps
	}

	// --- 保底：无法推断则回退到 LLM ---
	return domain.ModelTypeLLM, nil
}

// inferByModelName 纯基于模型名的能力推断（不依赖渠道类型）
func inferByModelName(lower string) (domain.ModelType, []domain.ModelCapability) {
	// 1. 图像生成模型
	if isImageGenerationModel(lower) {
		return domain.ModelTypeImage, []domain.ModelCapability{domain.CapImageGeneration}
	}

	// 2. 视频生成模型
	if isVideoGenerationModel(lower) {
		return domain.ModelTypeVideo, []domain.ModelCapability{domain.CapVideoGeneration}
	}

	// 3. Embedding 模型
	if isEmbeddingModel(lower) {
		return domain.ModelTypeEmbedding, []domain.ModelCapability{domain.CapEmbedding}
	}

	// 4. Rerank 模型
	if isRerankModel(lower) {
		return domain.ModelTypeLLM, []domain.ModelCapability{domain.CapRerank}
	}

	// 5. 音频模型
	if isAudioModel(lower) {
		if strings.Contains(lower, "tts") || strings.Contains(lower, "speech") {
			return domain.ModelTypeAudio, []domain.ModelCapability{domain.CapAudioOutput}
		}
		return domain.ModelTypeAudio, []domain.ModelCapability{domain.CapAudioInput}
	}

	// 6. LLM 模型 → 推断细粒度能力
	caps := inferLLMCapabilities(lower)
	return domain.ModelTypeLLM, caps
}

// --- 模型名正则匹配函数 ---

// imageGenerationPatterns 图像生成模型名模式
var imageGenerationPatterns = []string{
	"dall-e", "dalle",
	"flux", "sdxl", "stable-diffusion", "stable-diffusion-xl",
	"midjourney", "playground",
	"juhe-gpt-image", "juhe-nano", "juhe-nano2", "juhe-nano-pro",
	"gpt-image", "imagen",
	"seedream", "cogview", "hunyuan-image",
	"kolors", "qwen-image",
	"janus", "omnigen",
}

func isImageGenerationModel(lower string) bool {
	for _, p := range imageGenerationPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// videoGenerationPatterns 视频生成模型名模式
var videoGenerationPatterns = []string{
	"sora", "kling", "cogvideo", "videocrafter",
	"runway", "pika", "hailuo", "stable-video",
	"mochi", "ltx-video", "hunyuan-video",
	"wanx", "veo", "seedance",
}

func isVideoGenerationModel(lower string) bool {
	for _, p := range videoGenerationPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// embeddingPatterns Embedding 模型名模式
var embeddingPatterns = []string{
	"text-embedding", "text-embed",
	"bge-", "bge-m3", "bge-large",
	"e5-", "gte-", "stella-",
	"jina-embeddings", "jina-clip",
	"voyage-", "embed-",
	"LLM2Vec", "retrieval",
	"mxbai-embed", "nomic-embed",
	"gte-qwen", "sfr-embedding",
}

func isEmbeddingModel(lower string) bool {
	for _, p := range embeddingPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// rerankPatterns Rerank 模型名模式
var rerankPatterns = []string{
	"rerank", "re-rank", "re-ranker", "re-ranking",
	"bge-reranker", "jina-reranker",
	"cohere-rerank", "cross-encoder",
}

func isRerankModel(lower string) bool {
	for _, p := range rerankPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// audioPatterns 音频模型名模式
var audioPatterns = []string{
	"whisper", "tts-", "tts1", "-tts",
	"speech-", "parler-tts", "bark",
	"cosyvoice", "speecht5",
	"sensevoice", "funasr",
}

func isAudioModel(lower string) bool {
	for _, p := range audioPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// inferLLMCapabilities 推断 LLM 模型的细粒度能力标签
func inferLLMCapabilities(lower string) []domain.ModelCapability {
	var caps []domain.ModelCapability

	// 函数调用：大多数 LLM 都支持，排除部分已知不支持的
	if !isNoFunctionCallModel(lower) {
		caps = append(caps, domain.CapFunctionCall)
	}

	// 视觉能力
	if hasVisionCapability(lower) {
		caps = append(caps, domain.CapVision)
	}

	// 推理能力
	if hasReasoningCapability(lower) {
		caps = append(caps, domain.CapReasoning)
	}

	// 结构化输出
	if hasStructuredOutputCapability(lower) {
		caps = append(caps, domain.CapStructuredOutput)
	}

	return caps
}

func isNoFunctionCallModel(lower string) bool {
	noFC := []string{
		"o1-mini", "o1-preview",
		"embedding", "embed", "bge-", "e5-",
		"rerank", "re-rank",
		"dall-e", "flux", "stable-diffusion",
		"whisper", "tts-",
	}
	for _, p := range noFC {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// visionPatterns 视觉模型名模式
var visionPatterns = []string{
	"vision", "vl-", "-vl", "vl-pro",
	"gpt-4o", "gpt-4-turbo", "gpt-4-vision",
	"claude-3", "claude-4",
	"gemini", "pixtral", "llava",
	"qwen-vl", "qwen2-vl", "qwen2.5-vl",
	"glm-4v", "cogvlm", "cogagent",
	"yi-vision", "yi-vl",
	"minicpm-v", "minicpm-o",
	"internvl", "internlm-xcomposer",
	"deepseek-vl", "deepseek-janus",
	"phi-3-vision", "phi-3.5-vision",
	"phi-4-vision", "phi-4-multimodal",
	"paligemma", "fuyu", "molmo",
	"llama-3.2-90b-vision", "llama-3.2-11b-vision",
	"ovis", "mantis", "aria",
	"hunyuan-vision", "hunyuan-turbos-vision",
	"step-1v", "step-1o-vision",
}

func hasVisionCapability(lower string) bool {
	for _, p := range visionPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

// reasoningPatterns 推理模型名模式
var reasoningPatterns = []string{
	"reasoning", "reasoner",
	"thinking", "think",
	"o1-", "o3-", "o4-",
	"qwq", "deepseek-r1", "deepseek-r2",
	"hunyuan-t1", "glm-zero",
	"grok-3-mini", "grok-4",
	"kimi-k2", "kimi-thinking",
	"qwen3-235b", "qwen3-max",
	"gemini-2.5-pro", "gemini-2.5-flash-thinking",
	"sonnet-reasoning", "opus-reasoning",
}

func hasReasoningCapability(lower string) bool {
	for _, p := range reasoningPatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

func hasStructuredOutputCapability(lower string) bool {
	// 大多数现代 LLM 支持结构化输出，排除嵌入/重排/图像/音频模型
	if isEmbeddingModel(lower) || isRerankModel(lower) ||
		isImageGenerationModel(lower) || isAudioModel(lower) {
		return false
	}
	return strings.Contains(lower, "gpt-") ||
		strings.Contains(lower, "claude-") ||
		strings.Contains(lower, "gemini-") ||
		strings.Contains(lower, "deepseek") ||
		strings.Contains(lower, "qwen") ||
		strings.Contains(lower, "glm-") ||
		strings.Contains(lower, "grok-") ||
		strings.Contains(lower, "llama-") ||
		strings.Contains(lower, "mistral")
}

func (s *ChannelService) PreviewUpstreamModels(ctx context.Context, channelID uint64) (*dto.PreviewUpstreamModelsResponse, error) {
	channel, err := s.channelRepo.FindByID(ctx, channelID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrChannelNotFound
		}
		return nil, err
	}

	// jimeng 当前不支持自动拉取
	if channel.Type == domain.ChannelTypeJimeng {
		return nil, ErrUnsupportedChannelType
	}
	// mxapi 固定模型列表
	if channel.Type == domain.ChannelTypeMXAPI {
		return &dto.PreviewUpstreamModelsResponse{
			Models:        []string{"juhe-nano", "juhe-nano-pro", "juhe-nano2", "juhe-gpt-image-2"},
			ExistingTypes: map[string]string{"juhe-nano": "image", "juhe-nano-pro": "image", "juhe-nano2": "image", "juhe-gpt-image-2": "image"},
		}, nil
	}

	if channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
		return nil, ErrChannelBaseURLEmpty
	}

	upstreamModels, err := s.listUpstreamModels(ctx, channel)
	if err != nil {
		return nil, err
	}

	modelIDs := make([]string, 0, len(upstreamModels))
	existingTypes := make(map[string]string, len(upstreamModels))
	existingCaps := make(map[string][]string, len(upstreamModels))
	inputMods := make(map[string][]string, len(upstreamModels))
	outputMods := make(map[string][]string, len(upstreamModels))

	for _, m := range upstreamModels {
		modelIDs = append(modelIDs, m.ID)
		existing, err := s.modelRepo.FindByName(ctx, m.ID)
		if err == nil && existing != nil {
			existingTypes[m.ID] = string(existing.Type)
			existingCaps[m.ID] = capabilityStrings(existing.Capabilities)
		} else {
			existingTypes[m.ID] = string(m.Type)
			existingCaps[m.ID] = capabilityStrings(m.Capabilities)
		}
		if len(m.InputModalities) > 0 {
			inputMods[m.ID] = m.InputModalities
		}
		if len(m.OutputModalities) > 0 {
			outputMods[m.ID] = m.OutputModalities
		}
	}

	return &dto.PreviewUpstreamModelsResponse{
		Models:               modelIDs,
		ExistingTypes:        existingTypes,
		ExistingCapabilities: existingCaps,
		InputModalities:      inputMods,
		OutputModalities:     outputMods,
	}, nil
}

func (s *ChannelService) SyncUpstreamModels(ctx context.Context, channelID uint64, req *dto.SyncUpstreamModelsRequest) (*dto.SyncUpstreamModelsResponse, error) {
	channel, err := s.channelRepo.FindByID(ctx, channelID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, ErrChannelNotFound
		}
		return nil, err
	}

	seen := make(map[string]struct{}, len(req.Models))
	modelItems := make([]repository.ModelSyncItem, 0, len(req.Models))
	modelNames := make([]string, 0, len(req.Models))

	vendorID := s.inferVendorID(ctx, channel.Type)

	for _, item := range req.Models {
		name := strings.TrimSpace(item.ModelName)
		if name == "" {
			return nil, ErrEmptyModelName
		}
		if _, ok := seen[name]; ok {
			return nil, fmt.Errorf("%w: %s", ErrDuplicateModelName, name)
		}
		seen[name] = struct{}{}

		modelType := domain.ModelType(item.Type)
		modelItems = append(modelItems, repository.ModelSyncItem{
			ModelName: name,
			Type:      modelType,
		})
		modelNames = append(modelNames, name)

		// 更新或创建 Model 实体（含能力推断）
		now := time.Now().UTC()
		var caps []domain.ModelCapability
		if len(item.Capabilities) > 0 {
			for _, c := range item.Capabilities {
				caps = append(caps, domain.ModelCapability(c))
			}
		} else {
			_, caps = inferModelCapabilities(channel.Type, name)
		}

		existingModel, _ := s.modelRepo.FindByName(ctx, name)
		if existingModel != nil {
			existingModel.Type = modelType
			existingModel.Capabilities = caps
			existingModel.VendorID = vendorID
			existingModel.UpdatedAt = now
			_ = s.modelRepo.Update(ctx, existingModel)
		} else {
			_ = s.modelRepo.FirstOrCreate(ctx, &domain.Model{
				ModelName:    name,
				Type:         modelType,
				Capabilities: caps,
				VendorID:     vendorID,
				Status:       1,
				MatchRule:    domain.ModelMatchExact,
				CreatedAt:    now,
				UpdatedAt:    now,
			})
		}
	}

	sort.Strings(modelNames)
	channel.Models = strings.Join(modelNames, ",")

	if err := s.channelRepo.UpdateChannelAndSyncModels(ctx, channel, modelItems); err != nil {
		return nil, err
	}

	return &dto.SyncUpstreamModelsResponse{
		Synced: len(modelNames),
		Models: modelNames,
	}, nil
}

// PreviewUpstreamModelsFromConfig 根据表单配置预览上游模型（无需已保存的渠道 ID）
func (s *ChannelService) PreviewUpstreamModelsFromConfig(ctx context.Context, req *dto.PreviewModelsFromConfigRequest) (*dto.PreviewUpstreamModelsResponse, error) {
	ct := domain.ChannelType(req.Type)
	// 基本类型校验
	var validType bool
	for _, vt := range domain.ValidChannelTypes {
		if vt == ct {
			validType = true
			break
		}
	}
	if !validType {
		return nil, ErrUnsupportedChannelType
	}

	// jimeng 当前不支持自动拉取
	if ct == domain.ChannelTypeJimeng {
		return nil, ErrUnsupportedChannelType
	}
	// mxapi 固定模型列表
	if ct == domain.ChannelTypeMXAPI {
		return &dto.PreviewUpstreamModelsResponse{
			Models:        []string{"juhe-nano", "juhe-nano-pro", "juhe-nano2", "juhe-gpt-image-2"},
			ExistingTypes: map[string]string{"juhe-nano": "image", "juhe-nano-pro": "image", "juhe-nano2": "image", "juhe-gpt-image-2": "image"},
		}, nil
	}

	baseURL := strings.TrimSpace(req.BaseURL)
	if baseURL == "" {
		baseURL = domain.GetDefaultBaseURL(ct)
	}
	if baseURL == "" {
		return nil, ErrChannelBaseURLEmpty
	}

	keysStr := req.Keys
	if keysStr == "" {
		keysStr = "dummy-key"
	}

	// 构建临时渠道对象用于拉取
	channel := &domain.Channel{
		Type:           ct,
		Keys:           keysStr,
		TimeoutSeconds: 30,
	}
	channel.BaseURL = &baseURL

	upstreamModels, err := s.listUpstreamModels(ctx, channel)
	if err != nil {
		return nil, err
	}

	modelIDs := make([]string, 0, len(upstreamModels))
	existingTypes := make(map[string]string, len(upstreamModels))
	for _, m := range upstreamModels {
		modelIDs = append(modelIDs, m.ID)
		existing, err := s.modelRepo.FindByName(ctx, m.ID)
		if err == nil && existing != nil {
			existingTypes[m.ID] = string(existing.Type)
		} else {
			existingTypes[m.ID] = string(m.Type)
		}
	}

	return &dto.PreviewUpstreamModelsResponse{
		Models:        modelIDs,
		ExistingTypes: existingTypes,
	}, nil
}

func defaultStr2(s *string, fallback string) string {
	if s == nil {
		return fallback
	}
	return *s
}

// validateBaseURL rejects URLs that target internal/private networks (SSRF protection).
// Only http/https schemes are allowed. Localhost, private IPs, link-local, and
// cloud metadata endpoints are blocked.
func validateBaseURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid base URL: %w", err)
	}

	// Block non-http schemes
	switch u.Scheme {
	case "http", "https":
		// allowed
	default:
		return fmt.Errorf("base URL scheme not allowed: %s", u.Scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("base URL has no hostname")
	}

	// Block raw IPs that are private/loopback/link-local
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return fmt.Errorf("base URL targets private/internal IP: %s", host)
		}
		return nil
	}

	// Block well-known internal hostnames
	hostLower := strings.ToLower(host)
	blockedHosts := []string{
		"metadata.google.internal",     // GCP
		"169.254.169.254",              // AWS / cloud metadata
		"metadata.tencentyun.com",      // Tencent Cloud
		"100.100.100.200",              // Alibaba Cloud metadata
	}
	for _, blocked := range blockedHosts {
		if hostLower == blocked || strings.HasSuffix(hostLower, "."+blocked) {
			return fmt.Errorf("base URL targets internal host: %s", host)
		}
	}

	// Resolve hostname and check for private IPs
	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("cannot resolve base URL host: %s", host)
	}
	for _, ip := range ips {
		if isPrivateIP(ip) {
			return fmt.Errorf("base URL resolves to private IP %s: %s", ip, host)
		}
	}

	return nil
}

// AllowLoopbackForTesting, when true, disables the loopback IP check in
// validateBaseURL. This is ONLY intended for tests that use httptest.NewServer
// (which binds to 127.0.0.1). Never set this in production code paths.
var AllowLoopbackForTesting bool

func isPrivateIP(ip net.IP) bool {
	// Loopback is treated as private to prevent SSRF to internal services.
	if ip.IsLoopback() && !AllowLoopbackForTesting {
		return true
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	if ip.IsPrivate() {
		return true
	}
	if ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	return false
}
