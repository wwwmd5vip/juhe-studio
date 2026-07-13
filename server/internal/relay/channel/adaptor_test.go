package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/dto"
	"github.com/juhe-management/server/internal/relay"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =========================================================================
// NewAdaptor tests — verifies correct adaptor type per channel type
// =========================================================================

func TestNewAdaptor_ReturnsCorrectType(t *testing.T) {
	tests := []struct {
		name        string
		channelType domain.ChannelType
		wantType    string // descriptive string for assertion
		wantErr     bool
	}{
		// OpenAI-compatible types
		{name: "openai", channelType: domain.ChannelTypeOpenAI, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "openai-compatible", channelType: domain.ChannelTypeOpenAICompatible, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "custom", channelType: domain.ChannelTypeCustom, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "siliconflow", channelType: domain.ChannelTypeSiliconFlow, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "volcengine", channelType: domain.ChannelTypeVolcEngine, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "zhipu", channelType: domain.ChannelTypeZhipu, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "qwen", channelType: domain.ChannelTypeQwen, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "moonshot", channelType: domain.ChannelTypeMoonshot, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "openrouter", channelType: domain.ChannelTypeOpenRouter, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "xai", channelType: domain.ChannelTypeXAI, wantType: "*channel.OpenAICompatibleAdaptor"},

		// Platform-specific types
		{name: "deepseek", channelType: domain.ChannelTypeDeepSeek, wantType: "*channel.DeepSeekAdaptor"},
		{name: "ollama", channelType: domain.ChannelTypeOllama, wantType: "*channel.OllamaAdaptor"},
		{name: "anthropic", channelType: domain.ChannelTypeAnthropic, wantType: "*channel.AnthropicAdaptor"},
		{name: "gemini", channelType: domain.ChannelTypeGemini, wantType: "*channel.GeminiAdaptor"},
		{name: "jimeng", channelType: domain.ChannelTypeJimeng, wantType: "*channel.JimengAdaptor"},

		// Fallback types (currently fall back to OpenAICompatibleAdaptor)
		{name: "azure", channelType: domain.ChannelTypeAzure, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "vertex", channelType: domain.ChannelTypeVertex, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "bedrock", channelType: domain.ChannelTypeBedrock, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "coze", channelType: domain.ChannelTypeCoze, wantType: "*channel.OpenAICompatibleAdaptor"},
		{name: "kling", channelType: domain.ChannelTypeKling, wantType: "*channel.KlingAdaptor"},

		// Unsupported type
		{name: "unsupported", channelType: domain.ChannelType("unknown-type"), wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor, err := NewAdaptor(tc.channelType, 30)
			if tc.wantErr {
				require.Error(t, err)
				assert.Nil(t, adaptor)
				assert.Contains(t, err.Error(), "unsupported channel type")
			} else {
				require.NoError(t, err)
				require.NotNil(t, adaptor)
				gotType := typeName(adaptor)
				assert.Equal(t, tc.wantType, gotType,
					"channel type %s returned %s, want %s", tc.channelType, gotType, tc.wantType)
			}
		})
	}
}

func TestNewAdaptorDefault(t *testing.T) {
	// Uses default 120s timeout
	adaptor, err := NewAdaptorDefault(domain.ChannelTypeOpenAI)
	require.NoError(t, err)
	require.NotNil(t, adaptor)
	assert.Equal(t, "*channel.OpenAICompatibleAdaptor", typeName(adaptor))
}

// =========================================================================
// GetRequestURL tests — verifies each adaptor builds correct request URL
// =========================================================================

