package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
)

// KlingAdaptor 可灵图像生成适配器（阿里云百炼 DashScope API）
//
// 可灵通过阿里云百炼 DashScope 提供异步图像生成服务：
//   - 提交任务：POST {BaseURL}/api/v1/services/aigc/image-generation/generation
//     Header: X-DashScope-Async: enable
//   - 查询任务：GET  {BaseURL}/api/v1/tasks/{task_id}
//
// 支持模型:
//   - kling/kling-v3-image-generation (文生图+图生图)
//   - kling/kling-v3-omni-image-generation (文生图+图生图+组图)
type KlingAdaptor struct {
	BaseAdaptor
	model  string // model mapping 解析后的上游模型名
	apiKey string // 渠道 Key
}

func NewKlingAdaptor(timeoutSec int) *KlingAdaptor {
	return &KlingAdaptor{
		BaseAdaptor: NewBaseAdaptor(timeoutSec),
	}
}

// =========================================================================
// Kling/DashScope 请求/响应结构
// =========================================================================

// klingSubmitRequest 提交任务请求
type klingSubmitRequest struct {
	Model      string              `json:"model"`
	Input      klingInput          `json:"input"`
	Parameters *klingParameters    `json:"parameters,omitempty"`
}

type klingInput struct {
	Messages []klingMessage `json:"messages"`
}

type klingMessage struct {
	Role    string          `json:"role"`
	Content []klingContent  `json:"content"`
}

type klingContent struct {
	Text  string `json:"text,omitempty"`
	Image string `json:"image,omitempty"`
}

type klingParameters struct {
	N            int    `json:"n,omitempty"`
	ResultType   string `json:"result_type,omitempty"`
	AspectRatio  string `json:"aspect_ratio,omitempty"`
	Resolution   string `json:"resolution,omitempty"`
}

// klingSubmitResponse 提交任务响应
type klingSubmitResponse struct {
	Output    *klingTaskOutput `json:"output"`
	RequestID string           `json:"request_id"`
	Code      string           `json:"code,omitempty"`
	Message   string           `json:"message,omitempty"`
}

type klingTaskOutput struct {
	TaskID     string `json:"task_id"`
	TaskStatus string `json:"task_status"`
}

// klingQueryResponse 查询任务响应
type klingQueryResponse struct {
	Output    *klingTaskResult `json:"output"`
	Usage     *klingUsage      `json:"usage,omitempty"`
	RequestID string           `json:"request_id"`
	Code      string           `json:"code,omitempty"`
	Message   string           `json:"message,omitempty"`
}

type klingTaskResult struct {
	TaskID     string          `json:"task_id"`
	TaskStatus string          `json:"task_status"`
	Choices    []klingChoice   `json:"choices,omitempty"`
}

type klingChoice struct {
	FinishReason string       `json:"finish_reason"`
	Message      klingMessage `json:"message"`
}

type klingUsage struct {
	ImageCount int    `json:"image_count"`
	Size       string `json:"size,omitempty"`
}

// =========================================================================
// Adaptor 接口实现
// =========================================================================

// GetRequestURL 构建提交任务 URL
func (a *KlingAdaptor) GetRequestURL(channel *relay.ChannelContext, path string) string {
	base := trimRightBar(channel.BaseURL)
	return base + "/api/v1/services/aigc/image-generation/generation"
}

func (a *KlingAdaptor) SetupRequestHeader(req *http.Request, channel *relay.ChannelContext, info *relay.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channel.Key)
	req.Header.Set("X-DashScope-Async", "enable")
	a.apiKey = channel.Key
	return nil
}

// ConvertRequest 将 OpenAI ImageGenerationRequest 转为 Kling/DashScope 格式
func (a *KlingAdaptor) ConvertRequest(ctx context.Context, info *relay.RelayInfo, body []byte) ([]byte, error) {
	var openaiReq dto.ImageGenerationRequest
	if err := json.Unmarshal(body, &openaiReq); err != nil {
		return nil, fmt.Errorf("parse openai image request: %w", err)
	}

	// 从渠道 model mapping 获取上游模型名
	model := "kling/kling-v3-image-generation" // 默认
	if info.Channel != nil {
		mapping := info.Channel.GetModelMapping()
		if mapped, ok := mapping[openaiReq.Model]; ok && mapped != "" {
			model = mapped
		}
	}
	a.model = model

	n := openaiReq.N
	if n <= 0 {
		n = 1
	}

	kr := klingSubmitRequest{
		Model: model,
		Input: klingInput{
			Messages: []klingMessage{
				{
					Role: "user",
					Content: []klingContent{
						{Text: openaiReq.Prompt},
					},
				},
			},
		},
		Parameters: &klingParameters{
			N:           n,
			AspectRatio: aspectRatioOrSize(openaiReq.AspectRatio, openaiReq.Size, sizeToKlingAspectRatio),
			Resolution:  sizeToKlingResolution(openaiReq.Size),
		},
	}

	return json.Marshal(kr)
}

func (a *KlingAdaptor) DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	return a.client.Do(req)
}

