package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
)

// AnthropicAdaptor Anthropic Messages API → OpenAI Chat Completions 协议转换
type AnthropicAdaptor struct {
	BaseAdaptor
}

func NewAnthropicAdaptor(timeoutSec int) *AnthropicAdaptor {
	return &AnthropicAdaptor{
		BaseAdaptor: NewBaseAdaptor(timeoutSec),
	}
}

func (a *AnthropicAdaptor) GetRequestURL(channel *relay.ChannelContext, path string) string {
	baseURL := trimRightBar(channel.BaseURL)
	return baseURL + "/v1/messages"
}

func (a *AnthropicAdaptor) SetupRequestHeader(req *http.Request, channel *relay.ChannelContext, info *relay.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", channel.Key)
	req.Header.Set("anthropic-version", "2023-06-01")
	return nil
}

// anthropicRequest Anthropic Messages API 请求结构
type anthropicRequest struct {
	Model     string            `json:"model"`
	Messages  []anthropicMsg    `json:"messages"`
	System    string            `json:"system,omitempty"`
	MaxTokens int               `json:"max_tokens"`
	Stream    bool              `json:"stream,omitempty"`
}

type anthropicMsg struct {
	Role    string           `json:"role"`
	Content []anthropicBlock `json:"content"`
}

type anthropicBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// anthropicResponse Anthropic Messages API 响应结构
type anthropicResponse struct {
	ID      string              `json:"id"`
	Model   string              `json:"model"`
	Content []anthropicBlock    `json:"content"`
	Usage   anthropicUsage      `json:"usage"`
}

type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

func (a *AnthropicAdaptor) ConvertRequest(ctx context.Context, info *relay.RelayInfo, body []byte) ([]byte, error) {
	var openaiReq dto.ChatCompletionRequest
	if err := json.Unmarshal(body, &openaiReq); err != nil {
		return nil, fmt.Errorf("parse openai request: %w", err)
	}

	// 模型映射：优先渠道 model_mapping，其次模型 upstream_name
	modelName := openaiReq.Model
	mapping := info.Channel.GetModelMapping()
	if mapped, ok := mapping[modelName]; ok {
		modelName = mapped
	} else if info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}

	// 转换消息
	msgs := make([]anthropicMsg, 0, len(openaiReq.Messages))
	var systemPrompt string
	for _, m := range openaiReq.Messages {
		if m.Role == "system" {
			if systemPrompt == "" {
				systemPrompt = m.Content
			}
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "assistant"
		}
		msgs = append(msgs, anthropicMsg{
			Role:    role,
			Content: []anthropicBlock{{Type: "text", Text: m.Content}},
		})
	}

	maxTokens := openaiReq.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 4096
	}

	ar := anthropicRequest{
		Model:     modelName,
		Messages:  msgs,
		System:    systemPrompt,
		MaxTokens: maxTokens,
	}
	return json.Marshal(ar)
}

func (a *AnthropicAdaptor) DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	return a.client.Do(req)
}

func (a *AnthropicAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
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

	var ar anthropicResponse
	if err := json.Unmarshal(bodyBytes, &ar); err != nil {
		return nil, fmt.Errorf("parse anthropic response: %w", err)
	}

	// Anthropic → OpenAI 格式转换
	content := ""
	for _, block := range ar.Content {
		if block.Type == "text" {
			content += block.Text
		}
	}

	openaiResp := dto.ChatCompletionResponse{
		ID:    ar.ID,
		Model: ar.Model,
		Choices: []dto.ChatChoice{
			{
				Index: 0,
				Message: dto.ChatMessage{
					Role:    "assistant",
					Content: content,
				},
				FinishReason: "stop",
			},
		},
		Usage: dto.ChatCompletionUsage{
			PromptTokens:     ar.Usage.InputTokens,
			CompletionTokens: ar.Usage.OutputTokens,
			TotalTokens:      ar.Usage.InputTokens + ar.Usage.OutputTokens,
		},
	}

	respBytes, _ := json.Marshal(openaiResp)
	return &relay.RelayResponse{
		StatusCode:    http.StatusOK,
		ContentType:   "application/json",
		Body:          io.NopCloser(bytes.NewReader(respBytes)),
		Usage:         openaiResp.Usage,
		UpstreamModel: ar.Model,
	}, nil
}
