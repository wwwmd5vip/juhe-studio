/**
 * Web Search State Management (Zustand)
 */

import type { WebSearchProvider, WebSearchResult } from '@shared/types/websearch'
import { createApiProxy } from '@/utils/api-proxy'
import { create } from 'zustand'

const api = createApiProxy()

interface WebSearchState {
  providers: WebSearchProvider[]
  isEnabled: boolean
  isSearching: boolean
  error: string | null
  lastResults: WebSearchResult[]

  loadProviders: () => Promise<void>
  toggleSearch: (enabled: boolean) => void
  search: (query: string, providerId?: string) => Promise<WebSearchResult[]>
}

export const useWebSearchStore = create<WebSearchState>()((set, get) => ({
  providers: [],
  isEnabled: false,
  isSearching: false,
  error: null,
  lastResults: [],

  loadProviders: async () => {
    try {
      const result = await api.db.settings.get('websearch.providers')
      if (result) {
        const parsed = JSON.parse(result as string) as WebSearchProvider[]
        set({ providers: parsed })
      } else {
        set({ providers: [] })
      }
    } catch (err) {
      console.error('[WebSearchStore] Failed to load providers:', err)
      set({ providers: [] })
    }
  },

  toggleSearch: (enabled: boolean) => {
    set({ isEnabled: enabled })
  },

  search: async (query: string, providerId?: string) => {
    const { providers } = get()
    if (providers.length === 0) {
      throw new Error('No web search providers configured')
    }

    const targetProvider = providerId
      ? providers.find((p) => p.id === providerId && p.isEnabled !== false)
      : providers.find((p) => p.isEnabled !== false)

    if (!targetProvider) {
      throw new Error('No enabled web search provider found')
    }

    set({ isSearching: true, lastResults: [] })

    try {
      // Use a generic IPC call via config or a dedicated endpoint
      // For now, we simulate the search via a config-based approach
      // In a full implementation, this would call a dedicated main-process handler
      const webSearchApi = (
        api as { webSearch?: { search?: (params: { query: string; providerId: string }) => unknown } }
      ).webSearch
      const response = await webSearchApi?.search?.({
        query,
        providerId: targetProvider.id
      })

      if (response && Array.isArray((response as { results?: WebSearchResult[] }).results)) {
        const results = (response as { results: WebSearchResult[] }).results
        set({ lastResults: results, isSearching: false })
        return results
      }

      // Fallback: if no IPC handler exists yet, return empty results
      set({ isSearching: false, lastResults: [] })
      return []
    } catch (err) {
      console.error('[WebSearchStore] Search failed:', err)
      set({ isSearching: false, lastResults: [] })
      throw err
    }
  }
}))
