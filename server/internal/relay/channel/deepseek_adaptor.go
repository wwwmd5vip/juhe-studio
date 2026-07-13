package channel

import "github.com/juhe-management/server/internal/relay"

// DeepSeekAdaptor DeepSeek 使用标准 OpenAI 协议，直接复用 OpenAI Adaptor 即可
type DeepSeekAdaptor struct {
	*OpenAICompatibleAdaptor
}

func NewDeepSeekAdaptor(timeoutSec int) *DeepSeekAdaptor {
	return &DeepSeekAdaptor{
		OpenAICompatibleAdaptor: NewOpenAICompatibleAdaptor(timeoutSec),
	}
}

// 确保实现 Adaptor 接口
var _ relay.Adaptor = (*DeepSeekAdaptor)(nil)
