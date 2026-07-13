package service

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/common/utils"
	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
	"github.com/juhe-management/server/internal/relay/channel"
	"github.com/juhe-management/server/internal/repository"
)

var (
	ErrModelNotSupported = errors.New("model not supported")
	ErrStreamNotSupport  = errors.New("stream mode not supported in MVP")
	ErrModelNotAllowed   = errors.New("model not allowed for this token")
)

// CtxKeyFreeTrial is the context key for playground free trial mode
type ctxKey string

const CtxKeyFreeTrial ctxKey = "free_trial"

const requestIDKey ctxKey = "request_id"

// reqID extracts the request_id from context, falling back to "unknown".
func reqID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return "unknown"
}

type RelayService struct {
	dispatcher       *relay.Dispatcher
	billing          *BillingService
	channelRepo      *repository.ChannelRepository
	pricingRepo      *repository.PricingRepository
	modelRepo        *repository.ModelRepository
	channelService   *ChannelService
	maxRetries       int
	autoBanThreshold int
}

func NewRelayService(dispatcher *relay.Dispatcher, billing *BillingService, channelRepo *repository.ChannelRepository, pricingRepo *repository.PricingRepository, modelRepo *repository.ModelRepository, channelService *ChannelService, maxRetries int, autoBanThreshold int) *RelayService {
	if autoBanThreshold <= 0 {
		autoBanThreshold = 5
	}
	return &RelayService{
		dispatcher:       dispatcher,
		billing:          billing,
		channelRepo:      channelRepo,
		pricingRepo:      pricingRepo,
		modelRepo:        modelRepo,
		channelService:   channelService,
		maxRetries:       maxRetries,
		autoBanThreshold: autoBanThreshold,
	}
}

func (s *RelayService) ListModels(ctx context.Context, group string) ([]dto.OpenAIModel, error) {
	var models []dto.OpenAIModel

	modelNames, err := s.channelRepo.ListDistinctModelsByGroup(ctx, group)
	if err != nil {
		return nil, err
	}

	// 过滤掉未定价的模型
	pricedSet, err := s.pricingRepo.GetPricedModelNames(ctx)
	if err != nil {
		return nil, err
	}

	// 批量查询模型能力，过滤掉视频生成模型
	modelTypeMap, err := s.modelRepo.FindTypeAndCapabilitiesByNames(ctx, modelNames)
	if err != nil {
		return nil, err
	}

	now := time.Now().Unix()
	for _, name := range modelNames {
		if pricedSet != nil && !pricedSet[name] {
			continue
		}
		info, ok := modelTypeMap[name]
		if !ok {
			continue
		}
		// 视频生成模型不显示在通用模型列表
		if info.ModelType == "video" || hasCapability(info.Capabilities, "video-generation") {
			continue
		}
		models = append(models, dto.OpenAIModel{
			ID:           name,
			Object:       "model",
			Created:      now,
			OwnedBy:      "juhe",
			Capabilities: info.Capabilities,
		})
	}
	return models, nil
}

type modelInfo struct {
	ModelType    string
	Capabilities []string
}

func hasCapability(caps []string, target string) bool {
	for _, c := range caps {
		if c == target {
			return true
		}
	}
	return false
}

// nonStreamRelayParams holds the parameters for the shared non-stream relay flow.
type nonStreamRelayParams struct {
	body             []byte
	upstreamPath     string
	logType          domain.LogType
	preConsumed      int64
	actualCostFn     func(resp *relay.RelayResponse) int64
	extraLogFields   func(lr *domain.Log)
}

