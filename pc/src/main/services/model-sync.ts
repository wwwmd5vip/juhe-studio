/**
 * Juhe Management 模型同步服务
 * 登录后将 Juhe Management 的模型和 API Key 同步到本地数据库
 */

import type { Token } from '@juhe-management/client'
import { JuheClient } from '@juhe-management/client'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { models, providers } from '../db/schema'
import store, { getJuheBaseUrl } from '../stores/config'
import { decryptApiKey, encryptApiKey } from './secure-storage'

const JUHE_PROVIDER_ID = 'juhe-management'
const JUHE_PROVIDER_NAME = 'Juhe Management'

function getToken(): string | null {
  try {
    const t = store.get('auth.jwtToken')
    return typeof t === 'string' && t.length > 0 ? t : null
  } catch {
    return null
  }
}

function makeClient(): JuheClient {
  return new JuheClient({ baseURL: getJuheBaseUrl(), adminToken: getToken() ?? undefined, timeout: 30000 })
}

/** Get or create a relay API key for actual model calls.
 *  Keys are masked in list responses, so we persist the full key
 *  in electron-store and reuse it across sessions. */
async function getOrCreateApiKey(): Promise<string> {
  // 1. Validate stored key by actually calling the API
  const encryptedKey = store.get('auth.apiKey')
  const storedKey = typeof encryptedKey === 'string' ? decryptApiKey(encryptedKey) : null
  if (storedKey && storedKey.length > 0 && !storedKey.includes('*')) {
    console.log(`[ModelSync] Validating stored API key: present=${!!storedKey}, length=${storedKey.length}`)
    const isValid = await validateApiKey(storedKey)
    if (isValid) {
      console.log('[ModelSync] Stored API key is valid, reusing')
      return storedKey
    }
    console.log('[ModelSync] Stored API key is invalid, will create new one')
    // Clear invalid key
    ;(store.delete as (k: string) => void)('auth.apiKey')
  }

  // 2. Check if there's already an "Auto Key" token on the server
  console.log('[ModelSync] Checking existing tokens...')
  try {
    const { data: tokens } = await makeClient().listTokens(1, 100)
    const autoKey = tokens.find((t: Token) => t.status === 1 && t.name === 'Auto Key')
    if (autoKey) {
      console.log(`[ModelSync] Found existing Auto Key token: id=${autoKey.id}`)
      // Delete stale token to avoid accumulation, will create fresh one
      try {
        await makeClient().deleteToken(autoKey.id)
      } catch {
        /* ok */
      }
    }
  } catch (err) {
    console.warn('[ModelSync] Failed to list tokens:', err)
  }

  // 3. Create a new token (response includes full unmasked key)
  const created = await makeClient().createToken({ name: 'Auto Key', unlimited_quota: true })
  console.log(`[ModelSync] Created new API key: ${created.key_mask ?? created.name}`)

  // 4. Persist the full key for reuse
  if (created.key) {
    store.set('auth.apiKey', encryptApiKey(created.key))
  }
  // biome-ignore lint/style/noNonNullAssertion: key is guaranteed after token creation
  return created.key!
}

/** Quick validation: call /v1/models with the key to check if it's still valid. */
async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new JuheClient({ baseURL: getJuheBaseUrl(), apiKey, timeout: 5000 })
    await client.listModels()
    return true
  } catch {
    return false
  }
}

