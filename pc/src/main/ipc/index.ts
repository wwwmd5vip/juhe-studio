import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join, resolve, sep } from 'node:path'
import type { GenerationParams } from '@shared/types/generation'
import { filterAllowed, parseJsonField } from '@shared/utils/json-utils'
import { stripBinaryDataFromParams } from '@shared/utils/task-utils'
import { and, desc, eq, like } from 'drizzle-orm'
import { app, BrowserWindow, ipcMain } from 'electron'
import { getPresetById } from '../../shared/utils/provider-presets'
import { db, reinitializeDatabase } from '../db'
import {
  chatAssistants,
  chatMessages,
  chatSessions,
  ecommerceWorkflows,
  generations,
  mcpServers,
  memories,
  models,
  promptTemplates,
  providers,
  quickPhrases,
  settings,
  showcaseTasks,
  skills,
  webSearchProviders,
  workflows
} from '../db/schema'
import { registerNotificationIpc } from '../services/notifications'
import { getPluginEngine } from '../services/plugin-engine'
import { getPluginLoader } from '../services/plugin-loader'
import { executeWorkflowNode } from '../services/workflow-execution'
import { fetchServerDefaultVisionModel, fetchServerDefaultLLMModel } from '../services/model-sync'
import { migrateLegacyImageUrl } from '../services/generation'
import store, { getJuheBaseUrl } from '../stores/config'

/** In-memory cache of decrypted provider keys. Only populated in main process. */
const providerKeyCache = new Map<
  string,
  { apiKey: string | null; accessKeyId: string | null; secretAccessKey: string | null }
>()

function maskKey(value: string | null): string | null {
  return value ? '****' : null
}

function decryptAndCache(p: typeof providers.$inferSelect): void {
  const entry = {
    apiKey: p.apiKey ? decryptApiKey(p.apiKey) || null : null,
    accessKeyId: p.accessKeyId ? decryptApiKey(p.accessKeyId) || null : null,
    secretAccessKey: p.secretAccessKey ? decryptApiKey(p.secretAccessKey) || null : null
  }
  providerKeyCache.set(p.id, entry)
}

import { decryptApiKey, encryptApiKey } from '../services/secure-storage'
import { registerAgentSquadIpc } from './agent-squad'
import { registerAuthIpc } from './auth'
import { registerChatIpc } from './chat'
import { registerComfyIpc } from './comfy'
import { registerCreatorOsIpc } from './creator-os'
import { registerEcommerceShowcaseIpc } from './ecommerce-showcase'
import { registerEcommerceWorkflowIpc } from './ecommerce-workflow'
import { registerFeedbackHandlers } from './feedback'
import { registerGenerationIpc } from './generation'
import { registerImageProcessIpc } from './image-processing'
import { registerJuhePromptsIpc } from './juhe-prompts'
import { registerMcpIpc } from './mcp'
import { registerMemoryIpc } from './memory'
import { registerPromptIpc } from './prompt'
import { registerPromptLibraryIpc } from './prompt-library'
import { registerProviderIpc } from './providers'
import { registerQuickPhrasesIpc } from './quick-phrases'
import { registerSkillsIpc } from './skills'
import { registerVideoGenerationIpc } from './video-generation'
import { registerWebSearchIpc } from './websearch'

// Register provider-specific IPC handlers
registerProviderIpc()
registerGenerationIpc()
registerChatIpc()
registerPromptIpc()
registerImageProcessIpc()
registerNotificationIpc()
registerQuickPhrasesIpc()
registerWebSearchIpc()
registerSkillsIpc()
registerMemoryIpc()
registerMcpIpc()
registerAgentSquadIpc()
registerAuthIpc()
registerEcommerceWorkflowIpc()
registerEcommerceShowcaseIpc()
registerPromptLibraryIpc()
registerVideoGenerationIpc()
registerComfyIpc()
registerJuhePromptsIpc()
registerFeedbackHandlers()
registerCreatorOsIpc()

// Initialize plugin engine
getPluginEngine()
// Initialize simple plugin loader
getPluginLoader()

// ==================== Window Controls ====================
ipcMain.handle('window:minimize', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.minimize()
})

ipcMain.handle('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  const win = BrowserWindow.getFocusedWindow()
  win?.close()
})

ipcMain.handle('window:isMaximized', () => {
  const win = BrowserWindow.getFocusedWindow()
  return win?.isMaximized() ?? false
})