// doNonStreamRelay encapsulates the common relay → settle → log flow for non-stream endpoints.
func (s *RelayService) doNonStreamRelay(ctx context.Context, user *domain.User, token *domain.Token, info *relay.RelayInfo, p nonStreamRelayParams) (*relay.RelayResponse, *domain.Log, error) {
	ctx = context.WithValue(ctx, requestIDKey, info.RequestID)
	start := time.Now()
	resp, _, err := s.doRelayWithRetry(ctx, info, p.body, p.upstreamPath)
	useTime := int(time.Since(start).Milliseconds())

	var actualCost int64; if resp != nil { actualCost = p.actualCostFn(resp) }

	if err != nil {
		if refundErr := s.billing.Refund(ctx, user.ID, token.ID, p.preConsumed); refundErr != nil {
			slog.Error("refund failed", "error", refundErr, "request_id", reqID(ctx))
		}
	} else {
		if settleErr := s.billing.Settle(ctx, user.ID, token.ID, p.preConsumed, actualCost); settleErr != nil {
			slog.Error("settle failed", "error", settleErr, "request_id", reqID(ctx))
		}
	}

	logRecord := &domain.Log{
		UserID:           user.ID,
		TokenID:          &token.ID,
		ModelName:        info.ModelName,
		RequestID:        info.RequestID,
		Type:             p.logType,
		Mode:             domain.LogModeNonStream,
		QuotaUsed:        actualCost,
		QuotaPreConsumed: p.preConsumed,
		StatusCode:       http.StatusOK,
		IPAddress:        info.IPAddress,
		UserAgent:        info.UserAgent,
		RequestContent:   sanitizeRequestForLogging(p.body),
		ResponseContent:  "",
		UseTimeMs:        useTime,
	}
	if p.extraLogFields != nil {
		p.extraLogFields(logRecord)
	}
	if info.Channel != nil {
		logRecord.ChannelID = &info.Channel.ID
	}
	if err != nil {
		logRecord.StatusCode = http.StatusBadGateway
		logRecord.ErrorMessage = err.Error()
	}
	if resp != nil {
		logRecord.StatusCode = resp.StatusCode
		if resp.StatusCode != http.StatusOK {
			logRecord.ErrorMessage = preserveErrorBody(resp)
		} else {
			// 成功时也保留响应内容用于调试（截断）
			logRecord.ResponseContent = preserveErrorBody(resp)
		}
	}

	logID, logErr := s.billing.CreateLog(ctx, logRecord)
	if logErr != nil {
		slog.Error("create log failed", "error", logErr, "request_id", reqID(ctx))
	}
	if err == nil && actualCost > 0 && logID > 0 {
		if recordErr := s.billing.RecordConsume(ctx, user.ID, token.ID, actualCost, logID); recordErr != nil {
			slog.Error("record consume failed", "error", recordErr, "request_id", reqID(ctx))
		}
	}
	if err != nil && p.preConsumed > 0 && logID > 0 {
		if recordErr := s.billing.RecordRefund(ctx, user.ID, token.ID, p.preConsumed, logID); recordErr != nil {
			slog.Error("record refund failed", "error", recordErr, "request_id", reqID(ctx))
		}
	}

	return resp, logRecord, err
}

func (s *RelayService) ImageGenerations(ctx context.Context, token *domain.Token, user *domain.User, body []byte, ipAddress, userAgent string) (*relay.RelayResponse, *domain.Log, error) {
	var req dto.ImageGenerationRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, nil, err
	}

	group := resolveGroup(token, user)

	if err := checkModelLimits(token, req.Model); err != nil {
		return nil, nil, err
	}

	pricing, err := s.billing.GetPricing(ctx, req.Model, group)
	if err != nil {
		return nil, nil, err
	}

	n := req.N
	if n <= 0 {
		n = 1
	}
	if n > 10 {
		n = 10 // cap to prevent excessive pre-consumption
	}
	preConsumed, costErr := s.billing.CalculateImageCost(pricing, n)
	if costErr != nil {
		return nil, nil, costErr
	}

	if err := s.billing.PreConsume(ctx, user.ID, token.ID, preConsumed); err != nil {
		return nil, nil, err
	}

	info := s.buildRelayInfo(ctx, user, token, req.Model, group, ipAddress, userAgent)

	return s.doNonStreamRelay(ctx, user, token, info, nonStreamRelayParams{
		body:         body,
		upstreamPath: "/images/generations",
		logType:      domain.LogTypeImage,
		preConsumed:  preConsumed,
		actualCostFn: func(resp *relay.RelayResponse) int64 {
			if resp == nil || resp.StatusCode != http.StatusOK {
				return 0
			}
			bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, channel.MaxUpstreamResponseSize))
			if err != nil {
				slog.Error("image cost: failed to read response body, using pre-consumed estimate", "error", err, "request_id", "unknown")
				return preConsumed
			}
			resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			actualN := n
			var imgResp dto.ImageGenerationResponse
			if json.Unmarshal(bodyBytes, &imgResp) == nil && len(imgResp.Data) > 0 {
				actualN = len(imgResp.Data)
			}
			cost, costErr := s.billing.CalculateImageCost(pricing, actualN)
			if costErr != nil {
				slog.Error("image cost: CalculateImageCost failed, using pre-consumed estimate", "error", costErr, "actualN", actualN, "request_id", "unknown")
				return preConsumed
			}
			return cost
		},
		extraLogFields: func(lr *domain.Log) {
			lr.ImageN = n
		},
	})
}

