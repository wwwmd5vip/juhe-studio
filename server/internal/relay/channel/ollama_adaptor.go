package channel

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"github.com/juhe-management/server/internal/relay"
)

// OllamaAdaptor 本地 Ollama 适配器（OpenAI 兼容 + 模型列表 API）
type OllamaAdaptor struct {
	*OpenAICompatibleAdaptor
}

func NewOllamaAdaptor(timeoutSec int) *OllamaAdaptor {
	return &OllamaAdaptor{
		OpenAICompatibleAdaptor: NewOpenAICompatibleAdaptor(timeoutSec),
	}
}

// Ollama 额外支持 /api/tags 和 /api/show 端点

type ollamaTagsResponse struct {
	Models []ollamaModel `json:"models"`
}

type ollamaModel struct {
	Name       string `json:"name"`
	ModifiedAt string `json:"modified_at"`
	Size       int64  `json:"size"`
}

// FetchModels 从 Ollama 获取已安装模型列表（/api/tags）
func (a *OllamaAdaptor) FetchModels(ctx context.Context, baseURL, key string) ([]ollamaModel, error) {
	baseURL = trimRightBar(baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/tags", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, MaxUpstreamResponseSize))
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama api returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var tagsResp ollamaTagsResponse
	if err := json.Unmarshal(bodyBytes, &tagsResp); err != nil {
		return nil, fmt.Errorf("parse ollama tags response: %w", err)
	}

	return tagsResp.Models, nil
}

func (a *OllamaAdaptor) ParseResponse(ctx context.Context, info *relay.RelayInfo, resp *http.Response) (*relay.RelayResponse, error) {
	return a.OpenAICompatibleAdaptor.ParseResponse(ctx, info, resp)
}

// 确保实现 Adaptor 接口
var _ relay.Adaptor = (*OllamaAdaptor)(nil)
