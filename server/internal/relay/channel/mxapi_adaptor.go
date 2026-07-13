package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
)

// MXAPIAdaptor MXAPI 中转站适配器（MXAPI 原生 V2 异步协议）
// MXAPI 中转站使用自定义协议，非 OpenAI 兼容格式。
// 图片生成流程：POST 提交任务 → 获取 task_id → 轮询 GET 查询 → 返回结果。
type MXAPIAdaptor struct {
	BaseAdaptor
	endpoint string // ConvertRequest 缓存的端点路径
	apiKey   string // SetupRequestHeader 获取，供 pollTask 用
}

func NewMXAPIAdaptor(timeoutSec int) *MXAPIAdaptor {
	return &MXAPIAdaptor{
		BaseAdaptor: NewBaseAdaptor(timeoutSec),
	}
}

// =========================================================================
// MXAPI 原生请求/响应结构
// =========================================================================

// mxapiImageRequest MXAPI 图片生成请求
type mxapiImageRequest struct {
	Prompt        string   `json:"prompt"`
	ImageSize     string   `json:"image_size,omitempty"`
	AspectRatio   string   `json:"aspect_ratio,omitempty"`
	Quality       string   `json:"quality,omitempty"`
	Resolution    string   `json:"resolution,omitempty"`
	ReferenceMode string   `json:"reference_mode,omitempty"`
	ReferenceImages []string `json:"reference_images,omitempty"`
}

// mxapiImageResponse MXAPI 通用响应（提交 + 查询）
type mxapiImageResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    *mxapiImageData `json:"data,omitempty"`
}

type mxapiImageData struct {
	URL      string       `json:"url,omitempty"`
	TaskID   string       `json:"task_id,omitempty"`
	Status   string       `json:"status,omitempty"`
	TaskType string       `json:"task_type,omitempty"`
	Result   *mxapiResult `json:"result,omitempty"`
}

type mxapiResult struct {
	Images []string `json:"images,omitempty"`
}

// =========================================================================
// Adaptor 接口实现
// =========================================================================

// GetRequestURL 使用 ConvertRequest 缓存的端点构建 MXAPI URL
func (a *MXAPIAdaptor) GetRequestURL(channel *relay.ChannelContext, path string) string {
	base := trimRightBar(channel.BaseURL)
	if a.endpoint == "" {
		a.endpoint = "/api/v2/nano"
	}
	return base + a.endpoint
}

func (a *MXAPIAdaptor) SetupRequestHeader(req *http.Request, channel *relay.ChannelContext, info *relay.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channel.Key)
	a.apiKey = channel.Key
	return nil
}

// ConvertRequest 将 OpenAI 格式转为 MXAPI 原生格式
func (a *MXAPIAdaptor) ConvertRequest(ctx context.Context, info *relay.RelayInfo, body []byte) ([]byte, error) {
	var openaiReq dto.ImageGenerationRequest
	if err := json.Unmarshal(body, &openaiReq); err != nil {
		return nil, fmt.Errorf("parse openai image request: %w", err)
	}

	// 根据渠道配置的模型映射或模型 upstream_name，将本地模型名转为上游模型名
	modelName := openaiReq.Model
	if mapping := info.Channel.GetModelMapping(); len(mapping) > 0 {
		if mapped, ok := mapping[modelName]; ok {
			modelName = mapped
		}
	} else if info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}

	a.endpoint = endpointForModel(modelName)

	mxReq := mxapiImageRequest{
		Prompt:        openaiReq.Prompt,
		ReferenceMode: openaiReq.ReferenceMode,
	}

	// 将 base64 参考图转为 data URL（MXAPI 要求 reference_images 为 URL 格式）
	if len(openaiReq.Images) > 0 {
		mxReq.ReferenceImages = make([]string, len(openaiReq.Images))
		for i, img := range openaiReq.Images {
			if strings.HasPrefix(img, "http://") || strings.HasPrefix(img, "https://") || strings.HasPrefix(img, "data:") {
				mxReq.ReferenceImages[i] = img
			} else {
				// 纯 base64 -> data URL
				mxReq.ReferenceImages[i] = "data:image/png;base64," + img
			}
		}
	}

	switch {
	case strings.Contains(a.endpoint, "gpt-image"):
		// Prefer explicit aspect_ratio from request, fall back to deriving from size
		if openaiReq.AspectRatio != "" {
			mxReq.AspectRatio = openaiReq.AspectRatio
		} else {
			mxReq.AspectRatio = sizeToAspectRatio(openaiReq.Size)
		}
		mxReq.Quality = "auto"
		mxReq.Resolution = sizeToResolution(openaiReq.Size)
	default:
		mxReq.ImageSize = sizeToMXAPIImageSize(openaiReq.Size)
	}

	mxReqBytes, err := json.Marshal(mxReq)
	if err != nil {
		return nil, err
	}
	// 调试日志：仅打印 endpoint（不打印请求体避免泄露用户数据）
	log.Printf("[MXAPI] endpoint=%s", a.endpoint)
	return mxReqBytes, nil
}

func (a *MXAPIAdaptor) DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	return a.client.Do(req)
}