func (s *RelayService) Embeddings(ctx context.Context, token *domain.Token, user *domain.User, body []byte, ipAddress, userAgent string) (*relay.RelayResponse, *domain.Log, error) {
	var req dto.EmbeddingRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, nil, err
	}

	group := resolveGroup(token, user)

	if err := checkModelLimits(token, req.Model); err != nil {
		return nil, nil, err
	}

	pricing, err := s.billing.GetPricing(ctx, req.Model, group)
	if err != nil {
		return nil, nil, err
	}

	estTokens := estimateEmbeddingTokens(req.Input)
	estimatedCost := s.billing.CalculateEmbeddingCost(pricing, estTokens)

	if err := s.billing.PreConsume(ctx, user.ID, token.ID, estimatedCost); err != nil {
		return nil, nil, err
	}

	info := s.buildRelayInfo(ctx, user, token, req.Model, group, ipAddress, userAgent)

	return s.doNonStreamRelay(ctx, user, token, info, nonStreamRelayParams{
		body:         body,
		upstreamPath: "/embeddings",
		logType:      domain.LogTypeEmbedding,
		preConsumed:  estimatedCost,
		actualCostFn: func(resp *relay.RelayResponse) int64 {
			return estimatedCost
		},
		extraLogFields: func(lr *domain.Log) {
			lr.TotalTokens = estTokens
		},
	})
}

func (s *RelayService) AudioSpeech(ctx context.Context, token *domain.Token, user *domain.User, body []byte, ipAddress, userAgent string) (*relay.RelayResponse, *domain.Log, error) {
	var req dto.AudioSpeechRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, nil, err
	}

	group := resolveGroup(token, user)

	if err := checkModelLimits(token, req.Model); err != nil {
		return nil, nil, err
	}

	pricing, err := s.billing.GetPricing(ctx, req.Model, group)
	if err != nil {
		return nil, nil, err
	}

	preConsumed, costErr := s.billing.CalculateAudioCost(pricing)
	if costErr != nil {
		return nil, nil, costErr
	}

	if err := s.billing.PreConsume(ctx, user.ID, token.ID, preConsumed); err != nil {
		return nil, nil, err
	}

	info := s.buildRelayInfo(ctx, user, token, req.Model, group, ipAddress, userAgent)

	return s.doNonStreamRelay(ctx, user, token, info, nonStreamRelayParams{
		body:         body,
		upstreamPath: "/audio/speech",
		logType:      domain.LogTypeAudio,
		preConsumed:  preConsumed,
		actualCostFn: func(resp *relay.RelayResponse) int64 {
			if resp == nil || resp.StatusCode != http.StatusOK {
				return 0
			}
			return preConsumed
		},
	})
}

func (s *RelayService) AudioTranscriptions(ctx context.Context, token *domain.Token, user *domain.User, body []byte, contentType string, ipAddress, userAgent string) (*relay.RelayResponse, *domain.Log, error) {
	modelName := extractModelFromMultipart(body, contentType)
	if modelName == "" {
		modelName = "whisper-1"
	}

	group := resolveGroup(token, user)

	if err := checkModelLimits(token, modelName); err != nil {
		return nil, nil, err
	}

	pricing, err := s.billing.GetPricing(ctx, modelName, group)
	if err != nil {
		return nil, nil, err
	}

	preConsumed, costErr := s.billing.CalculateAudioCost(pricing)
	if costErr != nil {
		return nil, nil, costErr
	}

	if err := s.billing.PreConsume(ctx, user.ID, token.ID, preConsumed); err != nil {
		return nil, nil, err
	}

	info := s.buildRelayInfo(ctx, user, token, modelName, group, ipAddress, userAgent)
	info.ContentType = contentType

	return s.doNonStreamRelay(ctx, user, token, info, nonStreamRelayParams{
		body:         body,
		upstreamPath: "/audio/transcriptions",
		logType:      domain.LogTypeAudio,
		preConsumed:  preConsumed,
		actualCostFn: func(resp *relay.RelayResponse) int64 {
			if resp == nil || resp.StatusCode != http.StatusOK {
				return 0
			}
			return preConsumed
		},
	})
}

