import { BaseImageProvider } from './base'
import type { ProviderCapabilityDeclaration, ProviderValidateResult, ProviderSubmitResult, ProviderPollResult } from '@shared/types/image-provider'
import type { GenerationParams } from '@shared/types/generation'
import { getGenerationQueue } from '../queue'

/**
 * FAL.AI 视频生成适配器。
 * 委托给 video-generation.ts 中的 submitVideoGeneration。
 */
export class FalVideoAdapter extends BaseImageProvider {
  readonly providerId = 'fal'
  readonly capabilities: ProviderCapabilityDeclaration = {
    modelIds: [],
    modes: ['video'],
    supportsAsync: true,
    supportsSync: false,
    supportsReferenceImage: true
  }

  async validate(params: GenerationParams): Promise<ProviderValidateResult> {
    const result = this.baseValidate(params)
    return { ...result, valid: result.errors.length === 0 }
  }

  async submit(
    params: GenerationParams,
    _onProgress?: (progress: number, stage: string) => void
  ): Promise<ProviderSubmitResult> {
    const queue = getGenerationQueue()
    const taskId = crypto.randomUUID()

    queue.createTask('video', params, 'normal', { id: taskId })

    return { externalTaskId: taskId }
  }

  async poll(_externalTaskId: string): Promise<ProviderPollResult> {
    return { done: true }
  }

  async cancel(externalTaskId: string): Promise<void> {
    const queue = getGenerationQueue()
    queue.cancelTask(externalTaskId)
  }
}
