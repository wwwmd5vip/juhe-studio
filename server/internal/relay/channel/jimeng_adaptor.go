package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
)

// JimengAdaptor 即梦图像生成适配器（火山引擎视觉智能平台）
//
// 即梦通过火山引擎的 CVSync2Async 异步协议提供图像生成服务：
//   - 提交任务：POST {BaseURL}?Action=CVSync2AsyncSubmitTask&Version=2022-08-31
//   - 查询任务：POST {BaseURL}?Action=CVSync2AsyncGetResult&Version=2022-08-31
//
// 支持模型 (req_key):
//   - jimeng_t2i_v40 (v4.0 文生图/图生图)
//   - jimeng_seedream46_cvtob (v4.6 文生图/图生图)
//   - jimeng_t2i_v30 (v3.0 文生图)
//   - jimeng_t2i_v31 (v3.1 文生图)
//   - jimeng_i2i_v30 (v3.0 图生图智能参考)
//   - jimeng_edit_v10 (交互编辑 inpainting)
//   - jimeng_outpainting_v10 (智能扩图)
//   - jimeng_hr_v10 (智能超清)
type JimengAdaptor struct {
	BaseAdaptor
	reqKey string // model mapping 解析后的 req_key
	apiKey string // 渠道 Key，供轮询查询用
}

func NewJimengAdaptor(timeoutSec int) *JimengAdaptor {
	return &JimengAdaptor{
		BaseAdaptor: NewBaseAdaptor(timeoutSec),
	}
}

// =========================================================================
// 即梦请求/响应结构
// =========================================================================

// jimengSubmitRequest 提交任务请求
type jimengSubmitRequest struct {
	ReqKey     string   `json:"req_key"`
	Prompt     string   `json:"prompt"`
	N          int      `json:"n,omitempty"`
	Size       int      `json:"size,omitempty"`
	Width      int      `json:"width,omitempty"`
	Height     int      `json:"height,omitempty"`
	Scale      float64  `json:"scale,omitempty"`
	ForceSingle bool    `json:"force_single,omitempty"`
	ImageURLs  []string `json:"image_urls,omitempty"`
}

// jimengSubmitResponse 提交任务响应
type jimengSubmitResponse struct {
	Code      int              `json:"code"`
	Message   string           `json:"message"`
	Data      *jimengTaskData  `json:"data"`
	RequestID string           `json:"request_id"`
}

type jimengTaskData struct {
	TaskID string `json:"task_id"`
}

// jimengQueryRequest 查询任务请求
type jimengQueryRequest struct {
	ReqKey  string `json:"req_key"`
	TaskID  string `json:"task_id"`
}

// jimengQueryResponse 查询任务响应
type jimengQueryResponse struct {
	Code      int                  `json:"code"`
	Message   string               `json:"message"`
	Data      *jimengQueryData     `json:"data"`
	RequestID string               `json:"request_id"`
}

type jimengQueryData struct {
	Status           string   `json:"status"`
	ImageURLs        []string `json:"image_urls"`
	BinaryDataBase64 []string `json:"binary_data_base64"`
}

// =========================================================================
// Adaptor 接口实现
// =========================================================================

// GetRequestURL 构建提交任务 URL
// 格式: {BaseURL}?Action=CVSync2AsyncSubmitTask&Version=2022-08-31
func (a *JimengAdaptor) GetRequestURL(channel *relay.ChannelContext, path string) string {
	base := trimRightBar(channel.BaseURL)
	return base + "/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31"
}

func (a *JimengAdaptor) SetupRequestHeader(req *http.Request, channel *relay.ChannelContext, info *relay.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channel.Key)
	a.apiKey = channel.Key
	return nil
}

// ConvertRequest 将 OpenAI ImageGenerationRequest 转为即梦提交任务格式
func (a *JimengAdaptor) ConvertRequest(ctx context.Context, info *relay.RelayInfo, body []byte) ([]byte, error) {
	var openaiReq dto.ImageGenerationRequest
	if err := json.Unmarshal(body, &openaiReq); err != nil {
		return nil, fmt.Errorf("parse openai image request: %w", err)
	}

	// 从渠道 model mapping 或模型 upstream_name 获取 req_key
	// 格式: {"jimeng-v40": "jimeng_t2i_v40", "jimeng-v46": "jimeng_seedream46_cvtob"}
	reqKey := "jimeng_t2i_v40" // 默认
	if info.Channel != nil {
		mapping := info.Channel.GetModelMapping()
		if mapped, ok := mapping[openaiReq.Model]; ok && mapped != "" {
			reqKey = mapped
		} else if info.UpstreamModelName != "" {
			reqKey = info.UpstreamModelName
		}
	}
	a.reqKey = reqKey

	n := openaiReq.N
	if n <= 0 {
		n = 1
	}

	jr := jimengSubmitRequest{
		ReqKey: reqKey,
		Prompt: openaiReq.Prompt,
		N:      n,
	}

	// 解析 size 为 width/height 或 size(面积)
	if openaiReq.Size != "" {
		w, h, err := parseSize(openaiReq.Size)
		if err == nil {
			jr.Width = w
			jr.Height = h
			jr.Size = w * h
		}
	}
	// 默认值
	if jr.Width == 0 && jr.Height == 0 {
		jr.Width = 2048
		jr.Height = 2048
		jr.Size = 4194304
	}

	return json.Marshal(jr)
}

