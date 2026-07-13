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

// GeminiAdaptor Google Gemini generateContent → OpenAI Chat Completions 协议转换
type GeminiAdaptor struct {
	BaseAdaptor
}

func NewGeminiAdaptor(timeoutSec int) *GeminiAdaptor {
	return &GeminiAdaptor{
		BaseAdaptor: NewBaseAdaptor(timeoutSec),
	}
}

func (a *GeminiAdaptor) GetRequestURL(channel *relay.ChannelContext, path string) string {
	baseURL := trimRightBar(channel.BaseURL)
	// Prefer ModelName (set during relay), fall back to path for backwards compatibility
	modelKey := channel.ModelName
	if modelKey == "" {
		modelKey = path
	}
	modelName := channel.ModelMap[modelKey]
	if modelName == "" && channel.Channel != nil {
		modelName = channel.Channel.ModelMap[modelKey]
	}
	if modelName == "" {
		modelName = modelKey
	}
	if modelName == "" {
		modelName = "gemini-pro"
	}
	return fmt.Sprintf("%s/v1beta/models/%s:generateContent", baseURL, modelName)
}

func (a *GeminiAdaptor) SetupRequestHeader(req *http.Request, channel *relay.ChannelContext, info *relay.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	// Use x-goog-api-key header instead of URL query parameter to prevent
	// API key leakage through proxy/load-balancer access logs.
	req.Header.Set("x-goog-api-key", channel.Key)
	return nil
}

// geminiRequest Gemini generateContent 请求结构
type geminiRequest struct {
	Contents         []geminiContent   `json:"contents"`
	SystemInstruction *geminiContent    `json:"system_instruction,omitempty"`
	GenerationConfig *geminiGenConfig  `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Role  string        `json:"role,omitempty"`
	Parts []geminiPart  `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text,omitempty"`
}

type geminiGenConfig struct {
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
	Temperature     float64 `json:"temperature,omitempty"`
	TopP            float64 `json:"topP,omitempty"`
}

// geminiResponse Gemini generateContent 响应结构
type geminiResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
	UsageMetadata *geminiUsage   `json:"usageMetadata,omitempty"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}

type geminiUsage struct {
	PromptTokenCount     int `json:"promptTokenCount"`
	CandidatesTokenCount int `json:"candidatesTokenCount"`
	TotalTokenCount      int `json:"totalTokenCount"`
}

func (a *GeminiAdaptor) ConvertRequest(ctx context.Context, info *relay.RelayInfo, body []byte) ([]byte, error) {
	var openaiReq dto.ChatCompletionRequest
	if err := json.Unmarshal(body, &openaiReq); err != nil {
		return nil, fmt.Errorf("parse openai request: %w", err)
	}

	contents := make([]geminiContent, 0, len(openaiReq.Messages))
	var systemInstruction *geminiContent

	for _, m := range openaiReq.Messages {
		if m.Role == "system" {
			systemInstruction = &geminiContent{
				Parts: []geminiPart{{Text: m.Content}},
			}
			continue
		}
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, geminiContent{
			Role:  role,
			Parts: []geminiPart{{Text: m.Content}},
		})
	}

	gr := geminiRequest{
		Contents:         contents,
		SystemInstruction: systemInstruction,
	}
	if openaiReq.MaxTokens > 0 {
		gr.GenerationConfig = &geminiGenConfig{
			MaxOutputTokens: openaiReq.MaxTokens,
			Temperature:     openaiReq.Temperature,
			TopP:            openaiReq.TopP,
		}
	}

	return json.Marshal(gr)
}

func (a *GeminiAdaptor) DoRequest(ctx context.Context, req *http.Request) (*http.Response, error) {
	return a.client.Do(req)
}

func (a *GeminiAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
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

	var gr geminiResponse
	if err := json.Unmarshal(bodyBytes, &gr); err != nil {
		return nil, fmt.Errorf("parse gemini response: %w", err)
	}

	// Gemini → OpenAI 格式转换
	content := ""
	if len(gr.Candidates) > 0 {
		for _, part := range gr.Candidates[0].Content.Parts {
			content += part.Text
		}
	}

	usage := dto.ChatCompletionUsage{}
	if gr.UsageMetadata != nil {
		usage = dto.ChatCompletionUsage{
			PromptTokens:     gr.UsageMetadata.PromptTokenCount,
			CompletionTokens: gr.UsageMetadata.CandidatesTokenCount,
			TotalTokens:      gr.UsageMetadata.TotalTokenCount,
		}
	}

	openaiResp := dto.ChatCompletionResponse{
		Model: info.ModelName,
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
		Usage: usage,
	}

	respBytes, _ := json.Marshal(openaiResp)
	return &relay.RelayResponse{
		StatusCode:    http.StatusOK,
		ContentType:   "application/json",
		Body:          io.NopCloser(bytes.NewReader(respBytes)),
		Usage:         usage,
		UpstreamModel: info.ModelName,
	}, nil
}
