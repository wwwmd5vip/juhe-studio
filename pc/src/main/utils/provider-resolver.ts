/**
 * Provider resolution utilities.
 * Centralizes the pattern of querying a provider from DB, decrypting its API key,
 * and building ai-core settings — previously duplicated across ~15 service files.
 */

import { mapProviderType } from '@shared/constants/provider-mapping'
import { eq } from 'drizzle-orm'

import { db } from '../db'
import { providers } from '../db/schema'
import { decryptApiKey } from '../services/secure-storage'

export interface ResolvedProvider {
  apiKey: string
  baseURL: string | undefined
  providerType: string
  providerId: string
  isEnabled: boolean
  presetId: string | null
}

/**
 * Query a provider by ID, decrypt its API key, and map its endpoint type.
 * Throws if the provider is not found, disabled, or has no valid API key.
 */
export async function resolveProvider(providerId: string): Promise<ResolvedProvider> {
  const rows = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)
  const provider = rows[0]
  if (!provider) throw new Error(`未找到该提供商，请检查配置`)

  if (!provider.isEnabled) throw new Error('该提供商已被禁用，请在设置中启用')

  const apiKey = provider.apiKey ? decryptApiKey(provider.apiKey) : ''
  if (!apiKey) throw new Error(`Provider ${providerId} 的 API Key 未配置`)

  return {
    apiKey,
    baseURL: provider.baseUrl || undefined,
    providerType: provider.type || 'openai-chat-completions',
    providerId: mapProviderType(provider.type || 'openai-chat-completions'),
    isEnabled: provider.isEnabled,
    presetId: provider.presetId
  }
}

/**
 * Build the settings object expected by @cherrystudio/ai-core from a resolved provider.
 */
export function buildAiCoreSettings(provider: ResolvedProvider): Record<string, string> {
  const settings: Record<string, string> = {}
  if (provider.apiKey) settings.apiKey = provider.apiKey
  if (provider.baseURL) settings.baseURL = provider.baseURL
  return settings
}