export async function syncJuheModels(): Promise<{ providerId: string; synced: number }> {
  const startTime = performance.now()
  console.log('[ModelSync] Starting Juhe model sync...')

  const baseUrl = getJuheBaseUrl()
  if (!baseUrl) {
    console.log('[ModelSync] Juhe server URL not configured, skipping model sync')
    return { providerId: JUHE_PROVIDER_ID, synced: 0 }
  }

  // Check server version for diagnostics
  try {
    const statusRes = await fetch(`${baseUrl}/api/public/status`)
    const status = await statusRes.json() as { version?: string }
    console.log(`[ModelSync] Connected to Juhe Management v${status.version ?? 'unknown'}`)
  } catch {
    console.warn('[ModelSync] Could not check server version, continuing anyway')
  }

  const now = new Date().toISOString()

  // 1. Get or create a relay API key
  let apiKey: string
  try {
    apiKey = await getOrCreateApiKey()
  } catch (err) {
    console.error('[ModelSync] Failed to get API key:', err)
    throw err
  }

  // 2. Ensure the Juhe provider exists with correct config
  const existingRows = await db.select().from(providers).where(eq(providers.id, JUHE_PROVIDER_ID)).limit(1)

  if (existingRows[0]) {
    console.log('[ModelSync] Updating Juhe Management provider apiKey...')
    await db
      .update(providers)
      .set({
        baseUrl: `${baseUrl}/v1`,
        apiKey: encryptApiKey(apiKey),
        updatedAt: now
      })
      .where(eq(providers.id, JUHE_PROVIDER_ID))
  } else {
    console.log('[ModelSync] Creating Juhe Management provider...')
    await db.insert(providers).values({
      id: JUHE_PROVIDER_ID,
      name: JUHE_PROVIDER_NAME,
      type: 'openai-chat-completions',
      presetId: 'openai',
      baseUrl: `${baseUrl}/v1`,
      apiKey: encryptApiKey(apiKey),
      isEnabled: true,
      isCustom: false,
      createdAt: now,
      updatedAt: now
    })
  }

  // 3. Fetch all models from Juhe Management admin API
  console.log('[ModelSync] Fetching models from Juhe Management...')
  let synced = 0
  let page = 1
  const pageSize = 200
  const syncedNames = new Set<string>()

  // 预加载现有模型，按 name 去重（保留第一条）
  // 旧代码按 id（juhe-{model.id}）去重，与 provider:fetch-models 用 randomUUID 做 id 不一致，
  // 导致同一个模型被写入两条记录。改为按 name 去重后，无论 id 是 juhe-* 还是随机 UUID 都能正确匹配。
  const existingModels = await db.select().from(models).where(eq(models.providerId, JUHE_PROVIDER_ID))
  const existingByName = new Map<string, (typeof existingModels)[number]>()
  for (const m of existingModels) {
    if (!existingByName.has(m.name)) existingByName.set(m.name, m)
  }

  while (true) {
    const result = await makeClient().listModelsAdmin(page, pageSize)
    const { data, pagination } = result
    if (!data || data.length === 0) break

    for (const model of data) {
      // biome-ignore lint/suspicious/noExplicitAny: model data from external API
      // 跳过未定价的模型 — 没定价就无法调用
      if ((model as any).has_pricing === false) continue
      const modelEnabled = (model as any).status === 1 || (model as any).status === undefined
      const existing = existingByName.get(model.model_name)

      if (existing) {
        // 更新现有模型（保留 id、parameters、createdAt）
        await db
          .update(models)
          .set({
            displayName: model.display_name ?? null,
            type: model.type,
            capabilities: model.capabilities ?? null,
            isEnabled: modelEnabled
          })
          .where(eq(models.id, existing.id))
      } else {
        // 插入新模型
        await db.insert(models).values({
          id: `juhe-${model.id}`,
          providerId: JUHE_PROVIDER_ID,
          name: model.model_name,
          displayName: model.display_name ?? null,
          type: model.type,
          capabilities: model.capabilities ?? null,
          parameters: null,
          isEnabled: modelEnabled,
          createdAt: now
        })
      }
      syncedNames.add(model.model_name)
      synced++
    }

    const totalFetched = page * pageSize
    if (totalFetched >= pagination.total) break
    page++
  }

  // 4. 清理：删除远端已不存在的模型 + 删除重复记录（保留按 name 的第一条）
  let deleted = 0
  const keptIds = new Set<string>()
  for (const m of existingByName.values()) keptIds.add(m.id)
  for (const m of existingModels) {
    if (!syncedNames.has(m.name) || !keptIds.has(m.id)) {
      await db.delete(models).where(eq(models.id, m.id))
      deleted++
    }
  }

  const elapsed = performance.now()
  console.log(`[ModelSync] Synced ${synced} models, deleted ${deleted} stale/duplicate in ${(elapsed - startTime).toFixed(0)}ms`)
  return { providerId: JUHE_PROVIDER_ID, synced }
}

/**
 * Fetch the server-configured default vision model from Juhe Management.
 * Returns the model name (e.g. "gpt-4o"), or empty string if not configured.
 * This is a public endpoint — no auth required.
 */
export async function fetchServerDefaultVisionModel(): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const baseUrl = getJuheBaseUrl()
    const resp = await fetch(`${baseUrl}/api/public/setting/default-vision-model`, { signal: controller.signal })
    if (!resp.ok) return ''
    const json = await resp.json()
    return json?.data?.default_vision_model || ''
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[ModelSync] fetchServerDefaultVisionModel timed out')
    }
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch the server-configured default LLM model from Juhe Management.
 */
export async function fetchServerDefaultLLMModel(): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const baseUrl = getJuheBaseUrl()
    const resp = await fetch(`${baseUrl}/api/public/setting/default-llm-model`, { signal: controller.signal })
    if (!resp.ok) return ''
    const json = await resp.json()
    return json?.data?.default_llm_model || ''
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[ModelSync] fetchServerDefaultLLMModel timed out')
    }
    return ''
  } finally {
    clearTimeout(timeout)
  }
}