// ParseResponse 解析提交响应 → 轮询查询 → 转换为 OpenAI 格式
func (a *KlingAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, MaxUpstreamResponseSize))
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("read submit response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return &relay.RelayResponse{
			StatusCode: resp.StatusCode,
			Body:       io.NopCloser(bytes.NewReader(bodyBytes)),
		}, nil
	}

	var submitResp klingSubmitResponse
	if err := json.Unmarshal(bodyBytes, &submitResp); err != nil {
		return nil, fmt.Errorf("parse kling submit response: %w", err)
	}

	if submitResp.Code != "" {
		return nil, fmt.Errorf("kling submit error: code=%s message=%s", submitResp.Code, submitResp.Message)
	}
	if submitResp.Output == nil || submitResp.Output.TaskID == "" {
		return nil, fmt.Errorf("kling: no task_id returned (raw=%s)", string(bodyBytes))
	}

	// 轮询任务结果
	imageURLs, pollErr := a.pollTask(ctx, info, submitResp.Output.TaskID)
	if pollErr != nil {
		return nil, pollErr
	}

	// 转换为 OpenAI 图片生成响应格式
	images := make([]dto.ImageURL, 0, len(imageURLs))
	for _, url := range imageURLs {
		images = append(images, dto.ImageURL{URL: url})
	}

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

// pollTask 轮询可灵任务直到完成或超时
func (a *KlingAdaptor) pollTask(ctx context.Context, info *relay.RelayInfo, taskID string) ([]string, error) {
	baseURL := "https://dashscope.aliyuncs.com"
	if info.Channel != nil && info.Channel.BaseURL != nil && *info.Channel.BaseURL != "" {
		baseURL = trimRightBar(*info.Channel.BaseURL)
	}

	queryURL := baseURL + "/api/v1/tasks/" + taskID

	maxRetries := 120
	// TODO: the 3s polling interval could be made configurable.
	pollInterval := 3 * time.Second

	for i := 0; i < maxRetries; i++ {
		timer := time.NewTimer(pollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, fmt.Errorf("kling task polling cancelled: task_id=%s", taskID)
		case <-timer.C:
		}

		queryResp, err := a.queryTask(ctx, queryURL)
		if err != nil {
			if i >= maxRetries-1 {
				return nil, fmt.Errorf("kling task polling failed after %d retries: task_id=%s, last_err=%w", maxRetries, taskID, err)
			}
			continue
		}

		if queryResp.Code != "" {
			return nil, fmt.Errorf("kling query error: code=%s message=%s task_id=%s", queryResp.Code, queryResp.Message, taskID)
		}
		if queryResp.Output == nil {
			return nil, fmt.Errorf("kling query: empty output for task_id=%s", taskID)
		}

		switch queryResp.Output.TaskStatus {
		case "SUCCEEDED":
			if len(queryResp.Output.Choices) == 0 {
				return nil, fmt.Errorf("kling: task succeeded but no choices (task_id=%s)", taskID)
			}
			// 从 content 提取所有 image URLs
			var urls []string
			for _, choice := range queryResp.Output.Choices {
				for _, content := range choice.Message.Content {
					if content.Image != "" {
						urls = append(urls, content.Image)
					}
				}
			}
			if len(urls) == 0 {
				return nil, fmt.Errorf("kling: task succeeded but no image urls (task_id=%s)", taskID)
			}
			return urls, nil
		case "FAILED", "CANCELED":
			return nil, fmt.Errorf("kling task %s: task_id=%s", strings.ToLower(queryResp.Output.TaskStatus), taskID)
		case "UNKNOWN":
			return nil, fmt.Errorf("kling task not found or expired: task_id=%s", taskID)
		case "PENDING", "RUNNING":
			// 继续轮询
		default:
			// 未知状态，继续轮询
		}
	}

	return nil, fmt.Errorf("kling task polling timeout after %d retries: task_id=%s", maxRetries, taskID)
}

// queryTask 发送查询请求
func (a *KlingAdaptor) queryTask(ctx context.Context, url string) (*klingQueryResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, MaxUpstreamResponseSize))
	if err != nil {
		return nil, err
	}

	var queryResp klingQueryResponse
	if err := json.Unmarshal(respBytes, &queryResp); err != nil {
		return nil, fmt.Errorf("parse query response: %w (raw=%s)", err, string(respBytes))
	}
	return &queryResp, nil
}

// =========================================================================
// 工具函数
// =========================================================================

// sizeToKlingAspectRatio OpenAI size → Kling aspect_ratio
func sizeToKlingAspectRatio(size string) string {
	switch size {
	case "1792x1024":
		return "16:9"
	case "1024x1792":
		return "9:16"
	default:
		return "1:1"
	}
}

// sizeToKlingResolution OpenAI size → Kling resolution (1k/2k/4k)
func sizeToKlingResolution(size string) string {
	area := sizeArea(size)
	switch {
	case area >= 4096*4096:
		return "4k"
	case area >= 2048*2048:
		return "2k"
	default:
		return "1k"
	}
}

// sizeArea 计算 size 字符串对应的像素面积
func sizeArea(size string) int {
	switch size {
	case "256x256":
		return 256 * 256
	case "512x512":
		return 512 * 512
	case "1024x1024":
		return 1024 * 1024
	case "1024x1792":
		return 1024 * 1792
	case "1792x1024":
		return 1792 * 1024
	case "2048x2048":
		return 2048 * 2048
	default:
		return 1024 * 1024
	}
}

// 确保实现 Adaptor 接口
var _ relay.Adaptor = (*KlingAdaptor)(nil)

// aspectRatioOrSize 优先使用显式的 aspectRatio，否则用 size 推导
func aspectRatioOrSize(aspectRatio string, size string, fromSize func(string) string) string {
	if aspectRatio != "" {
		return aspectRatio
	}
	return fromSize(size)
}
