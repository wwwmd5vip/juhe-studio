/**
 * 图像 Provider 适配器系统入口。
 *
 * 调用 initProviderRegistry() 注册所有 Provider 到全局工厂。
 * 在 main process 启动时调用一次。
 */

import { getProviderRegistry } from './factory'
import { OpenAICompatibleImageAdapter } from './openai-adapter'
import { JimengAdapter } from './jimeng-adapter'
import { AliyunAdapter } from './aliyun-adapter'
import { FalVideoAdapter } from './fal-video-adapter'
import { OpenAIAudioAdapter } from './audio-adapter'

let initialized = false

export function initProviderRegistry(): void {
  if (initialized) return

  const registry = getProviderRegistry()

  registry.register(new OpenAICompatibleImageAdapter())
  registry.register(new JimengAdapter())
  registry.register(new AliyunAdapter())
  registry.register(new FalVideoAdapter())
  registry.register(new OpenAIAudioAdapter())

  initialized = true
}

export { getProviderRegistry } from './factory'
export { BaseImageProvider } from './base'
export type {
  ImageProviderSpec,
  ProviderCapabilityDeclaration,
  ProviderValidateResult,
  ProviderSubmitResult,
  ProviderPollResult,
  ProviderRegistration
} from '@shared/types/image-provider'
