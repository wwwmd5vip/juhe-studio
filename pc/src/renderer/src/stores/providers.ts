/**
 * Provider 状态管理 (Zustand)
 * 管理 Provider 配置、模型列表、连接状态
 */

import type {
  ConnectionTestResult,
  CreateProviderRequest,
  DbModel,
  DbProvider,
  FetchModelsResult,
  Model,
  Provider,
  UpdateProviderRequest
} from '@shared/types/provider'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import { getPresetByBaseUrl } from '@shared/utils/provider-presets'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createApiProxy } from '@/utils/api-proxy'

// 从 window.api 获取 IPC 调用（防御性代理 — preload 失败时给出清晰错误而非 cryptic 的 undefined）
const api = createApiProxy()

// Global promise to dedupe concurrent loadProviders() calls
let loadProvidersPromise: Promise<void> | null = null

interface ProviderState {
  // === 数据 ===
  providers: Provider[]
  isLoading: boolean
  error: string | null
  // Whether providers have been loaded at least once
  hasLoaded: boolean

  // === UI 状态 ===
  selectedProviderId: string | null
  editingProvider: Provider | null
  showAddModal: boolean
  searchQuery: string
  filter: 'all' | 'enabled' | 'disabled'
  modelSearchQuery: string
  modelCapabilityFilter: string

  // === Actions ===
  loadProviders: (opts?: { force?: boolean }) => Promise<void>
  selectProvider: (id: string | null) => void
  createProvider: (data: CreateProviderRequest) => Promise<Provider>
  updateProvider: (data: UpdateProviderRequest) => Promise<Provider>
  deleteProvider: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<ConnectionTestResult>
  fetchModels: (id: string) => Promise<FetchModelsResult>
  toggleProviderEnabled: (id: string) => Promise<void>
  toggleModelEnabled: (providerId: string, modelId: string) => Promise<void>
  addModel: (providerId: string, modelId: string, displayName?: string) => Promise<Model | undefined>
  duplicateProvider: (id: string) => Promise<Provider | undefined>
  setEditingProvider: (provider: Provider | null) => void
  setShowAddModal: (show: boolean) => void
  setSearchQuery: (query: string) => void
  setFilter: (filter: 'all' | 'enabled' | 'disabled') => void
  setModelSearchQuery: (query: string) => void
  setModelCapabilityFilter: (filter: string) => void
  clearError: () => void
}

function parseCapabilities(value: unknown): string[] | null {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as string[]) : null
    } catch {
      return null
    }
  }
  return null
}

function toResolvedCapabilities(model: DbModel): string[] {
  const parsedCaps = parseCapabilities(model.capabilities)
  return resolveModelCapabilities({
    name: model.name,
    type: model.type,
    capabilities: parsedCaps
  })
}