func TestGetRequestURL_OpenAICompatible(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		path     string
		expected string
	}{
		{
			name:     "standard path",
			baseURL:  "https://api.openai.com/v1",
			path:     "/chat/completions",
			expected: "https://api.openai.com/v1/chat/completions",
		},
		{
			name:     "path without leading slash",
			baseURL:  "https://api.openai.com/v1",
			path:     "chat/completions",
			expected: "https://api.openai.com/v1/chat/completions",
		},
		{
			name:     "empty path returns base URL",
			baseURL:  "https://api.openai.com/v1",
			path:     "",
			expected: "https://api.openai.com/v1",
		},
		{
			name:     "base URL with trailing slash",
			baseURL:  "https://api.openai.com/v1/",
			path:     "/chat/completions",
			expected: "https://api.openai.com/v1/chat/completions",
		},
		{
			name:     "custom base URL",
			baseURL:  "https://custom-proxy.example.com/api",
			path:     "/v1/chat/completions",
			expected: "https://custom-proxy.example.com/api/v1/chat/completions",
		},
		{
			name:     "empty base URL falls back to default",
			baseURL:  "",
			path:     "/chat/completions",
			expected: "https://api.openai.com/v1/chat/completions",
		},
		{
			name:     "images generations path",
			baseURL:  "https://api.openai.com/v1",
			path:     "/images/generations",
			expected: "https://api.openai.com/v1/images/generations",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor := NewOpenAICompatibleAdaptor(30)
			ctx := &relay.ChannelContext{BaseURL: tc.baseURL}
			url := adaptor.GetRequestURL(ctx, tc.path)
			assert.Equal(t, tc.expected, url)
		})
	}
}

func TestGetRequestURL_Anthropic(t *testing.T) {
	adaptor := NewAnthropicAdaptor(30)
	ctx := &relay.ChannelContext{BaseURL: "https://api.anthropic.com"}
	url := adaptor.GetRequestURL(ctx, "")
	assert.Equal(t, "https://api.anthropic.com/v1/messages", url)
}

func TestGetRequestURL_Anthropic_WithTrailingSlash(t *testing.T) {
	adaptor := NewAnthropicAdaptor(30)
	ctx := &relay.ChannelContext{BaseURL: "https://api.anthropic.com/"}
	url := adaptor.GetRequestURL(ctx, "")
	assert.Equal(t, "https://api.anthropic.com/v1/messages", url)
}

func TestGetRequestURL_Jimeng(t *testing.T) {
	adaptor := NewJimengAdaptor(30)
	ctx := &relay.ChannelContext{BaseURL: "https://visual.volcengineapi.com"}
	url := adaptor.GetRequestURL(ctx, "")
	assert.Equal(t, "https://visual.volcengineapi.com/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31", url)
}