// ==================== Generations ====================
ipcMain.handle(
  'db:generations:list',
  async (_, filter?: { type?: string; status?: string; limit?: number; offset?: number }) => {
    const start = Date.now()
    try {
      // Validate filter parameters to prevent abuse
      const validatedLimit = Math.min(Math.max(1, filter?.limit ?? 50), 1000)
      const validatedOffset = Math.max(0, filter?.offset ?? 0)

      const conditions = []
      if (filter?.type) conditions.push(eq(generations.type, filter.type))
      if (filter?.status) conditions.push(eq(generations.status, filter.status))

      const result = await db
        .select()
        .from(generations)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(generations.createdAt))
        .limit(validatedLimit)
        .offset(validatedOffset)
      const elapsed = Date.now() - start

      // Strip any base64 data from outputs/resultUrls/parameters before sending to renderer to prevent OOM.
      // Also migrate legacy image URLs (bare filenames, file://) to juhe-image:// protocol.
      const sanitized = result.map((row) => {
        let resultUrls = row.resultUrls
        if (typeof resultUrls === 'string') {
          const parsed = parseJsonField<unknown>(resultUrls, null)
          if (Array.isArray(parsed)) {
            resultUrls = JSON.stringify(
              parsed
                .filter((url: string) => typeof url === 'string' && !url.startsWith('data:'))
                .map((url: string) => migrateLegacyImageUrl(url) || url)
            )
          }
        }
        let outputs = row.outputs
        if (typeof outputs === 'string') {
          const parsed = parseJsonField<unknown>(outputs, null)
          if (Array.isArray(parsed)) {
            outputs = JSON.stringify(
              parsed.map((o: Record<string, unknown>) => ({
                ...o,
                base64: undefined,
                url: migrateLegacyImageUrl(o.url as string | undefined | null) || o.url
              }))
            )
          }
        }
        // Strip base64 image data from parameters field
        let parameters = row.parameters
        if (typeof parameters === 'string') {
          const parsed = parseJsonField<unknown>(parameters, null)
          if (parsed && typeof parsed === 'object') {
            parameters = JSON.stringify(stripBinaryDataFromParams(parsed as Record<string, unknown>))
          }
        }
        return { ...row, resultUrls, outputs, parameters }
      })

      console.log(
        `[IPC:db:generations:list] ⏱️ Queried ${sanitized.length} generations in ${elapsed}ms`,
        filter ? `(filter: ${JSON.stringify(filter)})` : ''
      )
      return sanitized
    } catch (error) {
      console.error(`[IPC:db:generations:list] ⏱️ Failed after ${Date.now() - start}ms:`, error)
      return []
    }
  }
)

ipcMain.handle('db:generations:get', async (_, id: string) => {
  try {
    const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1)
    const row = result[0]
    if (!row) return null
    // Strip base64 image data from parameters to prevent OOM
    let parameters = row.parameters
    if (typeof parameters === 'string') {
      const parsed = parseJsonField<unknown>(parameters, null)
      if (parsed && typeof parsed === 'object') {
        parameters = JSON.stringify(stripBinaryDataFromParams(parsed as Record<string, unknown>))
      }
    }
    return { ...row, parameters }
  } catch (error) {
    console.error('Failed to get generation:', error)
    return null
  }
})

ipcMain.handle('db:generations:create', async (_, data: Record<string, unknown>) => {
  try {
    // Allowlist: only accept known generation fields from renderer
    const filtered = filterAllowed(data, ['type', 'providerId', 'modelId', 'prompt', 'parameters', 'resultUrls', 'status', 'errorMessage'])
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const result = await db
      .insert(generations)
      .values({
        id,
        ...filtered,
        status: (filtered.status as string) ?? 'pending',
        createdAt: now,
        updatedAt: now
      } as typeof generations.$inferInsert)
      .returning()
    return result[0]
  } catch (error) {
    console.error('Failed to create generation:', error)
    throw error
  }
})

ipcMain.handle('db:generations:update', async (_, id: string, data: Record<string, unknown>) => {
  try {
    const filtered = filterAllowed(data, ['status', 'errorMessage', 'resultUrls', 'parameters', 'progress'])
    await db
      .update(generations)
      .set({ ...filtered, updatedAt: new Date().toISOString() } as typeof generations.$inferInsert)
      .where(eq(generations.id, id))
    return true
  } catch (error) {
    console.error('Failed to update generation:', error)
    throw error
  }
})

ipcMain.handle('db:generations:delete', async (_, id: string) => {
  try {
    await db.delete(generations).where(eq(generations.id, id))
    return true
  } catch (error) {
    console.error('Failed to delete generation:', error)
    throw error
  }
})

