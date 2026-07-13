package domain

// ChannelType 定义所有支持的渠道类型
type ChannelType string

const (
	// 通用 OpenAI 协议类型
	ChannelTypeOpenAI          ChannelType = "openai"           // 原生 OpenAI
	ChannelTypeOpenAICompatible ChannelType = "openai-compatible" // 兼容 OpenAI 协议的第三方

	// 主流 AI 平台
	ChannelTypeAzure     ChannelType = "azure"     // Azure OpenAI
	ChannelTypeAnthropic ChannelType = "anthropic" // Anthropic Claude
	ChannelTypeGemini    ChannelType = "gemini"    // Google Gemini

	// 国产 AI 平台
	ChannelTypeDeepSeek    ChannelType = "deepseek"    // DeepSeek
	ChannelTypeSiliconFlow ChannelType = "siliconflow" // 硅基流动
	ChannelTypeVolcEngine  ChannelType = "volcengine"  // 火山引擎
	ChannelTypeZhipu       ChannelType = "zhipu"       // 智谱
	ChannelTypeQwen        ChannelType = "qwen"        // 通义千问
	ChannelTypeMoonshot    ChannelType = "moonshot"    // Moonshot/Kimi

	// 聚合平台
	ChannelTypeOpenRouter ChannelType = "openrouter" // OpenRouter

	// 本地/自托管
	ChannelTypeOllama ChannelType = "ollama" // 本地 Ollama

	// 云平台
	ChannelTypeVertex  ChannelType = "vertex"  // Google Vertex AI
	ChannelTypeBedrock ChannelType = "bedrock" // AWS Bedrock

	// 创意/多媒体
	ChannelTypeJimeng ChannelType = "jimeng" // 即梦图像生成
	ChannelTypeKling  ChannelType = "kling"  // 可灵视频生成
	ChannelTypeCoze   ChannelType = "coze"   // 扣子 Bot
	ChannelTypeMXAPI  ChannelType = "mxapi"  // MXAPI 图像生成

	// 其他
	ChannelTypeXAI    ChannelType = "xai"    // xAI Grok
	ChannelTypeCustom ChannelType = "custom" // 自定义
)

// AuthType 认证方式
type AuthType string

const (
	AuthTypeAPIKey       AuthType = "api-key"        // Bearer token（默认）
	AuthTypeAPIKeyHeader AuthType = "api-key-header" // 自定义 Header（如 x-api-key）
	AuthTypeOAuth        AuthType = "oauth"          // OAuth 2.0（预留）
	AuthTypeAWSSigV4     AuthType = "aws-sigv4"      // AWS Signature V4（预留）
	AuthTypeGCPSA        AuthType = "gcp-sa"         // GCP Service Account（预留）
)

// ChannelDefaultBaseURLs 每种渠道类型的默认 BaseURL
var ChannelDefaultBaseURLs = map[ChannelType]string{
	ChannelTypeOpenAI:          "https://api.openai.com/v1",
	ChannelTypeAzure:           "",
	ChannelTypeAnthropic:       "https://api.anthropic.com",
	ChannelTypeGemini:          "https://generativelanguage.googleapis.com",
	ChannelTypeDeepSeek:        "https://api.deepseek.com",
	ChannelTypeOllama:          "http://localhost:11434",
	ChannelTypeOpenRouter:      "https://openrouter.ai/api",
	ChannelTypeXAI:             "https://api.x.ai",
	ChannelTypeVertex:          "",
	ChannelTypeBedrock:         "",
	ChannelTypeCoze:            "https://api.coze.cn",
	ChannelTypeKling:           "https://dashscope.aliyuncs.com",
	ChannelTypeSiliconFlow:     "https://api.siliconflow.cn",
	ChannelTypeVolcEngine:      "https://ark.cn-beijing.volces.com/api/v3",
	ChannelTypeZhipu:           "https://open.bigmodel.cn/api/paas/v4",
	ChannelTypeQwen:            "https://dashscope.aliyuncs.com/compatible-mode/v1",
	ChannelTypeMoonshot:        "https://api.moonshot.cn",
	ChannelTypeOpenAICompatible: "",
	ChannelTypeJimeng:          "https://visual.volcengineapi.com",
	ChannelTypeMXAPI:           "https://open.mxapi.org",
	ChannelTypeCustom:          "",
}

// GetDefaultBaseURL 获取渠道类型的默认 BaseURL
func GetDefaultBaseURL(ct ChannelType) string {
	if url, ok := ChannelDefaultBaseURLs[ct]; ok {
		return url
	}
	return ""
}

// IsOpenAICompatible 判断渠道类型是否兼容 OpenAI 协议
func IsOpenAICompatible(ct ChannelType) bool {
	switch ct {
	case ChannelTypeOpenAI,
		ChannelTypeOpenAICompatible,
		ChannelTypeDeepSeek,
		ChannelTypeSiliconFlow,
		ChannelTypeVolcEngine,
		ChannelTypeZhipu,
		ChannelTypeQwen,
		ChannelTypeMoonshot,
		ChannelTypeOpenRouter,
		ChannelTypeXAI:
		return true
	default:
		return false
	}
}

// ValidChannelTypes 所有有效的渠道类型列表
var ValidChannelTypes = []ChannelType{
	ChannelTypeOpenAI,
	ChannelTypeOpenAICompatible,
	ChannelTypeAzure,
	ChannelTypeAnthropic,
	ChannelTypeGemini,
	ChannelTypeDeepSeek,
	ChannelTypeSiliconFlow,
	ChannelTypeVolcEngine,
	ChannelTypeZhipu,
	ChannelTypeQwen,
	ChannelTypeMoonshot,
	ChannelTypeOpenRouter,
	ChannelTypeOllama,
	ChannelTypeVertex,
	ChannelTypeBedrock,
	ChannelTypeJimeng,
	ChannelTypeKling,
	ChannelTypeCoze,
	ChannelTypeMXAPI,
	ChannelTypeXAI,
	ChannelTypeCustom,
}