func TestGetRequestURL_Gemini(t *testing.T) {
	adaptor := NewGeminiAdaptor(30)
	ctx := &relay.ChannelContext{
		BaseURL: "https://generativelanguage.googleapis.com",
		Channel: &relay.ChannelInfo{
			ModelMap: map[string]string{"gemini-pro": "gemini-1.5-pro"},
		},
	}
	url := adaptor.GetRequestURL(ctx, "gemini-pro")
	// Key is empty in test — model name comes from map
	assert.Contains(t, url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent")
}

func TestGetRequestURL_Gemini_NoModelMap(t *testing.T) {
	adaptor := NewGeminiAdaptor(30)
	ctx := &relay.ChannelContext{
		BaseURL: "https://generativelanguage.googleapis.com",
		Channel: &relay.ChannelInfo{},
	}
	url := adaptor.GetRequestURL(ctx, "gemini-pro")
	assert.Contains(t, url, "/v1beta/models/gemini-pro:generateContent")
}

// =========================================================================
// SetupRequestHeader tests — verifies auth headers are set correctly
// =========================================================================

func TestSetupRequestHeader_OpenAI(t *testing.T) {
	adaptor := NewOpenAICompatibleAdaptor(30)
	ctx := &relay.ChannelContext{Key: "sk-test-key-123"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Bearer sk-test-key-123", req.Header.Get("Authorization"))
}

func TestSetupRequestHeader_DeepSeek(t *testing.T) {
	adaptor := NewDeepSeekAdaptor(30)
	ctx := &relay.ChannelContext{Key: "sk-deepseek-key"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Bearer sk-deepseek-key", req.Header.Get("Authorization"))
}

func TestSetupRequestHeader_Anthropic(t *testing.T) {
	adaptor := NewAnthropicAdaptor(30)
	ctx := &relay.ChannelContext{Key: "sk-ant-key-123"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "sk-ant-key-123", req.Header.Get("x-api-key"))
	assert.Equal(t, "2023-06-01", req.Header.Get("anthropic-version"))
	// No Authorization header for Anthropic
	assert.Empty(t, req.Header.Get("Authorization"))
}

func TestSetupRequestHeader_Gemini(t *testing.T) {
	adaptor := NewGeminiAdaptor(30)
	ctx := &relay.ChannelContext{Key: "gemini-api-key"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/v1beta/models/gemini-pro:generateContent", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	// Gemini does not set Authorization header (key goes in URL)
	assert.Empty(t, req.Header.Get("Authorization"))
}

func TestSetupRequestHeader_Jimeng(t *testing.T) {
	adaptor := NewJimengAdaptor(30)
	ctx := &relay.ChannelContext{Key: "jimeng-api-key"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/api/external/v1/images/generations", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Bearer jimeng-api-key", req.Header.Get("Authorization"))
}

func TestSetupRequestHeader_Ollama(t *testing.T) {
	adaptor := NewOllamaAdaptor(30)
	ctx := &relay.ChannelContext{Key: "ollama-key"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Bearer ollama-key", req.Header.Get("Authorization"))
}

// =========================================================================
// SetupRequestHeader — table-driven tests for all adaptor types
// =========================================================================

func TestSetupRequestHeader_AllAdaptors(t *testing.T) {
	tests := []struct {
		name          string
		channelType   domain.ChannelType
		key           string
		checkAuth     bool
		expectedAuth  string // full expected Authorization header value
		checkXAPIKey  bool
		expectedXKey  string
		checkAnthVer  bool
		expectedAnth  string
		wantErr       bool
	}{
		{
			name:         "openai sets Bearer auth",
			channelType:  domain.ChannelTypeOpenAI,
			key:          "sk-key",
			checkAuth:    true,
			expectedAuth: "Bearer sk-key",
		},
		{
			name:         "deepseek sets Bearer auth",
			channelType:  domain.ChannelTypeDeepSeek,
			key:          "sk-ds-key",
			checkAuth:    true,
			expectedAuth: "Bearer sk-ds-key",
		},
		{
			name:         "anthropic sets x-api-key",
			channelType:  domain.ChannelTypeAnthropic,
			key:          "sk-ant-key",
			checkXAPIKey: true,
			expectedXKey: "sk-ant-key",
			checkAnthVer: true,
			expectedAnth: "2023-06-01",
		},
		{
			name:         "gemini sets no auth header",
			channelType:  domain.ChannelTypeGemini,
			key:          "gemini-key",
		},
		{
			name:         "jimeng sets Bearer auth",
			channelType:  domain.ChannelTypeJimeng,
			key:          "jimeng-key",
			checkAuth:    true,
			expectedAuth: "Bearer jimeng-key",
		},
		{
			name:         "ollama sets Bearer auth",
			channelType:  domain.ChannelTypeOllama,
			key:          "ollama-key",
			checkAuth:    true,
			expectedAuth: "Bearer ollama-key",
		},
		{
			name:         "siliconflow sets Bearer auth",
			channelType:  domain.ChannelTypeSiliconFlow,
			key:          "sf-key",
			checkAuth:    true,
			expectedAuth: "Bearer sf-key",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor, err := NewAdaptor(tc.channelType, 30)
			require.NoError(t, err)

			ctx := &relay.ChannelContext{Key: tc.key}
			info := &relay.RelayInfo{}

			req := httptest.NewRequest(http.MethodPost, "/test", nil)
			err = adaptor.SetupRequestHeader(req, ctx, info)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Content-Type is always set
			assert.Equal(t, "application/json", req.Header.Get("Content-Type"))

			if tc.checkAuth {
				assert.Equal(t, tc.expectedAuth, req.Header.Get("Authorization"))
			}
			if tc.checkXAPIKey {
				assert.Equal(t, tc.expectedXKey, req.Header.Get("x-api-key"))
			}
			if tc.checkAnthVer {
				assert.Equal(t, tc.expectedAnth, req.Header.Get("anthropic-version"))
			}
		})
	}
}

// =========================================================================
// BaseAdaptor tests
// =========================================================================

func TestNewBaseAdaptor_ValidTimeout(t *testing.T) {
	base := NewBaseAdaptor(30)
	require.NotNil(t, base.Client())
	assert.Equal(t, 30*time.Second, base.Client().Timeout)
}

func TestNewBaseAdaptor_ZeroTimeoutDefaults(t *testing.T) {
	base := NewBaseAdaptor(0)
	require.NotNil(t, base.Client())
	assert.Equal(t, 60*time.Second, base.Client().Timeout)
}

func TestNewBaseAdaptor_NegativeTimeoutDefaults(t *testing.T) {
	base := NewBaseAdaptor(-5)
	require.NotNil(t, base.Client())
	assert.Equal(t, 60*time.Second, base.Client().Timeout)
}

// =========================================================================
// Helper: typeName returns a descriptive string for an adaptor pointer
// =========================================================================

func typeName(a relay.Adaptor) string {
	switch a.(type) {
	case *OpenAICompatibleAdaptor:
		return "*channel.OpenAICompatibleAdaptor"
	case *DeepSeekAdaptor:
		return "*channel.DeepSeekAdaptor"
	case *OllamaAdaptor:
		return "*channel.OllamaAdaptor"
	case *AnthropicAdaptor:
		return "*channel.AnthropicAdaptor"
	case *GeminiAdaptor:
		return "*channel.GeminiAdaptor"
	case *JimengAdaptor:
		return "*channel.JimengAdaptor"
	case *MXAPIAdaptor:
		return "*channel.MXAPIAdaptor"
	case *KlingAdaptor:
		return "*channel.KlingAdaptor"
	default:
		return "unknown"
	}
}

// =========================================================================
// GetRequestURL — table-driven for all adaptor types
// =========================================================================

func TestGetRequestURL_AllAdaptors(t *testing.T) {
	tests := []struct {
		name        string
		channelType domain.ChannelType
		baseURL     string
		path        string
		contain     string // substring that the result must contain
	}{
		{
			name:        "openai",
			channelType: domain.ChannelTypeOpenAI,
			baseURL:     "https://api.openai.com/v1",
			path:        "/chat/completions",
			contain:     "https://api.openai.com/v1/chat/completions",
		},
		{
			name:        "anthropic",
			channelType: domain.ChannelTypeAnthropic,
			baseURL:     "https://api.anthropic.com",
			path:        "",
			contain:     "https://api.anthropic.com/v1/messages",
		},
		{
			name:        "jimeng",
			channelType: domain.ChannelTypeJimeng,
			baseURL:     "https://visual.volcengineapi.com",
			path:        "",
			contain:     "https://visual.volcengineapi.com/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31",
		},
		{
			name:        "kling",
			channelType: domain.ChannelTypeKling,
			baseURL:     "https://dashscope.aliyuncs.com",
			path:        "",
			contain:     "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation",
		},
		{
			name:        "gemini",
			channelType: domain.ChannelTypeGemini,
			baseURL:     "https://generativelanguage.googleapis.com",
			path:        "gemini-pro",
			contain:     "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
		},
		{
			name:        "mxapi",
			channelType: domain.ChannelTypeMXAPI,
			baseURL:     "https://open.mxapi.org",
			path:        "",
			contain:     "https://open.mxapi.org/api/v2/nano",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor, err := NewAdaptor(tc.channelType, 30)
			require.NoError(t, err)

			ctx := &relay.ChannelContext{
				BaseURL: tc.baseURL,
				Channel: &relay.ChannelInfo{},
			}
			url := adaptor.GetRequestURL(ctx, tc.path)
			assert.Contains(t, url, tc.contain)
		})
	}
}

// =========================================================================
// Edge case: NewAdaptor with different timeout values
// =========================================================================

func TestNewAdaptor_DifferentTimeouts(t *testing.T) {
	tests := []struct {
		name     string
		timeout  int
		expected int
	}{
		{name: "30 seconds", timeout: 30, expected: 30},
		{name: "120 seconds", timeout: 120, expected: 120},
		{name: "300 seconds", timeout: 300, expected: 300},
		{name: "zero defaults to 60", timeout: 0, expected: 60},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor, err := NewAdaptor(domain.ChannelTypeOpenAI, tc.timeout)
			require.NoError(t, err)
			require.NotNil(t, adaptor)

			// Get the underlying BaseAdaptor's client timeout
			switch a := adaptor.(type) {
			case *OpenAICompatibleAdaptor:
				assert.Equal(t, time.Duration(tc.expected)*time.Second, a.Client().Timeout)
			default:
				t.Fatalf("unexpected adaptor type: %T", adaptor)
			}
		})
	}
}

// =========================================================================
// ConvertRequest tests
// =========================================================================

func TestOpenAIAdaptor_ConvertRequest_NoMapping(t *testing.T) {
	adaptor := NewOpenAICompatibleAdaptor(30)
	info := &relay.RelayInfo{
		Channel: &domain.Channel{ModelMapping: nil},
	}

	body := []byte(`{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)
	// Body should be unchanged (JSON keys may be reordered by json.Marshal)
	assert.Contains(t, string(result), `"model":"gpt-4"`)
}

func TestOpenAIAdaptor_ConvertRequest_WithMapping(t *testing.T) {
	modelMapping := `{"gpt-4":"o1-preview"}`
	adaptor := NewOpenAICompatibleAdaptor(30)
	info := &relay.RelayInfo{
		Channel: &domain.Channel{ModelMapping: &modelMapping},
	}

	body := []byte(`{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)
	assert.Contains(t, string(result), `"model":"o1-preview"`)
	assert.NotContains(t, string(result), `"model":"gpt-4"`)
}

func TestOpenAIAdaptor_ConvertRequest_NoModelField(t *testing.T) {
	modelMapping := `{"gpt-4":"o1-preview"}`
	adaptor := NewOpenAICompatibleAdaptor(30)
	info := &relay.RelayInfo{
		Channel: &domain.Channel{ModelMapping: &modelMapping},
	}

	body := []byte(`{"messages":[{"role":"user","content":"hello"}]}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)
	// Model field not present, body should pass through
	assert.Contains(t, string(result), `"messages"`)
}

func TestJimengAdaptor_ConvertRequest(t *testing.T) {
	adaptor := NewJimengAdaptor(30)
	modelMapping := `{"jimeng-v40":"jimeng_t2i_v40"}`
	info := &relay.RelayInfo{
		Channel: &domain.Channel{ModelMapping: &modelMapping},
	}

	body := []byte(`{"model":"jimeng-v40","prompt":"a cat","n":2,"size":"1024x1024"}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)
	assert.Contains(t, string(result), `"req_key":"jimeng_t2i_v40"`)
	assert.Contains(t, string(result), `"prompt":"a cat"`)
	assert.Contains(t, string(result), `"n":2`)
	assert.Contains(t, string(result), `"width":1024`)
	assert.Contains(t, string(result), `"height":1024`)
	assert.Contains(t, string(result), `"size":1048576`)
}

func TestJimengAdaptor_ConvertRequest_NoMapping(t *testing.T) {
	adaptor := NewJimengAdaptor(30)
	info := &relay.RelayInfo{}

	body := []byte(`{"model":"jimeng-unknown","prompt":"a cat","n":2}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)
	// 无 model mapping 时使用默认 req_key
	assert.Contains(t, string(result), `"req_key":"jimeng_t2i_v40"`)
}

func TestJimengAdaptor_ConvertRequest_DefaultsN(t *testing.T) {
	adaptor := NewJimengAdaptor(30)
	modelMapping := `{"jimeng-v40":"jimeng_t2i_v40"}`
	info := &relay.RelayInfo{
		Channel: &domain.Channel{ModelMapping: &modelMapping},
	}

	body := []byte(`{"model":"jimeng-v40","prompt":"a dog"}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)
	assert.Contains(t, string(result), `"n":1`)
	assert.Contains(t, string(result), `"width":2048`)
	assert.Contains(t, string(result), `"height":2048`)
	assert.Contains(t, string(result), `"size":4194304`)
}

func TestJimengAdaptor_ConvertRequest_SizeParsing(t *testing.T) {
	tests := []struct {
		name          string
		size          string
		expectWidth   int
		expectHeight  int
		expectSize    int
	}{
		{"1024x1024", "1024x1024", 1024, 1024, 1048576},
		{"2048x2048", "2048x2048", 2048, 2048, 4194304},
		{"1792x1024", "1792x1024", 1792, 1024, 1835008},
		{"1024x1792", "1024x1792", 1024, 1792, 1835008},
		{"2560x1440", "2560x1440", 2560, 1440, 3686400},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor := NewJimengAdaptor(30)
			modelMapping := `{"jimeng-v40":"jimeng_t2i_v40"}`
			info := &relay.RelayInfo{
				Channel: &domain.Channel{ModelMapping: &modelMapping},
			}

			body := fmt.Sprintf(`{"model":"jimeng-v40","prompt":"test","size":"%s"}`, tc.size)
			result, err := adaptor.ConvertRequest(context.Background(), info, []byte(body))
			require.NoError(t, err)
			assert.Contains(t, string(result), fmt.Sprintf(`"width":%d`, tc.expectWidth))
			assert.Contains(t, string(result), fmt.Sprintf(`"height":%d`, tc.expectHeight))
			assert.Contains(t, string(result), fmt.Sprintf(`"size":%d`, tc.expectSize))
		})
	}
}

