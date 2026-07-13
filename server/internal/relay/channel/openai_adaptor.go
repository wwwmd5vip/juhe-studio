package channel

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
)

// ssrfClient is a dedicated HTTP client for downloading image URLs with
// SSRF protection (private IP blocking, redirect validation, timeout, size limit).
// TODO: the 30s timeout could be made configurable via an environment variable.
var ssrfClient = &http.Client{
	Timeout: 30 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		return checkSSRF(req.URL)
	},
}

// checkSSRF validates that the URL host does not resolve to a private/loopback IP.
func checkSSRF(u *url.URL) error {
	host := u.Hostname()
	if host == "localhost" {
		return fmt.Errorf("blocked SSRF: localhost")
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return err
	}
	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() {
			return fmt.Errorf("blocked SSRF: %s resolves to private IP %s", host, ip)
		}
	}
	return nil
}

// OpenAICompatibleAdaptor 通用 OpenAI 协议适配器（含连接池）
type OpenAICompatibleAdaptor struct {
	BaseAdaptor
}

func NewOpenAICompatibleAdaptor(timeoutSec int) *OpenAICompatibleAdaptor {
	return &OpenAICompatibleAdaptor{
		BaseAdaptor: NewBaseAdaptor(timeoutSec),
	}
}

// NewOpenAICompatibleAdaptorDefault 使用默认超时
func NewOpenAICompatibleAdaptorDefault() *OpenAICompatibleAdaptor {
	return NewOpenAICompatibleAdaptor(120)
}

func (a *OpenAICompatibleAdaptor) GetRequestURL(channel *relay.ChannelContext, path string) string {
	baseURL := channel.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = trimRightBar(baseURL)
	if path == "" {
		return baseURL
	}
	if path[0] == '/' {
		return baseURL + path
	}
	return baseURL + "/" + path
}

func (a *OpenAICompatibleAdaptor) SetupRequestHeader(req *http.Request, channel *relay.ChannelContext, info *relay.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channel.Key)
	return nil
}

func (a *OpenAICompatibleAdaptor) ConvertRequest(ctx context.Context, info *relay.RelayInfo, body []byte) ([]byte, error) {
	// 优先使用渠道的 model_mapping，其次使用模型的 upstream_name
	upstreamName := info.UpstreamModelName
	mapping := info.Channel.GetModelMapping()

	var reqMap map[string]any
	if err := json.Unmarshal(body, &reqMap); err != nil {
		return body, err
	}

	if modelName, ok := reqMap["model"].(string); ok {
		if len(mapping) > 0 {
			if mapped, exists := mapping[modelName]; exists {
				reqMap["model"] = mapped
				return json.Marshal(reqMap)
			}
		}
		if upstreamName != "" {
			reqMap["model"] = upstreamName
		}
	}

	return json.Marshal(reqMap)
}

func (a *OpenAICompatibleAdaptor) DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	return a.client.Do(req)
}

func (a *OpenAICompatibleAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
	contentType := resp.Header.Get("Content-Type")
	// SSE streaming responses: return the body unconsumed for the stream handler
	if bytes.Contains([]byte(contentType), []byte("text/event-stream")) {
		// If upstream returns SSE content type with an error status, close the body
		// and return an error — otherwise the body leaks in the retry loop.
		if resp.StatusCode >= 400 {
			resp.Body.Close()
			return nil, fmt.Errorf("upstream returned SSE error: %d", resp.StatusCode)
		}
		return &relay.RelayResponse{
			StatusCode:  resp.StatusCode,
			ContentType: contentType,
			Body:        resp.Body,
			Streaming:   true,
		}, nil
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, MaxUpstreamResponseSize))
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	var chatResp dto.ChatCompletionResponse
	usage := dto.ChatCompletionUsage{}
	if err := json.Unmarshal(bodyBytes, &chatResp); err == nil {
		usage = chatResp.Usage
	}

	// 图像生成响应：如果上游返回了 URL，自动下载转为 b64_json
	if resp.StatusCode == http.StatusOK && info != nil {
		bodyBytes = convertImageURLsToBase64(ctx, bodyBytes)
	}

	return &relay.RelayResponse{
		StatusCode:    resp.StatusCode,
		ContentType:   resp.Header.Get("Content-Type"),
		Body:          io.NopCloser(bytes.NewReader(bodyBytes)),
		Usage:         usage,
		UpstreamModel: chatResp.Model,
		Streaming:     false,
	}, nil
}

// convertImageURLsToBase64 检查图像生成响应，将 data[].url 下载为 base64 并替换为 b64_json
func convertImageURLsToBase64(ctx context.Context, body []byte) []byte {
	// 快速检查：响应体是否包含 "url" 字段
	if !bytes.Contains(body, []byte(`"url"`)) {
		return body
	}

	var imgResp struct {
		Data []map[string]any `json:"data"`
	}
	if err := json.Unmarshal(body, &imgResp); err != nil {
		return body
	}
	if len(imgResp.Data) == 0 {
		return body
	}

	modified := false
	for i, item := range imgResp.Data {
		// 已经有 b64_json 的跳过
		if _, hasB64 := item["b64_json"]; hasB64 {
			continue
		}
		urlStr, ok := item["url"].(string)
		if !ok || urlStr == "" {
			continue
		}

		// Validate URL before fetching (SSRF protection)
		parsedURL, err := url.Parse(urlStr)
		if err != nil || checkSSRF(parsedURL) != nil {
			continue
		}

		// 下载图片
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
		if err != nil {
			continue
		}
		httpResp, err := ssrfClient.Do(req)
		if err != nil {
			continue
		}
		if httpResp.StatusCode != http.StatusOK {
			httpResp.Body.Close()
			continue
		}
		imgBytes, err := io.ReadAll(io.LimitReader(httpResp.Body, 10*1024*1024))
		httpResp.Body.Close()
		if err != nil {
			continue
		}

		imgResp.Data[i]["b64_json"] = base64.StdEncoding.EncodeToString(imgBytes)
		delete(imgResp.Data[i], "url")
		modified = true
	}

	if !modified {
		return body
	}

	newBody, err := json.Marshal(imgResp)
	if err != nil {
		return body
	}
	return newBody
}

func trimRightBar(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}