func (s *RelayService) ChatCompletions(ctx context.Context, token *domain.Token, user *domain.User, body []byte, ipAddress, userAgent string) (*relay.RelayResponse, *domain.Log, error) {
	var req dto.ChatCompletionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, nil, err
	}

	group := resolveGroup(token, user)

	if err := checkModelLimits(token, req.Model); err != nil {
		return nil, nil, err
	}

	pricing, err := s.billing.GetPricing(ctx, req.Model, group)
	if err != nil {
		return nil, nil, err
	}

	requestID := utils.GenerateRequestID()
	ctx = context.WithValue(ctx, requestIDKey, requestID)
	estPromptTokens := utils.EstimateMessagesTokens(convertMessages(req.Messages))
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 4096
	}
	estCompletionTokens := maxTokens

	isFreeTrial := ctx.Value(CtxKeyFreeTrial) != nil
	estimatedCost := int64(0)
	if !isFreeTrial {
		estimatedCost = s.billing.CalculateChatCost(pricing, estPromptTokens, 0, estCompletionTokens)
		if err := s.billing.PreConsume(ctx, user.ID, token.ID, estimatedCost); err != nil {
			return nil, nil, err
		}
	}

	mode := domain.LogModeNonStream
	if req.Stream {
		mode = domain.LogModeStream
	}

	info := &relay.RelayInfo{
		UserID:    user.ID,
		TokenID:   &token.ID,
		ModelName: req.Model,
		Group:     group,
		Token:     token,
		RequestID: requestID,
		Mode:      mode,
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}

	// 查询模型的 upstream_name
	if s.modelRepo != nil {
		if model, err := s.modelRepo.FindByName(ctx, req.Model); err == nil && model.UpstreamName != nil && *model.UpstreamName != "" {
			info.UpstreamModelName = *model.UpstreamName
		}
	}

	if req.Stream {
		return s.chatCompletionsStream(ctx, token, user, body, info, pricing, estimatedCost, requestID)
	}

	start := time.Now()
	resp, _, err := s.doRelayWithRetry(ctx, info, body, "/chat/completions")
	useTime := int(time.Since(start).Milliseconds())

	actualCost := int64(0)
	if resp != nil {
		actualCost = s.billing.CalculateChatCost(pricing, resp.Usage.PromptTokens, cachedPromptTokens(resp.Usage), resp.Usage.CompletionTokens)
	}

	if !isFreeTrial {
		if err != nil {
			if refundErr := s.billing.Refund(ctx, user.ID, token.ID, estimatedCost); refundErr != nil {
				slog.Error("refund failed", "error", refundErr, "request_id", reqID(ctx))
			}
		} else {
			if settleErr := s.billing.Settle(ctx, user.ID, token.ID, estimatedCost, actualCost); settleErr != nil {
				slog.Error("settle failed", "error", settleErr, "request_id", reqID(ctx))
			}
		}
	}

	logRecord := &domain.Log{
		UserID:           user.ID,
		TokenID:          &token.ID,
		ModelName:        req.Model,
		RequestID:        requestID,
		Type:             domain.LogTypeChat,
		Mode:             domain.LogModeNonStream,
		QuotaUsed:        actualCost,
		QuotaPreConsumed: estimatedCost,
		StatusCode:       http.StatusOK,
		IPAddress:        info.IPAddress,
		UserAgent:        info.UserAgent,
		RequestContent:   sanitizeRequestForLogging(body),
		ResponseContent:  "",
		UseTimeMs:        useTime,
	}
	if info.Channel != nil {
		logRecord.ChannelID = &info.Channel.ID
	}
	if resp != nil {
		logRecord.StatusCode = resp.StatusCode
		logRecord.PromptTokens = resp.Usage.PromptTokens
		logRecord.CompletionTokens = resp.Usage.CompletionTokens
		logRecord.CachedPromptTokens = cachedPromptTokens(resp.Usage)
		logRecord.TotalTokens = resp.Usage.TotalTokens
		if resp.StatusCode != http.StatusOK {
			logRecord.ErrorMessage = preserveErrorBody(resp)
		} else {
			logRecord.ResponseContent = preserveErrorBody(resp)
		}
	}
	if err != nil {
		logRecord.StatusCode = http.StatusBadGateway
		logRecord.ErrorMessage = err.Error()
	}

	logID, logErr := s.billing.CreateLog(ctx, logRecord)
	if logErr != nil {
		slog.Error("create log failed", "error", logErr, "request_id", reqID(ctx))
	}
	if !isFreeTrial {
		if err == nil && actualCost > 0 && logID > 0 {
			if recordErr := s.billing.RecordConsume(ctx, user.ID, token.ID, actualCost, logID); recordErr != nil {
				slog.Error("record consume failed", "error", recordErr, "request_id", reqID(ctx))
			}
		}
		if err != nil && estimatedCost > 0 && logID > 0 {
			if recordErr := s.billing.RecordRefund(ctx, user.ID, token.ID, estimatedCost, logID); recordErr != nil {
				slog.Error("record refund failed", "error", recordErr, "request_id", reqID(ctx))
			}
		}
	}

	return resp, logRecord, err
}