// ParseResponse 解析 MXAPI 响应并转为 OpenAI 格式
func (a *MXAPIAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, MaxUpstreamResponseSize))
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return &relay.RelayResponse{
			StatusCode: resp.StatusCode,
			Body:       io.NopCloser(bytes.NewReader(bodyBytes)),
		}, nil
	}

	var mxResp mxapiImageResponse
	if err := json.Unmarshal(bodyBytes, &mxResp); err != nil {
		// 无法解析为 MXAPI 格式，透传原始响应
		return &relay.RelayResponse{
			StatusCode:  http.StatusOK,
			ContentType: "application/json",
			Body:        io.NopCloser(bytes.NewReader(bodyBytes)),
		}, nil
	}

	if mxResp.Code != 0 && mxResp.Code != 200 {
		return nil, fmt.Errorf("mxapi api error: code=%d message=%s", mxResp.Code, mxResp.Message)
	}
	if mxResp.Data == nil {
		return nil, fmt.Errorf("mxapi: empty response data (raw=%s)", string(bodyBytes))
	}

	url := mxResp.Data.URL
	taskID := mxResp.Data.TaskID

	// 异步模式：有 task_id 无 url → 轮询
	if taskID != "" && url == "" {
		finalURL, pollErr := a.pollTask(ctx, info, taskID)
		if pollErr != nil {
			return nil, pollErr
		}
		url = finalURL
	}

	if url == "" {
		return nil, fmt.Errorf("mxapi: no image url returned (code=%d, msg=%s, status=%s, raw=%s)",
			mxResp.Code, mxResp.Message, mxResp.Data.Status, string(bodyBytes))
	}

	images := []dto.ImageURL{{URL: url}}
	openaiResp := dto.ImageGenerationResponse{
		Created: time.Now().Unix(),
		Data:    images,
	}

	respBytes, _ := json.Marshal(openaiResp)
	return &relay.RelayResponse{
		StatusCode:  http.StatusOK,
		ContentType: "application/json",
		Body:        io.NopCloser(bytes.NewReader(respBytes)),
	}, nil
}

// =========================================================================
// 异步轮询
// =========================================================================

// pollTask 轮询 MXAPI 任务直到完成或超时
func (a *MXAPIAdaptor) pollTask(ctx context.Context, info *relay.RelayInfo, taskID string) (string, error) {
	baseURL := "https://open.mxapi.org"
	if info.Channel.BaseURL != nil {
		baseURL = *info.Channel.BaseURL
	}
	baseURL = trimRightBar(baseURL)

	taskURL := baseURL + "/api/v2/nano/task"
	if strings.Contains(a.endpoint, "gpt-image") {
		taskURL = baseURL + "/api/v2/gpt-image/task"
	}

	maxRetries := 60
	// TODO: the 2s polling interval could be made configurable.
	for i := 0; i < maxRetries; i++ {
		timer := time.NewTimer(2 * time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return "", fmt.Errorf("task polling cancelled")
		case <-timer.C:
		}

		taskResp, err := a.fetchTaskStatus(ctx, taskURL, taskID, a.apiKey)
		if err != nil {
			continue
		}

		switch taskResp.Data.Status {
		case "completed", "succeeded":
			if taskResp.Data.URL != "" {
				return taskResp.Data.URL, nil
			}
			if taskResp.Data.Result != nil && len(taskResp.Data.Result.Images) > 0 {
				return taskResp.Data.Result.Images[0], nil
			}
			return "", fmt.Errorf("task completed but no url returned")
		case "failed", "error":
			return "", fmt.Errorf("task failed: %s", taskResp.Message)
		case "processing", "pending", "running":
			continue
		default:
			continue
		}
	}
	return "", fmt.Errorf("task polling timeout after %d retries", maxRetries)
}

func (a *MXAPIAdaptor) fetchTaskStatus(ctx context.Context, url, taskID, key string) (*mxapiImageResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s?task_id=%s", url, taskID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, MaxUpstreamResponseSize))
	if err != nil {
		return nil, err
	}

	var taskResp mxapiImageResponse
	if err := json.Unmarshal(body, &taskResp); err != nil {
		return nil, err
	}
	return &taskResp, nil
}

// =========================================================================
// 工具函数
// =========================================================================

// endpointForModel 从上游模型名推断 MXAPI 端点路径
func endpointForModel(modelName string) string {
	lower := strings.ToLower(modelName)
	switch {
	case strings.Contains(lower, "gpt-image-2"):
		return "/api/v2/gpt-image-2"
	case strings.Contains(lower, "nano-pro"):
		return "/api/v2/nano-pro"
	case strings.Contains(lower, "nano2"):
		return "/api/v2/nano2"
	default:
		return "/api/v2/nano"
	}
}

// sizeToAspectRatio OpenAI size → MXAPI aspect_ratio
func sizeToAspectRatio(size string) string {
	switch size {
	case "1792x1024":
		return "16:9"
	case "1024x1792":
		return "9:16"
	default:
		return "1:1"
	}
}

// sizeToResolution OpenAI size → MXAPI resolution（1K/2K/4K）
func sizeToResolution(size string) string {
	switch size {
	case "1792x1024", "1024x1792":
		return "2K"
	case "2048x2048":
		return "2K"
	default:
		return "1K"
	}
}

// sizeToMXAPIImageSize OpenAI size → MXAPI image_size（nano 端点用）
func sizeToMXAPIImageSize(size string) string {
	switch size {
	case "256x256":
		return "256P"
	case "512x512":
		return "512P"
	case "1024x1024":
		return "1K"
	case "2048x2048":
		return "2K"
	default:
		return "1K"
	}
}

// 确保实现 Adaptor 接口
var _ relay.Adaptor = (*MXAPIAdaptor)(nil)