// ==================== Workflows ====================
ipcMain.handle('db:workflows:list', async (_, filter?: { isFavorite?: boolean; limit?: number }) => {
  try {
    const conditions = []
    if (filter?.isFavorite !== undefined) conditions.push(eq(workflows.isFavorite, filter.isFavorite))

    const result = await db
      .select()
      .from(workflows)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(workflows.updatedAt))
      .limit(filter?.limit ?? 50)
    return result
  } catch (error) {
    console.error('Failed to list workflows:', error)
    return []
  }
})

ipcMain.handle('db:workflows:create', async (_, data: Record<string, unknown>) => {
  try {
    const filtered = filterAllowed(data, ['name', 'description', 'nodes', 'edges', 'viewport', 'isFavorite', 'workflowType'])
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const result = await db
      .insert(workflows)
      .values({
        id,
        ...filtered,
        createdAt: now,
        updatedAt: now
      } as typeof workflows.$inferInsert)
      .returning()
    return result[0]
  } catch (error) {
    console.error('Failed to create workflow:', error)
    throw error
  }
})

ipcMain.handle('db:workflows:update', async (_, id: string, data: Record<string, unknown>) => {
  try {
    const filtered = filterAllowed(data, ['name', 'description', 'nodes', 'edges', 'viewport', 'isFavorite', 'workflowType'])
    await db
      .update(workflows)
      .set({ ...filtered, updatedAt: new Date().toISOString() } as typeof workflows.$inferInsert)
      .where(eq(workflows.id, id))
    return true
  } catch (error) {
    console.error('Failed to update workflow:', error)
    throw error
  }
})

ipcMain.handle('db:workflows:delete', async (_, id: string) => {
  try {
    await db.delete(workflows).where(eq(workflows.id, id))
    return true
  } catch (error) {
    console.error('Failed to delete workflow:', error)
    throw error
  }
})

// ==================== Prompt Templates ====================
ipcMain.handle(
  'db:promptTemplates:list',
  async (_, filter?: { category?: string; search?: string; isFavorite?: boolean }) => {
    try {
      const conditions = []
      if (filter?.category) conditions.push(eq(promptTemplates.category, filter.category))
      if (filter?.isFavorite !== undefined) conditions.push(eq(promptTemplates.isFavorite, filter.isFavorite))
      if (filter?.search) {
        // Escape SQL LIKE wildcards to prevent unexpected matches
        const escaped = filter.search.replace(/[%_]/g, '\\$&')
        conditions.push(like(promptTemplates.name, `%${escaped}%`))
      }

      const result = await db
        .select()
        .from(promptTemplates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(promptTemplates.updatedAt))
        .limit(100)
      return result
    } catch (error) {
      console.error('Failed to list prompt templates:', error)
      return []
    }
  }
)

ipcMain.handle('db:promptTemplates:create', async (_, data: Record<string, unknown>) => {
  try {
    const filtered = filterAllowed(data, ['name', 'content', 'category', 'description', 'isFavorite', 'tags'])
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const result = await db
      .insert(promptTemplates)
      .values({
        id,
        ...filtered,
        createdAt: now,
        updatedAt: now
      } as typeof promptTemplates.$inferInsert)
      .returning()
    return result[0]
  } catch (error) {
    console.error('Failed to create prompt template:', error)
    throw error
  }
})

ipcMain.handle('db:promptTemplates:update', async (_, id: string, data: Record<string, unknown>) => {
  try {
    const filtered = filterAllowed(data, ['name', 'content', 'category', 'description', 'isFavorite', 'tags'])
    await db
      .update(promptTemplates)
      .set({ ...filtered, updatedAt: new Date().toISOString() } as typeof promptTemplates.$inferInsert)
      .where(eq(promptTemplates.id, id))
    return true
  } catch (error) {
    console.error('Failed to update prompt template:', error)
    throw error
  }
})

ipcMain.handle('db:promptTemplates:delete', async (_, id: string) => {
  try {
    await db.delete(promptTemplates).where(eq(promptTemplates.id, id))
    return true
  } catch (error) {
    console.error('Failed to delete prompt template:', error)
    throw error
  }
})

// ==================== Providers ====================
ipcMain.handle('db:providers:list', async () => {
  const start = Date.now()
  try {
    const result = await db.select().from(providers).orderBy(providers.name)
    const elapsed = Date.now() - start
    console.log(`[IPC:db:providers:list] ⏱️ Queried ${result.length} providers in ${elapsed}ms`)

    // Populate in-memory cache with decrypted keys (never sent to renderer)
    for (const p of result) {
      decryptAndCache(p)
    }
    // Mask API keys before sending to renderer
    return result.map((p) => ({
      ...p,
      apiKey: maskKey(p.apiKey),
      accessKeyId: maskKey(p.accessKeyId),
      secretAccessKey: maskKey(p.secretAccessKey)
    }))
  } catch (error) {
    console.error(`[IPC:db:providers:list] ⏱️ Failed after ${Date.now() - start}ms:`, error)
    return []
  }
})