func (s *RelayService) chatCompletionsStream(
	ctx context.Context,
	token *domain.Token,
	user *domain.User,
	body []byte,
	info *relay.RelayInfo,
	pricing *domain.Pricing,
	estimatedCost int64,
	requestID string,
) (*relay.RelayResponse, *domain.Log, error) {
	ctx = context.WithValue(ctx, requestIDKey, requestID)
	isFreeTrial := ctx.Value(CtxKeyFreeTrial) != nil

	resp, _, err := s.doRelayWithRetry(ctx, info, body, "/chat/completions")
	if err != nil {
		if !isFreeTrial {
			if refundErr := s.billing.Refund(ctx, user.ID, token.ID, estimatedCost); refundErr != nil {
				slog.Error("refund failed", "error", refundErr, "request_id", reqID(ctx))
			}
		}
		return nil, nil, err
	}

	if resp == nil {
		if !isFreeTrial {
			if refundErr := s.billing.Refund(ctx, user.ID, token.ID, estimatedCost); refundErr != nil {
				slog.Error("refund failed", "error", refundErr, "request_id", reqID(ctx))
			}
		}
		return nil, nil, errors.New("empty upstream response")
	}

	resp.StreamHandler = func(w http.ResponseWriter, r *http.Request) (*dto.ChatCompletionUsage, error) {
		return s.streamChatResponse(ctx, w, r, resp.Body, info, pricing, estimatedCost, body, requestID)
	}

	placeholderLog := &domain.Log{
		UserID:           user.ID,
		TokenID:          &token.ID,
		ModelName:        info.ModelName,
		RequestID:        requestID,
		Type:             domain.LogTypeChat,
		Mode:             domain.LogModeStream,
		QuotaPreConsumed: estimatedCost,
		StatusCode:       http.StatusOK,
		IPAddress:        info.IPAddress,
		UserAgent:        info.UserAgent,
		RequestContent:   sanitizeRequestForLogging(body),
	}
	if info.Channel != nil {
		placeholderLog.ChannelID = &info.Channel.ID
	}

	return resp, placeholderLog, nil
}

