import type {
  ImageProviderSpec,
  ProviderCapabilityDeclaration,
  ProviderValidateResult,
  ProviderSubmitResult,
  ProviderPollResult,
  ProviderGenerationMode
} from '@shared/types/image-provider'
import type { GenerationParams } from '@shared/types/generation'

/**
 * BaseImageProvider — 所有 Provider 适配器的抽象基类。
 *
 * 约定：
 * - 子类必须提供 providerId 和 capabilities
 * - 子类实现 validate / submit / poll / cancel
 */
export abstract class BaseImageProvider implements ImageProviderSpec {
  abstract readonly providerId: string
  abstract readonly capabilities: ProviderCapabilityDeclaration

  abstract validate(params: GenerationParams): Promise<ProviderValidateResult>
  abstract submit(
    params: GenerationParams,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<ProviderSubmitResult>
  abstract poll(externalTaskId: string): Promise<ProviderPollResult>
  abstract cancel(externalTaskId: string): Promise<void>

  // ── 便捷方法 ──

  /** 检查此 Provider 是否支持给定的模式和模型 */
  supports(mode: ProviderGenerationMode, modelId?: string): boolean {
    if (!this.capabilities.modes.includes(mode)) return false
    if (this.capabilities.modelIds && this.capabilities.modelIds.length > 0 && modelId) {
      return this.capabilities.modelIds.includes(modelId)
    }
    return true
  }

  /** 简单校验（子类可覆写）—— 仅检查非空 prompt */
  protected baseValidate(params: GenerationParams): ProviderValidateResult {
    const errors: string[] = []
    if (!params.prompt?.trim()) {
      errors.push('Prompt is required')
    }
    return {
      valid: errors.length === 0,
      errors,
      normalizedParams: params
    }
  }
}
