import type { Model, Provider } from '@shared/types/provider'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'

export type CapabilityMode = 'any' | 'all'

export function isImageCapableModel(model: Model): boolean {
  const resolvedCaps = resolveModelCapabilities({
    name: model.name,
    type: model.type,
    capabilities: model.capabilities
  })

  if (resolvedCaps.includes('image')) return true

  const outputModalities = model.registryConfig?.outputModalities ?? []
  if (outputModalities.includes('image' as never)) return true

  const imageGeneration = model.registryConfig?.imageGeneration
  return !!imageGeneration
}

export function modelMatchesCapabilities(model: Model, capabilities: string[], mode: CapabilityMode = 'any'): boolean {
  const resolvedCaps = resolveModelCapabilities({
    name: model.name,
    type: model.type,
    capabilities: model.capabilities
  })
  if (resolvedCaps.length === 0) return false
  const normalizedCapabilities = capabilities.map((cap) =>
    cap === 'image-generation' ? 'image' : cap === 'function-call' ? 'function_calling' : cap
  )

  if (mode === 'all') {
    // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
    return normalizedCapabilities.every((cap) => resolvedCaps.includes(cap as any))
  }

  // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
  return normalizedCapabilities.some((cap) => resolvedCaps.includes(cap as any))
}

export function filterAvailableProviders(
  providers: Provider[],
  capabilities: string[],
  mode: CapabilityMode = 'any'
): Provider[] {
  return providers
    .filter((provider) => provider.isEnabled)
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.isEnabled && modelMatchesCapabilities(model, capabilities, mode))
    }))
    .filter((provider) => provider.models.length > 0)
}
