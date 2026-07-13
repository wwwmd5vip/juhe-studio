import type { WebSearchResult } from '@shared/types/websearch'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { settings, webSearchProviders } from '../../db/schema'
import { decryptApiKey, encryptApiKey } from '../secure-storage'
import { searchWithProvider } from './providers'
import type { SearchProviderConfig } from './types'

const DEFAULT_MAX_RESULTS = 5
const DEFAULT_PROVIDER_SETTING_KEY = 'websearch.defaultProviderId'

function toSearchProviderConfig(record: typeof webSearchProviders.$inferSelect): SearchProviderConfig {
  let decryptedKey: string | undefined
  if (record.apiKey) {
    try {
      decryptedKey = decryptApiKey(record.apiKey)
    } catch (err) {
      console.error('[WebSearch] 解密 API 密钥失败:', {
        providerId: record.id,
        providerType: record.type,
        error: err instanceof Error ? err.message : String(err)
      })
      decryptedKey = undefined
    }
  }

  return {
    id: record.id,
    name: record.name,
    type: record.type,
    apiKey: decryptedKey,
    apiHost: record.apiHost || undefined,
    engines: record.engines ? (record.engines as string[]) : undefined
  }
}

export class WebSearchService {
  /**
   * Search keywords using the specified or default provider
   */
  async searchKeywords(
    query: string,
    providerId?: string,
    maxResults?: number
  ): Promise<{ results: WebSearchResult[]; query: string; providerId: string }> {
    const targetProviderId = providerId || (await this.getDefaultProviderId())

    if (!targetProviderId) {
      throw new Error('ERR_NO_SEARCH_PROVIDER: No search provider configured. Please add a web search provider first.')
    }

    const provider = await this.getProviderById(targetProviderId)
    if (!provider) {
      throw new Error(`ERR_SEARCH_PROVIDER_NOT_FOUND: Search provider not found: ${targetProviderId}`)
    }

    const config = toSearchProviderConfig(provider)

    let results: WebSearchResult[]
    try {
      results = await searchWithProvider(config, query, maxResults ?? DEFAULT_MAX_RESULTS)
    } catch (err) {
      console.error('[WebSearch] 搜索失败:', {
        providerId: targetProviderId,
        providerType: provider.type,
        query: query.slice(0, 100),
        maxResults: maxResults ?? DEFAULT_MAX_RESULTS,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      throw err
    }

    return {
      results,
      query,
      providerId: targetProviderId
    }
  }

  /**
   * Get the default provider ID from settings
   */
  private async getDefaultProviderId(): Promise<string | null> {
    try {
      const result = await db.select().from(settings).where(eq(settings.key, DEFAULT_PROVIDER_SETTING_KEY)).limit(1)
      return result[0]?.value ?? null
    } catch (err) {
      console.error('[WebSearch] 获取默认供应商失败:', {
        settingKey: DEFAULT_PROVIDER_SETTING_KEY,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Get a provider by ID
   */
  async getProviderById(id: string): Promise<typeof webSearchProviders.$inferSelect | null> {
    try {
      const result = await db.select().from(webSearchProviders).where(eq(webSearchProviders.id, id)).limit(1)
      return result[0] ?? null
    } catch (err) {
      console.error('[WebSearch] 获取供应商失败:', {
        providerId: id,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * List all configured web search providers
   */
  async listProviders(): Promise<Array<typeof webSearchProviders.$inferSelect>> {
    try {
      const result = await db.select().from(webSearchProviders).orderBy(webSearchProviders.name)
      return result
    } catch (err) {
      console.error('[WebSearch] 列出供应商失败:', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Create a new web search provider
   */
  async createProvider(data: {
    name: string
    type: string
    apiKey?: string
    apiHost?: string
    engines?: string[]
    isEnabled?: boolean
  }): Promise<typeof webSearchProviders.$inferSelect> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    try {
      const result = await db
        .insert(webSearchProviders)
        .values({
          id,
          name: data.name,
          type: data.type,
          apiKey: data.apiKey ? encryptApiKey(data.apiKey) : null,
          apiHost: data.apiHost || null,
          isEnabled: data.isEnabled ?? true,
          engines: data.engines ? JSON.stringify(data.engines) : null,
          createdAt: now,
          updatedAt: now
        })
        .returning()

      return result[0]
    } catch (err) {
      console.error('[WebSearch] 创建供应商失败:', {
        name: data.name,
        type: data.type,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      throw err
    }
  }

  /**
   * Update a web search provider
   */
  async updateProvider(
    id: string,
    data: Partial<{
      name: string
      type: string
      apiKey: string
      apiHost: string
      engines: string[]
      isEnabled: boolean
    }>
  ): Promise<boolean> {
    const payload: Record<string, unknown> = { ...data }

    if (data.engines) {
      payload.engines = JSON.stringify(data.engines)
    }
    if (data.apiKey) {
      payload.apiKey = encryptApiKey(data.apiKey)
    }

    try {
      await db
        .update(webSearchProviders)
        .set({
          ...payload,
          updatedAt: new Date().toISOString()
        } as typeof webSearchProviders.$inferInsert)
        .where(eq(webSearchProviders.id, id))

      return true
    } catch (err) {
      console.error('[WebSearch] 更新供应商失败:', {
        providerId: id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      throw err
    }
  }

  /**
   * Delete a web search provider
   */
  async deleteProvider(id: string): Promise<boolean> {
    try {
      await db.delete(webSearchProviders).where(eq(webSearchProviders.id, id))
      return true
    } catch (err) {
      console.error('[WebSearch] 删除供应商失败:', {
        providerId: id,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      throw err
    }
  }
}

// Singleton instance
export const webSearchService = new WebSearchService()
