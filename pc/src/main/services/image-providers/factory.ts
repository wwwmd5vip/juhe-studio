import type { ImageProviderSpec, ProviderGenerationMode } from '@shared/types/image-provider'

/**
 * ProviderRegistry — 单例工厂，管理所有已注册的图像 Provider。
 *
 * 用法：
 *   const registry = getProviderRegistry()
 *   registry.register(openaiAdapter)
 *   registry.register(jimengAdapter)
 *
 *   const provider = registry.findByPresetId('openai', 'image')
 */
class ProviderRegistry {
  private providers: ImageProviderSpec[] = []

  /** 注册一个 Provider */
  register(provider: ImageProviderSpec): void {
    // 同名 providerId 覆盖
    const existingIdx = this.providers.findIndex((p) => p.providerId === provider.providerId)
    if (existingIdx >= 0) {
      this.providers[existingIdx] = provider
    } else {
      this.providers.push(provider)
    }
  }

  /** 按 presetId 和 mode 查找匹配的 Provider */
  findByPresetId(presetId: string, mode: ProviderGenerationMode): ImageProviderSpec | null {
    return (
      this.providers.find(
        (p) => p.providerId === presetId && p.supports(mode)
      ) ?? null
    )
  }

  /**
   * 查找所有支持给定 mode 的 Provider。
   * 用于自动注册 executor、展示可用 Provider 列表等。
   */
  listByMode(mode: ProviderGenerationMode): ImageProviderSpec[] {
    return this.providers.filter((p) => p.supports(mode))
  }

  /** 获取所有已注册的 Provider */
  listAll(): ImageProviderSpec[] {
    return [...this.providers]
  }

  /** 清空（仅用于测试） */
  clear(): void {
    this.providers = []
  }
}

let instance: ProviderRegistry | null = null

export function getProviderRegistry(): ProviderRegistry {
  if (!instance) {
    instance = new ProviderRegistry()
  }
  return instance
}

/** 仅用于测试：重置单例 */
export function resetProviderRegistry(): void {
  instance = null
}
