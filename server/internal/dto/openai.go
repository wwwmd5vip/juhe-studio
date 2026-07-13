package dto

// Chat Completions

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionRequest struct {
	Model       string        `json:"model" binding:"required"`
	Messages    []ChatMessage `json:"messages" binding:"required"`
	Stream      bool          `json:"stream"`
	Temperature float64       `json:"temperature" binding:"min=0,max=2"`
	MaxTokens   int           `json:"max_tokens" binding:"min=1,max=100"`
	TopP        float64       `json:"top_p" binding:"min=0,max=1"`
}

type ChatCompletionResponse struct {
	ID      string              `json:"id"`
	Object  string              `json:"object"`
	Created int64               `json:"created"`
	Model   string              `json:"model"`
	Choices []ChatChoice        `json:"choices"`
	Usage   ChatCompletionUsage `json:"usage"`
}

type ChatChoice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

type ChatCompletionUsage struct {
	PromptTokens         int                   `json:"prompt_tokens"`
	CompletionTokens     int                   `json:"completion_tokens"`
	TotalTokens          int                   `json:"total_tokens"`
	PromptTokensDetails  *PromptTokensDetails  `json:"prompt_tokens_details,omitempty"`
}

type PromptTokensDetails struct {
	CachedTokens int `json:"cached_tokens"`
}

// Images

type ImageGenerationRequest struct {
	Model          string `json:"model" binding:"required"`
	Prompt         string `json:"prompt" binding:"required"`
	N              int    `json:"n"`
	Size           string `json:"size"`
	AspectRatio    string `json:"aspect_ratio"`
	ResponseFormat string `json:"response_format"`
	Quality        string `json:"quality"`
	Style          string   `json:"style"`
	Images         []string `json:"images"`
	ReferenceMode  string   `json:"reference_mode"`
}

type ImageGenerationResponse struct {
	Created int64      `json:"created"`
	Data    []ImageURL `json:"data"`
}

type ImageURL struct {
	URL          string `json:"url,omitempty"`
	B64JSON      string `json:"b64_json,omitempty"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
}

// Models

type OpenAIModel struct {
	ID           string   `json:"id"`
	Object       string   `json:"object"`
	Created      int64    `json:"created"`
	OwnedBy      string   `json:"owned_by"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type OpenAIModelList struct {
	Object string        `json:"object"`
	Data   []OpenAIModel `json:"data"`
}

// VolcengineModel 火山引擎方舟模型列表中的单个模型条目（扩展字段）
type VolcengineModel struct {
	ID           string                     `json:"id"`
	Name         string                     `json:"name"`
	Object       string                     `json:"object"`
	Created      int64                      `json:"created"`
	Domain       string                     `json:"domain"`
	Status       string                     `json:"status"`
	Version      string                     `json:"version"`
	Features     VolcengineModelFeatures    `json:"features"`
	Modalities   VolcengineModalities       `json:"modalities"`
	TaskType     []string                   `json:"task_type"`
	TokenLimits  VolcengineTokenLimits      `json:"token_limits"`
}

type VolcengineModelFeatures struct {
	StructuredOutputs *VolcengineStructuredOutputs `json:"structured_outputs"`
	Tools             *VolcengineTools             `json:"tools"`
	Cache             *VolcengineCache             `json:"cache"`
	Batch             *VolcengineBatch             `json:"batch"`
}

type VolcengineStructuredOutputs struct {
	JSONObject bool `json:"json_object"`
	JSONSchema bool `json:"json_schema"`
}

type VolcengineTools struct {
	FunctionCalling bool `json:"function_calling"`
}

type VolcengineCache struct {
	PrefixCache  bool `json:"prefix_cache"`
	SessionCache bool `json:"session_cache"`
}

type VolcengineBatch struct {
	BatchChat bool `json:"batch_chat"`
	BatchJob  bool `json:"batch_job"`
}

type VolcengineModalities struct {
	InputModalities  []string `json:"input_modalities"`
	OutputModalities []string `json:"output_modalities"`
}

type VolcengineTokenLimits struct {
	MaxInputTokens  int `json:"max_input_tokens"`
	MaxOutputTokens int `json:"max_output_tokens"`
}

type VolcengineModelList struct {
	Object string            `json:"object"`
	Data   []VolcengineModel `json:"data"`
}

// GeminiModel Gemini 模型列表中的单个模型条目
type GeminiModel struct {
	Name                       string   `json:"name"`
	DisplayName                string   `json:"displayName"`
	Description                string   `json:"description"`
	SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
	InputTokenLimit            int      `json:"inputTokenLimit"`
	OutputTokenLimit           int      `json:"outputTokenLimit"`
	Temperature                *float64 `json:"temperature"`
	TopP                       *float64 `json:"topP"`
	TopK                       *float64 `json:"topK"`
}

type GeminiModelList struct {
	Models []GeminiModel `json:"models"`
}

// Embeddings

type EmbeddingRequest struct {
	Model string      `json:"model" binding:"required"`
	Input interface{} `json:"input" binding:"required"` // string or []string
}

// Audio

type AudioSpeechRequest struct {
	Model string `json:"model" binding:"required"`
	Input string `json:"input" binding:"required"`
	Voice string `json:"voice"`
}

// OpenAI Error

type OpenAIError struct {
	Message string  `json:"message"`
	Type    string  `json:"type"`
	Param   *string `json:"param,omitempty"`
	Code    string  `json:"code"`
}

type OpenAIErrorResponse struct {
	Error OpenAIError `json:"error"`
}