ipcMain.handle('db:providers:create', async (_, data: Record<string, unknown>) => {
  try {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Encrypt API keys before storage; reject masked placeholders
    const payload = { ...data }
    if (typeof payload.apiKey === 'string') {
      if (payload.apiKey.includes('*')) {
        delete payload.apiKey
      } else if (payload.apiKey) {
        payload.apiKey = encryptApiKey(payload.apiKey)
      }
    }
    if (typeof payload.accessKeyId === 'string') {
      if (payload.accessKeyId.includes('*')) {
        delete payload.accessKeyId
      } else if (payload.accessKeyId) {
        payload.accessKeyId = encryptApiKey(payload.accessKeyId)
      }
    }
    if (typeof payload.secretAccessKey === 'string') {
      if (payload.secretAccessKey.includes('*')) {
        delete payload.secretAccessKey
      } else if (payload.secretAccessKey) {
        payload.secretAccessKey = encryptApiKey(payload.secretAccessKey)
      }
    }

    const result = await db
      .insert(providers)
      .values({
        id,
        ...payload,
        createdAt: now,
        updatedAt: now
      } as typeof providers.$inferInsert)
      .returning()

    const provider = result[0]

    // 如果预设配置了默认模型，自动插入
    const preset = provider.presetId ? getPresetById(provider.presetId) : undefined
    if (preset?.defaultModels && preset.defaultModels.length > 0) {
      try {
        const modelInserts = preset.defaultModels.map((m) => ({
          id: crypto.randomUUID(),
          providerId: provider.id,
          name: m.name,
          displayName: m.displayName,
          type: 'llm',
          capabilities: m.capabilities ? JSON.stringify(m.capabilities) : null,
          parameters: null,
          isEnabled: true,
          createdAt: now
        }))
        await db.insert(models).values(modelInserts as (typeof models.$inferInsert)[])
        console.log(
          `[db:providers:create] Auto-inserted ${modelInserts.length} default models for preset "${preset.id}"`
        )
      } catch (modelErr) {
        console.error('[db:providers:create] Failed to insert default models:', modelErr)
        // 不阻断 provider 创建流程
      }
    }

    // Populate key cache with the plaintext values that were just encrypted & stored
    decryptAndCache(provider)

    // Return provider with masked keys
    return {
      ...provider,
      apiKey: maskKey(provider.apiKey),
      accessKeyId: maskKey(provider.accessKeyId),
      secretAccessKey: maskKey(provider.secretAccessKey)
    }
  } catch (error) {
    console.error('Failed to create provider:', error)
    throw error
  }
})

ipcMain.handle('db:providers:update', async (_, id: string, data: Record<string, unknown>) => {
  try {
    // Encrypt new API keys; reject masked placeholders
    const payload = { ...data }
    const newPlaintext: { apiKey?: string; accessKeyId?: string; secretAccessKey?: string } = {}
    if (typeof payload.apiKey === 'string') {
      if (payload.apiKey.includes('*')) {
        delete payload.apiKey
      } else {
        newPlaintext.apiKey = payload.apiKey
        payload.apiKey = payload.apiKey ? encryptApiKey(payload.apiKey) : ''
      }
    }
    if (typeof payload.accessKeyId === 'string') {
      if (payload.accessKeyId.includes('*')) {
        delete payload.accessKeyId
      } else {
        newPlaintext.accessKeyId = payload.accessKeyId
        payload.accessKeyId = payload.accessKeyId ? encryptApiKey(payload.accessKeyId) : ''
      }
    }
    if (typeof payload.secretAccessKey === 'string') {
      if (payload.secretAccessKey.includes('*')) {
        delete payload.secretAccessKey
      } else {
        newPlaintext.secretAccessKey = payload.secretAccessKey
        payload.secretAccessKey = payload.secretAccessKey ? encryptApiKey(payload.secretAccessKey) : ''
      }
    }

    await db
      .update(providers)
      .set({ ...payload, updatedAt: new Date().toISOString() } as typeof providers.$inferInsert)
      .where(eq(providers.id, id))

    // Update in-memory key cache with any new plaintext values
    const existing = providerKeyCache.get(id) || { apiKey: null, accessKeyId: null, secretAccessKey: null }
    if (newPlaintext.apiKey !== undefined) existing.apiKey = newPlaintext.apiKey || null
    if (newPlaintext.accessKeyId !== undefined) existing.accessKeyId = newPlaintext.accessKeyId || null
    if (newPlaintext.secretAccessKey !== undefined) existing.secretAccessKey = newPlaintext.secretAccessKey || null
    providerKeyCache.set(id, existing)
    return true
  } catch (error) {
    console.error('Failed to update provider:', error)
    throw error
  }
})

