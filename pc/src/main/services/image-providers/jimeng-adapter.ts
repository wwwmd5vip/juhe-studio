import { BaseImageProvider } from './base'
import type { ProviderCapabilityDeclaration, ProviderValidateResult, ProviderSubmitResult, ProviderPollResult } from '@shared/types/image-provider'
import type { GenerationParams } from '@shared/types/generation'
import { getGenerationQueue } from '../queue'

/**
 * 即梦（火山引擎）图像/视频生成适配器。
 * 委托给 jimeng-generation.ts 中的 executeJimengGeneration。
 */
export class JimengAdapter extends BaseImageProvider {
  readonly providerId = 'jimeng'
  readonly capabilities: ProviderCapabilityDeclaration = {
    modelIds: [],
    modes: ['image', 'video'],
    supportsAsync: true,
    supportsSync: false,
    supportsReferenceImage: true
  }

  async validate(params: GenerationParams): Promise<ProviderValidateResult> {
    const result = this.baseValidate(params)
    if (!params.model) {
      result.errors.push('Model is required for Jimeng provider')
    }
    return {
      ...result,
      valid: result.errors.length === 0
    }
  }

  async submit(
    params: GenerationParams,
    _onProgress?: (progress: number, stage: string) => void
  ): Promise<ProviderSubmitResult> {
    const queue = getGenerationQueue()
    const taskId = crypto.randomUUID()

    queue.createTask('jimeng', params, 'normal', { id: taskId })

    return { externalTaskId: taskId }
  }

  async poll(_externalTaskId: string): Promise<ProviderPollResult> {
    // 轮询由 executeJimengGeneration 内部处理
    return { done: true }
  }

  async cancel(externalTaskId: string): Promise<void> {
    const queue = getGenerationQueue()
    queue.cancelTask(externalTaskId)
  }
}
