package channel

import (
	"fmt"

	"github.com/juhe-management/server/internal/domain"
	"github.com/juhe-management/server/internal/relay"
)

// NewAdaptor 根据渠道类型和超时创建对应的适配器。
// 每次调用都返回新的 adaptor 实例（连接池通过 sharedTransport 在所有实例间共享），
// 避免了缓存 adaptor 实例导致的有状态字段并发竞争问题。
func NewAdaptor(channelType domain.ChannelType, timeoutSec int) (relay.Adaptor, error) {
	return newAdaptorNoCache(channelType, timeoutSec)
}

// newAdaptorNoCache 根据渠道类型和超时创建对应的适配器（不经过缓存）。
func newAdaptorNoCache(channelType domain.ChannelType, timeoutSec int) (relay.Adaptor, error) {
	switch channelType {
	// OpenAI 兼容协议族
	case domain.ChannelTypeOpenAI, domain.ChannelTypeOpenAICompatible, domain.ChannelTypeCustom:
		return NewOpenAICompatibleAdaptor(timeoutSec), nil

	// DeepSeek（OpenAI 兼容）
	case domain.ChannelTypeDeepSeek:
		return NewDeepSeekAdaptor(timeoutSec), nil

	// 国产平台（OpenAI 兼容）
	case domain.ChannelTypeSiliconFlow,
		domain.ChannelTypeVolcEngine,
		domain.ChannelTypeZhipu,
		domain.ChannelTypeQwen,
		domain.ChannelTypeMoonshot:
		return NewOpenAICompatibleAdaptor(timeoutSec), nil

	// 聚合平台（OpenAI 兼容）
	case domain.ChannelTypeOpenRouter, domain.ChannelTypeXAI:
		return NewOpenAICompatibleAdaptor(timeoutSec), nil

	// Ollama（OpenAI 兼容 + 额外 API）
	case domain.ChannelTypeOllama:
		return NewOllamaAdaptor(timeoutSec), nil

	// Anthropic（独立协议）
	case domain.ChannelTypeAnthropic:
		return NewAnthropicAdaptor(timeoutSec), nil

	// Gemini（独立协议）
	case domain.ChannelTypeGemini:
		return NewGeminiAdaptor(timeoutSec), nil

	// 即梦
	case domain.ChannelTypeJimeng:
		return NewJimengAdaptor(timeoutSec), nil

	// MXAPI
	case domain.ChannelTypeMXAPI:
		return NewMXAPIAdaptor(timeoutSec), nil

	// Kling
	case domain.ChannelTypeKling:
		return NewKlingAdaptor(timeoutSec), nil

	// 预留类型（当前回退到 OpenAI 兼容）
	case domain.ChannelTypeAzure,
		domain.ChannelTypeVertex,
		domain.ChannelTypeBedrock,
		domain.ChannelTypeCoze:
		return NewOpenAICompatibleAdaptor(timeoutSec), nil

	default:
		return nil, fmt.Errorf("unsupported channel type: %s", channelType)
	}
}

// NewAdaptorDefault 使用默认超时 120s 创建适配器（向后兼容）
func NewAdaptorDefault(channelType domain.ChannelType) (relay.Adaptor, error) {
	return NewAdaptor(channelType, 120)
}