ipcMain.handle('db:providers:delete', async (_, id: string) => {
  try {
    // Delete associated models first, then the provider — in a single transaction
    await db.transaction(async (tx) => {
      await tx.delete(models).where(eq(models.providerId, id))
      await tx.delete(providers).where(eq(providers.id, id))
    })
    // Remove from in-memory key cache
    providerKeyCache.delete(id)
    return true
  } catch (error) {
    console.error('Failed to delete provider:', error)
    throw error
  }
})

// Retrieve decrypted keys on demand (one-at-a-time, not batch).
//
// SECURITY NOTE: This handler sends plaintext API keys to the renderer process.
// This is necessary because the renderer needs them for:
//   1. Copy-to-clipboard in the provider settings UI (ProviderDetail.tsx)
//   2. Duplicate provider flow (providers store — needs actual key to re-encrypt)
// Risks to be aware of:
//   - Any code running in the renderer (including third-party scripts, if loaded)
//     could potentially access these keys via IPC.
//   - Mitigation: keys are never stored or cached in the renderer; they are fetched
//     one-at-a-time on explicit user action (button click).
//   - Long-term: consider moving generation requests to the main process so that
//     renderer never needs raw keys, only opaque handles.
ipcMain.handle(
  'provider:getKey',
  async (
    _event,
    providerId: string
  ): Promise<{ apiKey?: string; accessKeyId?: string; secretAccessKey?: string } | null> => {
    try {
      const keys = providerKeyCache.get(providerId)
      if (!keys) {
        // Try to load from DB if not yet cached (e.g., process restart without list call)
        const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)
        const p = result[0]
        if (!p) return null
        decryptAndCache(p)
        const cached = providerKeyCache.get(providerId)
        if (!cached) return null
        return {
          apiKey: cached.apiKey ?? undefined,
          accessKeyId: cached.accessKeyId ?? undefined,
          secretAccessKey: cached.secretAccessKey ?? undefined
        }
      }
      return {
        apiKey: keys.apiKey ?? undefined,
        accessKeyId: keys.accessKeyId ?? undefined,
        secretAccessKey: keys.secretAccessKey ?? undefined
      }
    } catch (error) {
      console.error('Failed to get provider key:', error)
      return null
    }
  }
)

// ==================== Models ====================
ipcMain.handle('db:models:list', async (_, filter?: { providerId?: string; type?: string }) => {
  const start = Date.now()
  try {
    const conditions = []
    if (filter?.providerId) conditions.push(eq(models.providerId, filter.providerId))
    if (filter?.type) conditions.push(eq(models.type, filter.type))

    const result = await db
      .select()
      .from(models)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(models.name)
    const elapsed = Date.now() - start
    console.log(
      `[IPC:db:models:list] ⏱️ Queried ${result.length} models in ${elapsed}ms`,
      filter ? `(filter: ${JSON.stringify(filter)})` : ''
    )
    return result
  } catch (error) {
    console.error(`[IPC:db:models:list] ⏱️ Failed after ${Date.now() - start}ms:`, error)
    return []
  }
})

ipcMain.handle('db:models:create', async (_, data: Record<string, unknown>) => {
  try {
    // Allowlist: only accept known model fields from renderer
    const filtered = filterAllowed(data, ['providerId', 'name', 'displayName', 'type', 'capabilities', 'parameters', 'isEnabled'])
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const result = await db
      .insert(models)
      .values({
        id,
        ...filtered,
        createdAt: now
      } as typeof models.$inferInsert)
      .returning()
    return result[0]
  } catch (error) {
    console.error('Failed to create model:', error)
    throw error
  }
})

ipcMain.handle('db:models:update', async (_, id: string, data: Record<string, unknown>) => {
  try {
    // Allowlist: only accept known model fields from renderer
    const filtered = filterAllowed(data, ['name', 'displayName', 'type', 'capabilities', 'parameters', 'isEnabled'])
    await db
      .update(models)
      .set(filtered as typeof models.$inferInsert)
      .where(eq(models.id, id))
    return true
  } catch (error) {
    console.error('Failed to update model:', error)
    throw error
  }
})

ipcMain.handle('db:models:delete', async (_, id: string) => {
  try {
    await db.delete(models).where(eq(models.id, id))
    return true
  } catch (error) {
    console.error('Failed to delete model:', error)
    throw error
  }
})