func (s *RelayService) streamChatResponse(
	ctx context.Context,
	w http.ResponseWriter,
	r *http.Request,
	body io.ReadCloser,
	info *relay.RelayInfo,
	pricing *domain.Pricing,
	estimatedCost int64,
	requestBody []byte,
	requestID string,
) (*dto.ChatCompletionUsage, error) {
	defer body.Close()
	ctx = context.WithValue(ctx, requestIDKey, requestID)

	isFreeTrial := ctx.Value(CtxKeyFreeTrial) != nil

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, errors.New("response writer does not support flushing")
	}

	start := time.Now()
	var actualUsage dto.ChatCompletionUsage
	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		// Check for client disconnect to avoid resource leak
		select {
		case <-ctx.Done():
			slog.Warn("stream aborted: client disconnected", "request_id", requestID)
			return &actualUsage, ctx.Err()
		default:
		}

		line := scanner.Text()

		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")

		if data == "[DONE]" {
			if _, err := fmt.Fprintf(w, "data: [DONE]\n\n"); err != nil {
				slog.Warn("stream write [DONE] failed, client disconnected", "request_id", requestID)
				return &actualUsage, nil
			}
			flusher.Flush()
			break
		}

		var chunk struct {
			Usage *dto.ChatCompletionUsage `json:"usage"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err == nil && chunk.Usage != nil {
			actualUsage.PromptTokens = chunk.Usage.PromptTokens
			actualUsage.CompletionTokens = chunk.Usage.CompletionTokens
			actualUsage.TotalTokens = chunk.Usage.TotalTokens
			if chunk.Usage.PromptTokensDetails != nil {
				actualUsage.PromptTokensDetails = chunk.Usage.PromptTokensDetails
			}
		}

		if _, err := fmt.Fprintf(w, "%s\n\n", line); err != nil {
			slog.Warn("stream write chunk failed, client disconnected", "request_id", requestID)
			return &actualUsage, nil
		}
		flusher.Flush()
	}

	scanErr := scanner.Err()
	if scanErr != nil {
		slog.Error("stream scan failed", "error", scanErr, "request_id", reqID(ctx))
	}

	useTime := int(time.Since(start).Milliseconds())
	actualCost := s.billing.CalculateChatCost(pricing, actualUsage.PromptTokens, cachedPromptTokens(actualUsage), actualUsage.CompletionTokens)

	if !isFreeTrial {
		if info.TokenID == nil {
			slog.Error("stream billing requires token id, refunding pre-consumed quota", "request_id", reqID(ctx))
			// Must still refund the pre-consumed amount to avoid silent money loss
			if settleErr := s.billing.Settle(ctx, info.UserID, 0, estimatedCost, 0); settleErr != nil {
				slog.Error("stream settle (refund) failed for nil token id", "error", settleErr, "request_id", reqID(ctx))
			}
			actualCost = 0
		} else {
			tokenID := *info.TokenID
			if scanErr != nil {
				// Partial content was already delivered — settle with actual usage, not full refund
				if settleErr := s.billing.Settle(ctx, info.UserID, tokenID, estimatedCost, actualCost); settleErr != nil {
					slog.Error("stream settle failed", "error", settleErr, "request_id", reqID(ctx))
				}
				// Keep actualCost and actualUsage as-is — they reflect what was delivered
			} else {
				if settleErr := s.billing.Settle(ctx, info.UserID, tokenID, estimatedCost, actualCost); settleErr != nil {
					slog.Error("stream settle failed", "error", settleErr, "request_id", reqID(ctx))
				}
			}
		}
	}

	statusCode := http.StatusOK
	if scanErr != nil {
		statusCode = http.StatusBadGateway
	}

	logRecord := &domain.Log{
		UserID:           info.UserID,
		TokenID:          info.TokenID,
		ModelName:        info.ModelName,
		RequestID:        requestID,
		Type:             domain.LogTypeChat,
		Mode:             domain.LogModeStream,
		PromptTokens:       actualUsage.PromptTokens,
		CompletionTokens:   actualUsage.CompletionTokens,
		CachedPromptTokens: cachedPromptTokens(actualUsage),
		TotalTokens:        actualUsage.TotalTokens,
		QuotaUsed:        actualCost,
		QuotaPreConsumed: estimatedCost,
		StatusCode:       statusCode,
		IPAddress:        info.IPAddress,
		UserAgent:        info.UserAgent,
		RequestContent:   sanitizeRequestForLogging(requestBody),
		ResponseContent:  "",
		UseTimeMs:        useTime,
	}
	if info.Channel != nil {
		logRecord.ChannelID = &info.Channel.ID
	}

	logID, err := s.billing.CreateLog(ctx, logRecord)
	if err != nil {
		slog.Error("create log failed", "error", err, "request_id", reqID(ctx))
	}
	if !isFreeTrial && info.TokenID != nil {
		tokenID := *info.TokenID
		if actualCost > 0 && logID > 0 {
			if recordErr := s.billing.RecordConsume(ctx, info.UserID, tokenID, actualCost, logID); recordErr != nil {
				slog.Error("stream record consume failed", "error", recordErr, "request_id", reqID(ctx))
			}
		}
		if estimatedCost > actualCost && logID > 0 {
			if recordErr := s.billing.RecordRefund(ctx, info.UserID, tokenID, estimatedCost-actualCost, logID); recordErr != nil {
				slog.Error("stream record refund failed", "error", recordErr, "request_id", reqID(ctx))
			}
		}
	}

	if scanErr != nil {
		return nil, scanErr
	}
	return &actualUsage, nil
}

func (s *RelayService) doRelayWithRetry(ctx context.Context, info *relay.RelayInfo, body []byte, upstreamPath string) (*relay.RelayResponse, *domain.Log, error) {
	exclude := make([]uint64, 0)
	var lastErr error

	// Safeguard: maxRetries must be at least 1 to avoid zero-iteration loop
	retries := s.maxRetries
	if retries <= 0 {
		retries = 1
	}

	for attempt := 0; attempt < retries; attempt++ {
		ch, err := s.dispatcher.SelectChannelExcluding(ctx, info.ModelName, info.Group, exclude)
		if err != nil {
			// Cross-group retry fallback
			if errors.Is(err, relay.ErrNoAvailableChannel) && info.Token != nil && info.Token.CrossGroupRetry {
				ch, err = s.dispatcher.SelectAnyChannelExcluding(ctx, info.ModelName, exclude)
			}
			// Last resort: try including auto-banned channels
			if errors.Is(err, relay.ErrNoAvailableChannel) {
				ch, err = s.dispatcher.SelectChannelAsLastResort(ctx, info.ModelName, info.Group)
			}
			if err != nil {
				return nil, nil, err
			}
		}
		info.Channel = ch
		info.ChannelID = ch.ID

		adaptor, err := channel.NewAdaptor(ch.Type, ch.TimeoutSeconds)
		if err != nil {
			exclude = append(exclude, ch.ID); lastErr = err; continue
		}

		resp, logRecord, err := s.doRelay(ctx, adaptor, info, body, upstreamPath)
		if err == nil {
			if err := s.channelService.RecordSuccess(ctx, ch.ID, 0); err != nil {
				slog.Warn("failed to record channel success", "channel_id", ch.ID, "error", err)
			}
			return resp, logRecord, nil
		}

		lastErr = err
		exclude = append(exclude, ch.ID)
		if err := s.channelService.RecordFailure(ctx, ch.ID, err.Error(), s.autoBanThreshold); err != nil {
			slog.Warn("failed to record channel failure", "channel_id", ch.ID, "error", err)
		}
	}

	return nil, nil, lastErr
}

func (s *RelayService) doRelay(ctx context.Context, adaptor relay.Adaptor, info *relay.RelayInfo, body []byte, upstreamPath string) (*relay.RelayResponse, *domain.Log, error) {
	ch := info.Channel
	selectedKey := s.dispatcher.PickKey(ch.Keys)
	channelCtx := &relay.ChannelContext{
		Channel: &relay.ChannelInfo{
			ID:         ch.ID,
			Type:       string(ch.Type),
			Name:       ch.Name,
			BaseURL:    defaultStr(ch.BaseURL, ""),
			Key:        selectedKey,
			ModelMap:   ch.GetModelMapping(),
			TimeoutSec: ch.TimeoutSeconds,
		},
		Key:       selectedKey,
		BaseURL:   defaultStr(ch.BaseURL, ""),
		ModelMap:  ch.GetModelMapping(),
		ModelName: info.ModelName,
	}

	// 如果模型配置了 upstream_name 且渠道没有对应的 model_mapping，补充映射
	if info.UpstreamModelName != "" {
		if channelCtx.ModelMap == nil {
			channelCtx.ModelMap = map[string]string{}
		}
		if _, exists := channelCtx.ModelMap[info.ModelName]; !exists {
			channelCtx.ModelMap[info.ModelName] = info.UpstreamModelName
		}
		if _, exists := channelCtx.Channel.ModelMap[info.ModelName]; !exists {
			if channelCtx.Channel.ModelMap == nil {
				channelCtx.Channel.ModelMap = map[string]string{}
			}
			channelCtx.Channel.ModelMap[info.ModelName] = info.UpstreamModelName
		}
	}

	convertedBody, err := adaptor.ConvertRequest(ctx, info, body)
	if err != nil {
		return nil, nil, err
	}

	url := adaptor.GetRequestURL(channelCtx, upstreamPath)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(convertedBody))
	if err != nil {
		return nil, nil, err
	}
	if err := adaptor.SetupRequestHeader(httpReq, channelCtx, info); err != nil {
		return nil, nil, err
	}

	if info.ContentType != "" {
		httpReq.Header.Set("Content-Type", info.ContentType)
	}

	resp, err := adaptor.DoRequest(ctx, httpReq)
	if err != nil {
		return nil, nil, err
	}

	relayResp, err := adaptor.ParseResponse(ctx, info, resp)
	if err != nil {
		return nil, nil, err
	}

	// Apply StatusCodeMapping after ParseResponse (should see original upstream code)
	if codeMapping := ch.GetStatusCodeMapping(); codeMapping != nil {
		key := strconv.Itoa(relayResp.StatusCode)
		if mapped, ok := codeMapping[key]; ok {
			relayResp.StatusCode = mapped
		}
	}

	// Treat non-2xx as error to trigger retry + RecordFailure
	if relayResp.StatusCode < 200 || relayResp.StatusCode >= 300 {
		bodySnippet := preserveErrorBody(relayResp)
		return nil, nil, fmt.Errorf("upstream returned status %d: %s", relayResp.StatusCode, truncate(bodySnippet, 500))
	}

	return relayResp, nil, nil
}

func estimateEmbeddingTokens(input interface{}) int {
	switch v := input.(type) {
	case string:
		if len(v) == 0 {
			return 0
		}
		return max(1, len(v)/4)
	case []interface{}:
		total := 0
		for _, item := range v {
			if s, ok := item.(string); ok {
				total += max(1, len(s)/4)
			}
		}
		return total
	}
	return 0
}

func extractModelFromMultipart(body []byte, contentType string) string {
	// Parse boundary from content type: multipart/form-data; boundary=...
	boundary := parseMultipartBoundary(contentType)
	if boundary == "" {
		return ""
	}
	r := bytes.NewReader(body)
	reader := multipart.NewReader(r, boundary)
	form, err := reader.ReadForm(10 << 20) // 10 MB max
	if err != nil {
		return ""
	}
	defer form.RemoveAll()
	if vals, ok := form.Value["model"]; ok && len(vals) > 0 {
		return vals[0]
	}
	return ""
}

func parseMultipartBoundary(contentType string) string {
	const prefix = "boundary="
	idx := strings.Index(contentType, prefix)
	if idx < 0 {
		return ""
	}
	boundary := contentType[idx+len(prefix):]
	// Strip optional surrounding quotes (RFC 2046 Section 5.1.1)
	if len(boundary) >= 2 && boundary[0] == '"' && boundary[len(boundary)-1] == '"' {
		boundary = boundary[1 : len(boundary)-1]
	}
	return boundary
}

func convertMessages(messages []dto.ChatMessage) []struct{ Role, Content string } {
	result := make([]struct{ Role, Content string }, len(messages))
	for i, m := range messages {
		result[i] = struct{ Role, Content string }{Role: m.Role, Content: m.Content}
	}
	return result
}

func defaultStr(s *string, fallback string) string {
	if s == nil {
		return fallback
	}
	return *s
}

func sanitizeRequestForLogging(body []byte) string {
	if len(body) == 0 {
		return ""
	}
	// Try to parse as JSON and remove sensitive fields
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err == nil {
		removeSensitiveFields(data)
		if cleaned, err := json.Marshal(data); err == nil {
			return truncate(string(cleaned), 2000)
		}
	}
	// Fallback: truncate raw body
	return truncate(string(body), 2000)
}

// removeSensitiveFields recursively removes fields whose key contains sensitive words.
func removeSensitiveFields(m map[string]interface{}) {
	sensitiveKeys := []string{"api_key", "apikey", "token", "password", "secret"}
	for k, v := range m {
		lower := strings.ToLower(k)
		for _, sk := range sensitiveKeys {
			if strings.Contains(lower, sk) {
				m[k] = "[REDACTED]"
				break
			}
		}
		if nested, ok := v.(map[string]interface{}); ok {
			removeSensitiveFields(nested)
		}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func preserveErrorBody(resp *relay.RelayResponse) string {
	if resp == nil || resp.Body == nil {
		return ""
	}
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	resp.Body = io.NopCloser(bytes.NewReader(b))
	return truncate(string(b), 2000)
}

func checkModelLimits(token *domain.Token, modelName string) error {
	if !token.ModelLimitsEnabled {
		return nil
	}
	if token.ModelLimits == nil || *token.ModelLimits == "" {
		return ErrModelNotAllowed
	}
	var limits map[string]bool
	if err := json.Unmarshal([]byte(*token.ModelLimits), &limits); err != nil {
		return err
	}
	allowed, exists := limits[modelName]
	if !exists || !allowed {
		return ErrModelNotAllowed
	}
	return nil
}

func parseSize(size string) (width, height int) {
	parts := strings.Split(size, "x")
	if len(parts) == 2 {
		w, _ := strconv.Atoi(parts[0])
		h, _ := strconv.Atoi(parts[1])
		return w, h
	}
	return 1024, 1024
}

// resolveGroup returns the effective group for a token/user pair.
func resolveGroup(token *domain.Token, user *domain.User) string {
	if token.Group != "" {
		return token.Group
	}
	if user.Group != "" {
		return user.Group
	}
	return "default"
}

// buildRelayInfo creates a common RelayInfo with a generated request ID.
// If the model has an upstream_name configured, it is set as UpstreamModelName.
func (s *RelayService) buildRelayInfo(ctx context.Context, user *domain.User, token *domain.Token, modelName, group, ipAddress, userAgent string) *relay.RelayInfo {
	info := &relay.RelayInfo{
		UserID:    user.ID,
		TokenID:   &token.ID,
		ModelName: modelName,
		Group:     group,
		Token:     token,
		RequestID: utils.GenerateRequestID(),
		Mode:      domain.LogModeNonStream,
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}

	// 查询模型的 upstream_name
	if s.modelRepo != nil {
		if model, err := s.modelRepo.FindByName(ctx, modelName); err == nil && model.UpstreamName != nil && *model.UpstreamName != "" {
			info.UpstreamModelName = *model.UpstreamName
		}
	}

	return info
}

// cachedPromptTokens extracts the number of cache-hit prompt tokens from usage details.
func cachedPromptTokens(u dto.ChatCompletionUsage) int {
	if u.PromptTokensDetails != nil {
		return u.PromptTokensDetails.CachedTokens
	}
	return 0
}