func (a *JimengAdaptor) DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	return a.client.Do(req)
}

// ParseResponse 解析提交响应 → 轮询查询 → 转换为 OpenAI 格式
func (a *JimengAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
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

	var submitResp jimengSubmitResponse
	if err := json.Unmarshal(bodyBytes, &submitResp); err != nil {
		return nil, fmt.Errorf("parse jimeng submit response: %w", err)
	}

	if submitResp.Code != 10000 {
		return nil, fmt.Errorf("jimeng submit error: code=%d message=%s", submitResp.Code, submitResp.Message)
	}
	if submitResp.Data == nil || submitResp.Data.TaskID == "" {
		return nil, fmt.Errorf("jimeng: no task_id returned (code=%d, message=%s)", submitResp.Code, submitResp.Message)
	}

	// 轮询任务结果
	imageURLs, pollErr := a.pollTask(ctx, info, submitResp.Data.TaskID)
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

// pollTask 轮询即梦任务直到完成或超时
func (a *JimengAdaptor) pollTask(ctx context.Context, info *relay.RelayInfo, taskID string) ([]string, error) {
	baseURL := "https://visual.volcengineapi.com"
	if info.Channel != nil && info.Channel.BaseURL != nil && *info.Channel.BaseURL != "" {
		baseURL = trimRightBar(*info.Channel.BaseURL)
	}

	queryURL := baseURL + "/?Action=CVSync2AsyncGetResult&Version=2022-08-31"

	maxRetries := 120       // 最多 120 次
	// TODO: the 2s polling interval could be made configurable.
	pollInterval := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		timer := time.NewTimer(pollInterval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, fmt.Errorf("jimeng task polling cancelled: task_id=%s", taskID)
		case <-timer.C:
		}

		queryResp, err := a.queryTask(ctx, queryURL, taskID)
		if err != nil {
			// 网络错误，继续重试
			if i >= maxRetries-1 {
				return nil, fmt.Errorf("jimeng task polling failed after %d retries: task_id=%s, last_err=%w", maxRetries, taskID, err)
			}
			continue
		}

		if queryResp.Code != 10000 {
			return nil, fmt.Errorf("jimeng query error: code=%d message=%s task_id=%s", queryResp.Code, queryResp.Message, taskID)
		}
		if queryResp.Data == nil {
			return nil, fmt.Errorf("jimeng query: empty data for task_id=%s", taskID)
		}

		switch queryResp.Data.Status {
		case "done":
			if len(queryResp.Data.ImageURLs) > 0 {
				return queryResp.Data.ImageURLs, nil
			}
			if len(queryResp.Data.BinaryDataBase64) > 0 {
				return nil, fmt.Errorf("jimeng: base64 images not supported, use return_url mode")
			}
			return nil, fmt.Errorf("jimeng: task done but no images (task_id=%s)", taskID)
		case "failed", "error":
			return nil, fmt.Errorf("jimeng task failed: task_id=%s message=%s", taskID, queryResp.Message)
		case "not_found", "expired":
			return nil, fmt.Errorf("jimeng task %s: status=%s", taskID, queryResp.Data.Status)
		case "generating", "in_queue":
			// 继续轮询
		default:
			// 未知状态，继续轮询
		}
	}

	return nil, fmt.Errorf("jimeng task polling timeout after %d retries: task_id=%s", maxRetries, taskID)
}

// queryTask 发送查询请求
func (a *JimengAdaptor) queryTask(ctx context.Context, url, taskID string) (*jimengQueryResponse, error) {
	if a.reqKey == "" {
		a.reqKey = "jimeng_t2i_v40"
	}

	qr := jimengQueryRequest{
		ReqKey: a.reqKey,
		TaskID: taskID,
	}
	bodyBytes, err := json.Marshal(qr)
	if err != nil {
		return nil, fmt.Errorf("marshal query request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
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

	var queryResp jimengQueryResponse
	if err := json.Unmarshal(respBytes, &queryResp); err != nil {
		return nil, fmt.Errorf("parse query response: %w (raw=%s)", err, string(respBytes))
	}
	return &queryResp, nil
}

// =========================================================================
// 工具函数
// =========================================================================

// parseSize 解析 OpenAI size 字符串 "WxH" 或 "W*H"
func parseSize(size string) (int, int, error) {
	size = strings.TrimSpace(size)
	var w, h int
	var err error

	if strings.Contains(size, "x") {
		parts := strings.SplitN(size, "x", 2)
		w, err = strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil {
			return 0, 0, fmt.Errorf("invalid width in size %q: %w", size, err)
		}
		h, err = strconv.Atoi(strings.TrimSpace(parts[1]))
		if err != nil {
			return 0, 0, fmt.Errorf("invalid height in size %q: %w", size, err)
		}
		return w, h, nil
	}

	if strings.Contains(size, "*") {
		parts := strings.SplitN(size, "*", 2)
		w, err = strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil {
			return 0, 0, fmt.Errorf("invalid width in size %q: %w", size, err)
		}
		h, err = strconv.Atoi(strings.TrimSpace(parts[1]))
		if err != nil {
			return 0, 0, fmt.Errorf("invalid height in size %q: %w", size, err)
		}
		return w, h, nil
	}

	return 0, 0, fmt.Errorf("unsupported size format: %q (expected WxH or W*H)", size)
}

// 确保实现 Adaptor 接口
var _ relay.Adaptor = (*JimengAdaptor)(nil)