// ==================== Juhe Management ====================
ipcMain.handle('juhe:get-default-vision-model', async () => {
  return fetchServerDefaultVisionModel()
})
ipcMain.handle('juhe:get-default-llm-model', async () => {
  return fetchServerDefaultLLMModel()
})
ipcMain.handle('db:settings:get', async (_, key: string) => {
  try {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
    return result[0]?.value ?? null
  } catch (error) {
    console.error('Failed to get setting:', error)
    return null
  }
})

ipcMain.handle('db:settings:set', async (_, key: string, value: string) => {
  try {
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date().toISOString() }
      })
    return true
  } catch (error) {
    console.error('Failed to set setting:', error)
    throw error
  }
})

// ==================== Configuration (electron-store) ====================
ipcMain.handle('config:get', async (_, key: string) => {
  return store.get(key)
})

const ALLOWED_CONFIG_KEYS = [
  'theme', 'language', 'windowState', 'juheBaseUrl',
  'eula_accepted', 'crash_reporting_enabled', 'pluginsEnabled',
  'providers', 'auth.jwtToken', 'auth.user', 'auth.credentials',
  'auth.apiKey', 'notificationSettings',
]

ipcMain.handle('config:set', async (_, key: string, value: unknown) => {
  if (!ALLOWED_CONFIG_KEYS.includes(key)) {
    throw new Error(`Unknown config key: ${key}`)
  }
  // Basic type validation for known keys
  if (key === 'theme' && typeof value !== 'string') {
    throw new Error(`Invalid type for theme: expected string`)
  }
  if (key === 'windowState' && (typeof value !== 'object' || value === null)) {
    throw new Error(`Invalid type for windowState: expected object`)
  }
  if (key === 'providers' && !Array.isArray(value)) {
    throw new Error(`Invalid type for providers: expected array`)
  }
  if (key === 'eula_accepted' && typeof value !== 'boolean') {
    throw new Error(`Invalid type for eula_accepted: expected boolean`)
  }
  if (key === 'crash_reporting_enabled' && typeof value !== 'boolean') {
    throw new Error(`Invalid type for crash_reporting_enabled: expected boolean`)
  }
  if (key === 'pluginsEnabled' && typeof value !== 'boolean') {
    throw new Error(`Invalid type for pluginsEnabled: expected boolean`)
  }
  store.set(key, value)
})

// ==================== Memories ====================
ipcMain.handle('db:memories:list', async (_, filter?: { search?: string; limit?: number }) => {
  try {
    const conditions = []
    if (filter?.search) {
      const escaped = filter.search.replace(/[%_]/g, '\\$&')
      conditions.push(like(memories.content, `%${escaped}%`))
    }

    const result = await db
      .select()
      .from(memories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(memories.updatedAt))
      .limit(filter?.limit ?? 100)
    return result
  } catch (error) {
    console.error('Failed to list memories:', error)
    return []
  }
})

ipcMain.handle('db:memories:create', async (_, data: Record<string, unknown>) => {
  try {
    // Allowlist: only accept known memory fields from renderer
    const filtered = filterAllowed(data, [
      'subjectId', 'subjectType', 'type', 'content', 'scope',
      'confidence', 'status', 'expiresAt', 'sourceType', 'sourceId'
    ])
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const result = await db
      .insert(memories)
      .values({
        id,
        ...filtered,
        createdAt: now,
        updatedAt: now
      } as typeof memories.$inferInsert)
      .returning()
    return result[0]
  } catch (error) {
    console.error('Failed to create memory:', error)
    throw error
  }
})

ipcMain.handle('db:memories:update', async (_, id: string, data: Record<string, unknown>) => {
  try {
    // Allowlist: only accept known memory fields from renderer
    const filtered = filterAllowed(data, ['type', 'content', 'scope', 'confidence', 'status', 'expiresAt'])
    await db
      .update(memories)
      .set({ ...filtered, updatedAt: new Date().toISOString() } as typeof memories.$inferInsert)
      .where(eq(memories.id, id))
    return true
  } catch (error) {
    console.error('Failed to update memory:', error)
    throw error
  }
})

ipcMain.handle('db:memories:delete', async (_, id: string) => {
  try {
    await db.delete(memories).where(eq(memories.id, id))
    return true
  } catch (error) {
    console.error('Failed to delete memory:', error)
    throw error
  }
})

// ==================== Plugin Engine ====================
ipcMain.handle('plugin:engine:status', () => {
  try {
    const engine = getPluginEngine()
    return engine.getStatus()
  } catch (error) {
    console.error('Failed to get plugin engine status:', error)
    return { isRunning: false, loadedPlugins: [] }
  }
})

