import { BaseImageProvider } from './base'
import type { ProviderCapabilityDeclaration, ProviderValidateResult, ProviderSubmitResult, ProviderPollResult } from '@shared/types/image-provider'
import type { GenerationParams } from '@shared/types/generation'
import { getGenerationQueue } from '../queue'

/**
 * 阿里云百炼 DashScope 适配器。
 * 委托给 aliyun-generation.ts 中的 executeAliyunImageGeneration / executeAliyunVideoGeneration。
 */
export class AliyunAdapter extends BaseImageProvider {
  readonly providerId = 'aliyun'
  readonly capabilities: ProviderCapabilityDeclaration = {
    modelIds: [],
    modes: ['image', 'video'],
    supportsAsync: true,
    supportsSync: true,
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

    // generation-router 根据模型决定 aliyun-image 还是 aliyun-video
    const execType = params.generationMode === 'video' ? 'aliyun-video' : 'aliyun-image'
    queue.createTask(execType, params, 'normal', { id: taskId })

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