func TestJimengAdaptor_ParseResponse(t *testing.T) {
	// 模拟即梦异步提交+查询流程
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// 判断是提交还是查询请求
		query := r.URL.Query()
		action := query.Get("Action")

		switch action {
		case "CVSync2AsyncSubmitTask":
			// 返回 task_id
			json.NewEncoder(w).Encode(jimengSubmitResponse{
				Code:    10000,
				Message: "Success",
				Data:    &jimengTaskData{TaskID: "test-task-12345"},
			})
		case "CVSync2AsyncGetResult":
			// 返回完成结果
			json.NewEncoder(w).Encode(jimengQueryResponse{
				Code:    10000,
				Message: "Success",
				Data: &jimengQueryData{
					Status:    "done",
					ImageURLs: []string{"https://example.com/img1.png", "https://example.com/img2.png"},
				},
			})
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
	defer server.Close()

	adaptor := NewJimengAdaptor(30)
	adaptor.reqKey = "jimeng_t2i_v40"
	adaptor.apiKey = "test-key"

	// 提交请求
	bodyBytes, _ := json.Marshal(jimengSubmitRequest{
		ReqKey: "jimeng_t2i_v40",
		Prompt: "a cat",
		N:      2,
		Width:  1024,
		Height: 1024,
		Size:   1048576,
	})
	submitReq, _ := http.NewRequest(http.MethodPost,
		server.URL+"?Action=CVSync2AsyncSubmitTask&Version=2022-08-31",
		bytes.NewReader(bodyBytes))
	submitReq.Header.Set("Content-Type", "application/json")
	submitReq.Header.Set("Authorization", "Bearer test-key")
	submitReq.ContentLength = int64(len(bodyBytes))

	httpResp, err := adaptor.DoRequest(context.Background(), submitReq)
	require.NoError(t, err)

	info := &relay.RelayInfo{
		Channel: &domain.Channel{},
	}

	// 需要设置 BaseURL 以便 pollTask 使用 mock server 地址
	baseURL := server.URL
	info.Channel.BaseURL = &baseURL

	// ParseResponse (包含轮询)
	relayResp, err := adaptor.ParseResponse(context.Background(), info, httpResp)
	require.NoError(t, err)
	require.NotNil(t, relayResp)

	respBytes, err := io.ReadAll(relayResp.Body)
	relayResp.Body.Close()
	require.NoError(t, err)

	var openaiResp dto.ImageGenerationResponse
	err = json.Unmarshal(respBytes, &openaiResp)
	require.NoError(t, err)
	assert.Equal(t, 2, len(openaiResp.Data))
	assert.Equal(t, "https://example.com/img1.png", openaiResp.Data[0].URL)
	assert.Equal(t, "https://example.com/img2.png", openaiResp.Data[1].URL)
}

func TestJimengAdaptor_ParseResponse_SubmitError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(jimengSubmitResponse{
			Code:    50413,
			Message: "Post Text Risk Not Pass",
		})
	}))
	defer server.Close()

	adaptor := NewJimengAdaptor(30)
	adaptor.reqKey = "jimeng_t2i_v40"
	adaptor.apiKey = "test-key"

	bodyBytes, _ := json.Marshal(jimengSubmitRequest{
		ReqKey: "jimeng_t2i_v40",
		Prompt: "sensitive content",
		N:      1,
	})
	req, _ := http.NewRequest(http.MethodPost,
		server.URL+"?Action=CVSync2AsyncSubmitTask&Version=2022-08-31",
		bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-key")
	req.ContentLength = int64(len(bodyBytes))

	httpResp, err := adaptor.DoRequest(context.Background(), req)
	require.NoError(t, err)

	info := &relay.RelayInfo{Channel: &domain.Channel{}}
	_, err = adaptor.ParseResponse(context.Background(), info, httpResp)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Post Text Risk Not Pass")
}