// ==================== Simple Plugin Loader ====================
ipcMain.handle('plugins:list', () => {
  return getPluginLoader().listPlugins()
})

ipcMain.handle('plugins:activate', (_event, pluginId: string) => {
  return getPluginLoader().activatePlugin(pluginId)
})

ipcMain.handle('plugins:deactivate', (_event, pluginId: string) => {
  return getPluginLoader().deactivatePlugin(pluginId)
})

// ===== Workflow Node Execution =====
ipcMain.handle(
  'workflow:node:execute',
  async (_event, payload: { nodeId: string; generationParams: GenerationParams }) => {
    try {
      const result = await executeWorkflowNode(payload)
      return result
    } catch (error) {
      console.error('[Workflow:Execute] Error:', error)
      throw error
    }
  }
)

ipcMain.handle('workflow:node:cancel', async (_event, payload: { nodeId: string }) => {
  try {
    console.log('[Workflow:Cancel]', payload.nodeId)
    return { success: true }
  } catch (error) {
    console.error('[Workflow:Cancel] Error:', error)
    throw error
  }
})

// ==================== System — Storage & Data Management ====================

function _getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0
  try {
    const { readdirSync } = require('node:fs') as typeof import('fs')
    let total = 0
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += _getDirSize(fullPath)
      } else {
        try {
          total += statSync(fullPath).size
        } catch {
          /* skip */
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

function fmt(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

ipcMain.handle('system:getStorageInfo', () => {
  try {
    const dp = app.getPath('userData')
    const dbPath = join(dp, 'app.db')
    const cfgPath = join(dp, 'config.json')
    const dbSize = existsSync(dbPath) ? statSync(dbPath).size : 0
    const cfgSize = existsSync(cfgPath) ? statSync(cfgPath).size : 0
    return { dbPath, dbSize, dbSizeFormatted: fmt(dbSize), cfgPath, cfgSize, cfgSizeFormatted: fmt(cfgSize) }
  } catch (err) {
    console.error('[System] getStorageInfo:', err)
    return { dbPath: '', dbSize: 0, dbSizeFormatted: '0 B', cfgPath: '', cfgSize: 0, cfgSizeFormatted: '0 B' }
  }
})

ipcMain.handle('system:clearCache', () => {
  try {
    store.clear()
    store.set('juheBaseUrl', getJuheBaseUrl())
    store.set('theme', 'system')
    store.set('language', 'zh-CN')
    store.set('providers', [])
    store.set('windowState', { width: 1400, height: 900, isMaximized: false })
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('system:clearDatabase', async () => {
  try {
    const dbPath = join(app.getPath('userData'), 'app.db')
    // Create backup before clearing
    if (existsSync(dbPath)) {
      const backupPath = `${dbPath}.backup.${Date.now()}`
      copyFileSync(dbPath, backupPath)
      // Verify backup integrity: ensure the backup has the same size as the source
      const srcSize = statSync(dbPath).size
      const backupSize = statSync(backupPath).size
      if (backupSize !== srcSize) {
        throw new Error(`Backup size mismatch: source=${srcSize}, backup=${backupSize}`)
      }
      console.log('[System] Database backed up to', backupPath, 'before clear')
      unlinkSync(dbPath)
    }
    for (const s of ['-wal', '-shm']) {
      const p = dbPath + s
      if (existsSync(p))
        try {
          unlinkSync(p)
        } catch {
          /* */
        }
    }
    // Re-initialize Drizzle to prevent broken state after DB file deletion
    await reinitializeDatabase()
    providerKeyCache.clear()
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

// ==================== System — Full Database Backup & Restore ====================

const ALL_DB_TABLES = [
  { name: 'generations', table: generations },
  { name: 'workflows', table: workflows },
  { name: 'ecommerce_workflows', table: ecommerceWorkflows },
  { name: 'prompt_templates', table: promptTemplates },
  { name: 'providers', table: providers },
  { name: 'models', table: models },
  { name: 'chat_sessions', table: chatSessions },
  { name: 'chat_messages', table: chatMessages },
  { name: 'quick_phrases', table: quickPhrases },
  { name: 'settings', table: settings },
  { name: 'web_search_providers', table: webSearchProviders },
  { name: 'skills', table: skills },
  { name: 'memories', table: memories },
  { name: 'mcp_servers', table: mcpServers },
  { name: 'chat_assistants', table: chatAssistants },
  { name: 'showcase_tasks', table: showcaseTasks }
]

ipcMain.handle('system:backupDatabase', async () => {
  try {
    const backup: Record<string, unknown[]> = {}
    for (const { name, table } of ALL_DB_TABLES) {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: drizzle dynamic table reference
        const rows = await db.select().from(table as any)
        backup[name] = rows
      } catch (e) {
        console.warn('[System] Failed to backup table', name, ':', e)
        backup[name] = []
      }
    }
    // Save to backups directory in userData
    const backupsDir = join(app.getPath('userData'), 'backups')
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `full-backup-${timestamp}.json`
    const filePath = join(backupsDir, filename)
    const json = JSON.stringify(
      {
        version: 1,
        createdAt: Date.now(),
        tables: backup
      },
      null,
      2
    )
    writeFileSync(filePath, json, 'utf-8')
    console.log('[System] Full database backup saved to:', filePath)
    return { success: true, path: filePath, size: json.length }
  } catch (err) {
    console.error('[System] backupDatabase failed:', err)
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('system:restoreDatabase', async (_, filePath: string) => {
  try {
    // Security: restrict file reads to the app's backups directory
    // Use realpathSync to resolve symlinks before checking path prefix
    const backupsDir = resolve(join(app.getPath('userData'), 'backups'))
    const resolvedPath = require('node:fs').realpathSync(filePath)
    if (!resolvedPath.startsWith(backupsDir + sep) && resolvedPath !== backupsDir) {
      return { success: false, error: 'Access denied: file must be in the backups directory' }
    }
    if (!existsSync(resolvedPath)) {
      return { success: false, error: `Backup file not found: ${resolvedPath}` }
    }
    const json = readFileSync(resolvedPath, 'utf-8')
    const parsed = JSON.parse(json)
    if (!parsed.tables || typeof parsed.tables !== 'object') {
      return { success: false, error: 'Invalid backup format: missing tables' }
    }
    let restored = 0
    // Wrap all table restores in a single transaction to prevent
    // inconsistent state if one table restore fails mid-way.
    try {
      await db.transaction(async (tx) => {
        for (const { name, table } of ALL_DB_TABLES) {
          const rows = parsed.tables[name]
          if (!rows || !Array.isArray(rows) || rows.length === 0) continue
          // Delete existing rows first
          // biome-ignore lint/suspicious/noExplicitAny: drizzle dynamic table reference
          await (tx.delete(table as any) as any)
          // biome-ignore lint/suspicious/noExplicitAny: drizzle dynamic table reference
          await (tx.insert(table as any).values(rows as any) as any)
          restored += rows.length
        }
      })
    } catch (e) {
      console.error('[System] Database restore transaction failed:', e)
      return { success: false, error: `Restore failed: ${e instanceof Error ? e.message : String(e)}` }
    }
    console.log('[System] Database restored:', restored, 'rows')
    return { success: true, restored }
  } catch (err) {
    console.error('[System] restoreDatabase failed:', err)
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('system:listBackups', async () => {
  try {
    const backupsDir = join(app.getPath('userData'), 'backups')
    if (!existsSync(backupsDir)) return []
    const entries = readdirSync(backupsDir)
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => {
        const fullPath = join(backupsDir, f)
        const stat = statSync(fullPath)
        return { name: f, path: fullPath, size: stat.size, createdAt: stat.birthtimeMs }
      })
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
    return entries
  } catch (err) {
    console.error('[System] listBackups failed:', err)
    return []
  }
})

// ==================== Sentry Crash Reporting ====================

ipcMain.handle('system:getCrashReporting', async () => {
  const val = store.get('crash_reporting_enabled')
  return val !== false // default true
})

ipcMain.handle('system:setCrashReporting', async (_, enabled: boolean) => {
  store.set('crash_reporting_enabled', enabled)
  if (!enabled) {
    // Dynamically import Sentry only if it was initialized
    try {
      const Sentry = await import('@sentry/electron/main')
      await Sentry.close(2000)
      console.log('[Sentry] Crash reporting disabled, Sentry closed')
    } catch {
      // Sentry may not have been initialized
    }
  }
  return { success: true }
})

// ==================== EULA ====================

ipcMain.handle('app:getEula', () => {
  try {
    const eulaPath = app.isPackaged ? join(process.resourcesPath, 'EULA.md') : join(app.getAppPath(), 'EULA.md')
    return readFileSync(eulaPath, 'utf-8')
  } catch (err) {
    console.error('[App] Failed to read EULA.md:', err)
    // Fallback: return empty string so the modal shows no content
    return ''
  }
})

// ==================== App Quit ====================

ipcMain.handle('app:quit', () => {
  app.quit()
})
