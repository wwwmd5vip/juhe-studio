/**
 * Quick Phrases Store
 * 聊天快捷短语状态管理
 */

import { create } from 'zustand'
import { createApiProxy } from '@/utils/api-proxy'

// 防御性代理 — preload 失败时给出清晰错误而非 "can't access property 'X', api is undefined"
const api = createApiProxy()

export interface QuickPhrase {
  id: string
  title: string
  content: string
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

interface QuickPhrasesState {
  phrases: QuickPhrase[]
  isLoading: boolean
  error: string | null

  loadPhrases: () => Promise<void>
  createPhrase: (title: string, content: string) => Promise<QuickPhrase | null>
  updatePhrase: (id: string, data: Partial<{ title: string; content: string; isFavorite: boolean }>) => Promise<void>
  deletePhrase: (id: string) => Promise<void>
  searchPhrases: (query: string) => Promise<QuickPhrase[]>
}

export const useQuickPhrasesStore = create<QuickPhrasesState>((set, get) => ({
  phrases: [],
  isLoading: false,
  error: null,

  loadPhrases: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.quickPhrases.list()
      set({ phrases: result, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load phrases'
      set({ error: message, isLoading: false })
    }
  },

  createPhrase: async (title, content) => {
    try {
      const phrase = await api.quickPhrases.create({ title, content })
      set((state) => ({ phrases: [phrase, ...state.phrases] }))
      return phrase
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create phrase'
      set({ error: message })
      return null
    }
  },

  updatePhrase: async (id, data) => {
    try {
      await api.quickPhrases.update(id, data)
      set((state) => ({
        phrases: state.phrases.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update phrase'
      set({ error: message })
    }
  },

  deletePhrase: async (id) => {
    try {
      await api.quickPhrases.delete(id)
      set((state) => ({
        phrases: state.phrases.filter((p) => p.id !== id)
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete phrase'
      set({ error: message })
    }
  },

  searchPhrases: async (query) => {
    if (!query.trim()) {
      return get().phrases
    }
    try {
      const result = await api.quickPhrases.search(query)
      return result
    } catch (_err) {
      return get().phrases.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()))
    }
  }
}))