// =========================================================================
// Kling Adaptor tests
// =========================================================================

func TestKlingAdaptor_GetRequestURL(t *testing.T) {
	adaptor := NewKlingAdaptor(30)
	ctx := &relay.ChannelContext{BaseURL: "https://dashscope.aliyuncs.com"}
	url := adaptor.GetRequestURL(ctx, "")
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation", url)
}

func TestKlingAdaptor_SetupRequestHeader(t *testing.T) {
	adaptor := NewKlingAdaptor(30)
	ctx := &relay.ChannelContext{Key: "kling-api-key"}
	info := &relay.RelayInfo{}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/services/aigc/image-generation/generation", nil)
	err := adaptor.SetupRequestHeader(req, ctx, info)
	require.NoError(t, err)

	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Bearer kling-api-key", req.Header.Get("Authorization"))
	assert.Equal(t, "enable", req.Header.Get("X-DashScope-Async"))
}

func TestKlingAdaptor_ConvertRequest(t *testing.T) {
	adaptor := NewKlingAdaptor(30)
	modelMapping := `{"kling":"kling/kling-v3-image-generation"}`
	info := &relay.RelayInfo{
		Channel: &domain.Channel{ModelMapping: &modelMapping},
	}

	body := []byte(`{"model":"kling","prompt":"a beautiful flower shop","n":2,"size":"1024x1024"}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)

	assert.Contains(t, string(result), `"model":"kling/kling-v3-image-generation"`)
	assert.Contains(t, string(result), `"text":"a beautiful flower shop"`)
	assert.Contains(t, string(result), `"n":2`)
	assert.Contains(t, string(result), `"aspect_ratio":"1:1"`)
	assert.Contains(t, string(result), `"resolution":"1k"`)
}

func TestKlingAdaptor_ConvertRequest_Defaults(t *testing.T) {
	adaptor := NewKlingAdaptor(30)
	info := &relay.RelayInfo{}

	// 无 model mapping 时使用默认模型
	body := []byte(`{"model":"unknown","prompt":"a dog"}`)
	result, err := adaptor.ConvertRequest(context.Background(), info, body)
	require.NoError(t, err)

	assert.Contains(t, string(result), `"model":"kling/kling-v3-image-generation"`)
	assert.Contains(t, string(result), `"n":1`)
	assert.Contains(t, string(result), `"resolution":"1k"`)
}

func TestKlingAdaptor_ConvertRequest_AspectRatio(t *testing.T) {
	tests := []struct {
		name     string
		size     string
		expected string
	}{
		{"16:9", "1792x1024", "16:9"},
		{"9:16", "1024x1792", "9:16"},
		{"1:1", "1024x1024", "1:1"},
		{"1:1 default", "512x512", "1:1"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			adaptor := NewKlingAdaptor(30)
			modelMapping := `{"kling":"kling/kling-v3-image-generation"}`
			info := &relay.RelayInfo{
				Channel: &domain.Channel{ModelMapping: &modelMapping},
			}

			body := []byte(fmt.Sprintf(`{"model":"kling","prompt":"test","size":"%s"}`, tc.size))
			result, err := adaptor.ConvertRequest(context.Background(), info, body)
			require.NoError(t, err)
			assert.Contains(t, string(result), fmt.Sprintf(`"aspect_ratio":"%s"`, tc.expected))
		})
	}
}

func TestKlingAdaptor_ParseResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if strings.Contains(r.URL.Path, "/tasks/") {
			// 查询任务结果
			json.NewEncoder(w).Encode(klingQueryResponse{
				Output: &klingTaskResult{
					TaskID:     "test-kling-task",
					TaskStatus: "SUCCEEDED",
					Choices: []klingChoice{
						{
							FinishReason: "stop",
							Message: klingMessage{
								Role: "assistant",
								Content: []klingContent{
									{Image: "https://cdn.klingai.com/img1.png", Text: ""},
									{Image: "https://cdn.klingai.com/img2.png", Text: ""},
								},
							},
						},
					},
				},
			})
		} else {
			// 提交任务
			json.NewEncoder(w).Encode(klingSubmitResponse{
				Output: &klingTaskOutput{
					TaskID:     "test-kling-task",
					TaskStatus: "PENDING",
				},
			})
		}
	}))
	defer server.Close()

	adaptor := NewKlingAdaptor(30)
	adaptor.model = "kling/kling-v3-image-generation"
	adaptor.apiKey = "test-kling-key"

	// 提交请求
	bodyBytes, _ := json.Marshal(klingSubmitRequest{
		Model: "kling/kling-v3-image-generation",
		Input: klingInput{
			Messages: []klingMessage{
				{Role: "user", Content: []klingContent{{Text: "a flower shop"}}},
			},
		},
		Parameters: &klingParameters{N: 2, AspectRatio: "1:1", Resolution: "1k"},
	})
	submitReq, _ := http.NewRequest(http.MethodPost,
		server.URL+"/api/v1/services/aigc/image-generation/generation",
		bytes.NewReader(bodyBytes))
	submitReq.Header.Set("Content-Type", "application/json")
	submitReq.Header.Set("Authorization", "Bearer test-kling-key")
	submitReq.Header.Set("X-DashScope-Async", "enable")
	submitReq.ContentLength = int64(len(bodyBytes))

	httpResp, err := adaptor.DoRequest(context.Background(), submitReq)
	require.NoError(t, err)

	baseURL := server.URL
	info := &relay.RelayInfo{
		Channel: &domain.Channel{BaseURL: &baseURL},
	}

	relayResp, err := adaptor.ParseResponse(context.Background(), info, httpResp)
	require.NoError(t, err)
	require.NotNil(t, relayResp)

	respBytes, err := io.ReadAll(relayResp.Body)
	relayResp.Body.Close()
	require.NoError(t, err)

	var openaiResp dto.ImageGenerationResponse
	err = json.Unmarshal(respBytes, &openaiResp)
	require.NoError(t, err)
	assert.Equal(t, 2, len(openaiResp.Data))
	assert.Equal(t, "https://cdn.klingai.com/img1.png", openaiResp.Data[0].URL)
	assert.Equal(t, "https://cdn.klingai.com/img2.png", openaiResp.Data[1].URL)
}

func TestKlingAdaptor_ParseResponse_SubmitError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(klingSubmitResponse{
			Code:    "InvalidApiKey",
			Message: "No API-key provided.",
		})
	}))
	defer server.Close()

	adaptor := NewKlingAdaptor(30)
	adaptor.model = "kling/kling-v3-image-generation"
	adaptor.apiKey = ""

	bodyBytes, _ := json.Marshal(klingSubmitRequest{
		Model: "kling/kling-v3-image-generation",
		Input: klingInput{
			Messages: []klingMessage{
				{Role: "user", Content: []klingContent{{Text: "test"}}},
			},
		},
	})
	req, _ := http.NewRequest(http.MethodPost,
		server.URL+"/api/v1/services/aigc/image-generation/generation",
		bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")

	httpResp, err := adaptor.DoRequest(context.Background(), req)
	require.NoError(t, err)

	info := &relay.RelayInfo{Channel: &domain.Channel{}}
	_, err = adaptor.ParseResponse(context.Background(), info, httpResp)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "InvalidApiKey")
}