function dbProviderToProvider(db: DbProvider, dbModels: DbModel[] = []): Provider {
  return {
    ...db,
    connectionStatus: 'unknown',
    models: dbModels.map((m) => {
      const normalizedCaps = toResolvedCapabilities(m)
      return {
        ...m,
        capabilities: normalizedCaps,
        isAutoFetched: false,
        registryConfig: undefined
      }
    })
  }
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      // === 初始状态 ===
      providers: [],
      isLoading: false,
      error: null,
      hasLoaded: false,
      selectedProviderId: null,
      editingProvider: null,
      showAddModal: false,
      searchQuery: '',
      filter: 'all',
      modelSearchQuery: '',
      modelCapabilityFilter: 'all',

      // === Actions ===
      loadProviders: async (opts?: { force?: boolean }) => {
        const { force } = opts || {}
        // Dedupe: if already loaded and not currently loading, skip unless forced
        const state = get()
        if (!force && state.hasLoaded && state.providers.length > 0 && !state.isLoading) {
          console.log('[ProviderStore] ⏱️ loadProviders skipped (already loaded)')
          return
        }
        // Dedupe: if another call is in flight, wait for it
        if (loadProvidersPromise) {
          console.log('[ProviderStore] ⏱️ loadProviders deduped (waiting for in-flight)')
          return loadProvidersPromise
        }

        const start = performance.now()
        set({ isLoading: true, error: null })

        loadProvidersPromise = (async () => {
          try {
            const dbProviders = (await api.db.providers.list()) as DbProvider[]
            const providersElapsed = performance.now()
            console.log(
              `[ProviderStore] ⏱️ providers.list took ${(providersElapsed - start).toFixed(1)}ms, got ${dbProviders.length} providers`
            )

            const dbModels = (await api.db.models.list()) as unknown as DbModel[]
            const modelsElapsed = performance.now()
            console.log(
              `[ProviderStore] ⏱️ models.list took ${(modelsElapsed - providersElapsed).toFixed(1)}ms, got ${dbModels.length} models`
            )

            // Backfill missing presetId for legacy providers based on base URL
            for (const p of dbProviders) {
              if (!p.presetId && p.baseUrl) {
                const matched = getPresetByBaseUrl(p.baseUrl)
                if (matched && matched.id !== 'custom-openai') {
                  try {
                    await api.db.providers.update(p.id, { presetId: matched.id })
                    p.presetId = matched.id
                  } catch {
                    // ignore backfill errors
                  }
                }
              }
            }

            const providers = dbProviders.map((p) =>
              dbProviderToProvider(
                p,
                dbModels.filter((m) => m.providerId === p.id)
              )
            )
            const totalElapsed = performance.now()
            console.log(
              `[ProviderStore] ⏱️ loadProviders total: ${(totalElapsed - start).toFixed(1)}ms (${providers.length} providers mapped)`
            )
            set({ providers, isLoading: false, hasLoaded: true })
          } catch (err) {
            const elapsed = performance.now()
            console.error(`[ProviderStore] ⏱️ loadProviders failed after ${(elapsed - start).toFixed(1)}ms:`, err)
            set({
              error: err instanceof Error ? err.message : 'Failed to load providers',
              isLoading: false
            })
          } finally {
            loadProvidersPromise = null
          }
        })()

        return loadProvidersPromise
      },

      selectProvider: (id) => {
        set({ selectedProviderId: id })
      },

      createProvider: async (data) => {
        try {
          const result = (await api.db.providers.create(
            data as unknown as Record<string, unknown>
          )) as unknown as DbProvider
          const provider = dbProviderToProvider(result)
          set((state) => ({
            providers: [...state.providers, provider],
            showAddModal: false,
            error: null
          }))
          return provider
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create provider'
          set({ error: message })
          throw err
        }
      },

      updateProvider: async (data) => {
        try {
          const payload: Record<string, unknown> = {
            name: data.name,
            type: data.type,
            baseUrl: data.baseUrl,
            apiKey: data.apiKey,
            isEnabled: data.isEnabled
          }
          if (data.presetId !== undefined) payload.presetId = data.presetId
          if (data.accessKeyId !== undefined) payload.accessKeyId = data.accessKeyId
          if (data.secretAccessKey !== undefined) payload.secretAccessKey = data.secretAccessKey
          await api.db.providers.update(data.id, payload)
          // Reload to get fresh data
          await get().loadProviders({ force: true })
          const updated = get().providers.find((p) => p.id === data.id)
          if (!updated) throw new Error('Provider not found after update')
          set({ error: null })
          return updated
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to update provider'
          set({ error: message })
          throw err
        }
      },

      deleteProvider: async (id) => {
        try {
          await api.db.providers.delete(id)
          set((state) => ({
            providers: state.providers.filter((p) => p.id !== id),
            selectedProviderId: state.selectedProviderId === id ? null : state.selectedProviderId,
            error: null
          }))
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete provider'
          set({ error: message })
          throw err
        }
      },

      testConnection: async (id) => {
        set((state) => ({
          providers: state.providers.map((p) => (p.id === id ? { ...p, connectionStatus: 'unknown' as const } : p))
        }))

        try {
          const result = await api.provider.testConnection(id)
          set((state) => ({
            providers: state.providers.map((p) =>
              p.id === id
                ? {
                    ...p,
                    connectionStatus: result.success ? 'connected' : 'error',
                    lastError: result.success ? undefined : result.message
                  }
                : p
            )
          }))
          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Connection test failed'
          set((state) => ({
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, connectionStatus: 'error' as const, lastError: message } : p
            )
          }))
          return { success: false, message }
        }
      },

      fetchModels: async (id) => {
        try {
          const result = await api.provider.fetchModels(id)
          // Refresh providers after fetch
          await get().loadProviders({ force: true })
          set({ error: null })
          return result as FetchModelsResult
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to fetch models'
          set({ error: message })
          return { providerId: id, models: [], total: 0, added: 0, updated: 0, error: message } as FetchModelsResult
        }
      },

      toggleProviderEnabled: async (id) => {
        const provider = get().providers.find((p) => p.id === id)
        if (!provider) return
        const nextEnabled = !provider.isEnabled
        // Optimistic update
        set((state) => ({
          providers: state.providers.map((p) => (p.id === id ? { ...p, isEnabled: nextEnabled } : p))
        }))
        try {
          await get().updateProvider({ id, isEnabled: nextEnabled })
        } catch (err) {
          // Rollback on error
          set((state) => ({
            providers: state.providers.map((p) => (p.id === id ? { ...p, isEnabled: provider.isEnabled } : p)),
            error: err instanceof Error ? err.message : 'Failed to toggle provider'
          }))
        }
      },

      toggleModelEnabled: async (providerId, modelId) => {
        const provider = get().providers.find((p) => p.id === providerId)
        const model = provider?.models.find((m) => m.id === modelId)
        if (!model) return

        const nextEnabled = !model.isEnabled
        // Optimistic update
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  models: p.models.map((m) => (m.id === modelId ? { ...m, isEnabled: nextEnabled } : m))
                }
              : p
          )
        }))

        try {
          await api.db.models.update(modelId, { isEnabled: nextEnabled })
          // Sync in case DB differs
          await get().loadProviders({ force: true })
        } catch (err) {
          // Rollback on error
          set((state) => ({
            providers: state.providers.map((p) =>
              p.id === providerId
                ? {
                    ...p,
                    models: p.models.map((m) => (m.id === modelId ? { ...m, isEnabled: model.isEnabled } : m))
                  }
                : p
            ),
            error: err instanceof Error ? err.message : 'Failed to toggle model'
          }))
        }
      },

      addModel: async (providerId, modelId, displayName) => {
        const provider = get().providers.find((p) => p.id === providerId)
        if (!provider) return undefined

        // 检查是否已存在
        const existing = provider.models.find((m) => m.name === modelId)
        if (existing) {
          set({ error: `模型 "${modelId}" 已存在` })
          return undefined
        }

        try {
          const caps = resolveModelCapabilities({ name: modelId, type: 'llm' })
          const result = await api.db.models.create({
            providerId,
            name: modelId,
            displayName: displayName || modelId,
            type: 'llm',
            capabilities: caps,
            parameters: null,
            isEnabled: true
          })

          // 刷新列表
          await get().loadProviders({ force: true })
          return result as unknown as Model
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to add model'
          set({ error: message })
          return undefined
        }
      },

      duplicateProvider: async (id) => {
        const source = get().providers.find((p) => p.id === id)
        if (!source) return undefined
        // Fetch actual keys from main process (they are masked in the store)
        const keys = await api.provider.getKey(id)
        const payload: CreateProviderRequest = {
          name: `${source.name} (Copy)`,
          type: source.type,
          baseUrl: source.baseUrl ?? '',
          apiKey: keys?.apiKey,
          accessKeyId: keys?.accessKeyId,
          secretAccessKey: keys?.secretAccessKey,
          isEnabled: false,
          isCustom: source.isCustom,
          presetId: source.presetId ?? undefined
        }
        return get().createProvider(payload)
      },

      setEditingProvider: (provider) => {
        set({ editingProvider: provider })
      },

      setShowAddModal: (show) => {
        set({ showAddModal: show })
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      setFilter: (filter) => {
        set({ filter })
      },

      setModelSearchQuery: (query) => {
        set({ modelSearchQuery: query })
      },

      setModelCapabilityFilter: (filter) => {
        set({ modelCapabilityFilter: filter })
      },

      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'cherrystudio-providers',
      partialize: (state) => ({
        // Only persist selected provider, not the full list (comes from DB)
        selectedProviderId: state.selectedProviderId
      })
    }
  )
)
