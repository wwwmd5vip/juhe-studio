import { BaseImageProvider } from './base'
import type { ProviderCapabilityDeclaration, ProviderValidateResult, ProviderSubmitResult, ProviderPollResult } from '@shared/types/image-provider'
import type { GenerationParams, GenerationTask } from '@shared/types/generation'
import { getGenerationQueue } from '../queue'

/**
 * OpenAI 兼容图像生成适配器。
 * 委托给 generation.ts 中的 executeImageGeneration。
 */
export class OpenAICompatibleImageAdapter extends BaseImageProvider {
  readonly providerId = 'openai'
  readonly capabilities: ProviderCapabilityDeclaration = {
    modelIds: [],
    modes: ['image'],
    supportsAsync: false,
    supportsSync: true,
    supportsReferenceImage: true
  }

  async validate(params: GenerationParams): Promise<ProviderValidateResult> {
    return this.baseValidate(params)
  }

  async submit(
    params: GenerationParams,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<ProviderSubmitResult> {
    const queue = getGenerationQueue()
    const taskId = crypto.randomUUID()

    const task = await queue.createTask('image', params, 'normal', { id: taskId })

    // 队列异步执行，返回 taskId 作为 externalTaskId
    return { externalTaskId: task.id }
  }

  async poll(externalTaskId: string): Promise<ProviderPollResult> {
    // 同步 Provider，不轮询
    return { done: true }
  }

  async cancel(externalTaskId: string): Promise<void> {
    const queue = getGenerationQueue()
    queue.cancelTask(externalTaskId)
  }
}
