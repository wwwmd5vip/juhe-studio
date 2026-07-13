/**
 * Memory (MGP Lite) Store
 * Zustand state management for memories in renderer
 */

import type { Memory, MemoryCandidate, MemoryFilter, MemoryType, RecallIntent } from '@shared/types/memory'
import { create } from 'zustand'
import { createApiProxy } from '@/utils/api-proxy'

const api = createApiProxy()

interface MemoryState {
  memories: Memory[]
  isLoading: boolean
  error: string | null

  // CRUD
  writeMemory: (
    candidate: MemoryCandidate & { subjectId?: string; sourceType?: Memory['sourceType']; sourceId?: string }
  ) => Promise<Memory>
  searchMemory: (intent: RecallIntent) => Promise<Memory[]>
  getMemory: (id: string) => Promise<Memory | null>
  updateMemory: (id: string, patch: Partial<Memory>) => Promise<void>
  expireMemory: (id: string) => Promise<void>
  deleteMemory: (id: string) => Promise<void>
  listMemories: (filter?: MemoryFilter) => Promise<Memory[]>
  loadMemories: (filter?: MemoryFilter) => Promise<void>

  // Auto-extract from conversation
  extractFromMessage: (messageId: string, content: string) => Promise<void>

  // Get context for chat
  getMemoryContext: (sessionId?: string) => Promise<string>
}

// Simple regex-based extraction patterns for Chinese and English
const EXTRACTION_PATTERNS: Array<{
  type: MemoryType
  regex: RegExp
  extract: (match: RegExpMatchArray) => Record<string, unknown>
}> = [
  {
    type: 'preference',
    regex: /我(?:喜欢|偏好|习惯|爱|想|要|需要)(.+?)[。！\n]/g,
    extract: (match) => ({ statement: match[0].trim(), preference: match[1].trim() })
  },
  {
    type: 'preference',
    regex: /I (?:like|love|prefer|enjoy|want|need|hate|dislike) (.+?)[.!\n]/gi,
    extract: (match) => ({ statement: match[0].trim(), preference: match[1].trim() })
  },
  {
    type: 'profile',
    regex: /我(?:是|在|做|从事|来自)(.+?)[。！\n]/g,
    extract: (match) => ({ statement: match[0].trim(), profile: match[1].trim() })
  },
  {
    type: 'profile',
    regex: /I (?:am|work at|work for|live in|come from|study at) (.+?)[.!\n]/gi,
    extract: (match) => ({ statement: match[0].trim(), profile: match[1].trim() })
  },
  {
    type: 'semantic_fact',
    regex: /我(?:知道|了解|记得|学过|看过)(.+?)[。！\n]/g,
    extract: (match) => ({ statement: match[0].trim(), fact: match[1].trim() })
  },
  {
    type: 'semantic_fact',
    regex: /I (?:know|learned|read|saw|heard) (?:that )?(.+?)[.!\n]/gi,
    extract: (match) => ({ statement: match[0].trim(), fact: match[1].trim() })
  },
  {
    type: 'episodic_event',
    regex: /(?:昨天|今天|上周|上个月|去年|刚才|之前)(.+?)[。！\n]/g,
    extract: (match) => ({ statement: match[0].trim(), event: match[1].trim() })
  },
  {
    type: 'episodic_event',
    regex: /(?:yesterday|today|last week|last month|last year|just now|earlier) (.+?)[.!\n]/gi,
    extract: (match) => ({ statement: match[0].trim(), event: match[1].trim() })
  }
]

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  isLoading: false,
  error: null,

  writeMemory: async (candidate) => {
    set({ isLoading: true, error: null })
    try {
      const memory = await api.memory.write(candidate)
      set((state) => ({
        memories: [memory, ...state.memories.filter((m) => m.id !== memory.id)],
        isLoading: false
      }))
      return memory
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to write memory'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  searchMemory: async (intent) => {
    set({ isLoading: true, error: null })
    try {
      const results = await api.memory.search(intent)
      set({ isLoading: false })
      return results
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search memories'
      set({ error: message, isLoading: false })
      return []
    }
  },

  getMemory: async (id) => {
    try {
      return await api.memory.get(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get memory'
      set({ error: message })
      return null
    }
  },

  updateMemory: async (id, patch) => {
    set({ isLoading: true, error: null })
    try {
      await api.memory.update(id, patch)
      set((state) => ({
        memories: state.memories.map((m) =>
          m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
        ),
        isLoading: false
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update memory'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  expireMemory: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.memory.expire(id)
      set((state) => ({
        memories: state.memories.map((m) =>
          m.id === id ? { ...m, status: 'expired', updatedAt: new Date().toISOString() } : m
        ),
        isLoading: false
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to expire memory'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  deleteMemory: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.memory.delete(id)
      set((state) => ({
        memories: state.memories.map((m) =>
          m.id === id ? { ...m, status: 'deleted', updatedAt: new Date().toISOString() } : m
        ),
        isLoading: false
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete memory'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  listMemories: async (filter) => {
    set({ isLoading: true, error: null })
    try {
      const results = await api.memory.list(filter)
      set({ memories: results, isLoading: false })
      return results
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list memories'
      set({ error: message, isLoading: false })
      return []
    }
  },

  loadMemories: async (filter) => {
    set({ isLoading: true, error: null })
    try {
      const results = await api.memory.list(filter)
      set({ memories: results, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load memories'
      set({ error: message, isLoading: false })
    }
  },

  extractFromMessage: async (messageId, content) => {
    try {
      const candidates: Array<MemoryCandidate & { sourceType: Memory['sourceType']; sourceId: string }> = []

      for (const pattern of EXTRACTION_PATTERNS) {
        const matches = content.matchAll(pattern.regex)
        for (const match of matches) {
          const extracted = pattern.extract(match) as Record<string, string | undefined>
          // Skip very short extractions
          if (extracted.preference && extracted.preference.length < 3) continue
          if (extracted.profile && extracted.profile.length < 3) continue
          if (extracted.fact && extracted.fact.length < 3) continue
          if (extracted.event && extracted.event.length < 3) continue

          candidates.push({
            type: pattern.type,
            content: extracted,
            scope: 'user',
            confidence: 80,
            sourceType: 'chat',
            sourceId: messageId
          })
        }
      }

      // Deduplicate by content fingerprint
      const seen = new Set<string>()
      const uniqueCandidates = candidates.filter((c) => {
        const fingerprint = `${c.type}:${JSON.stringify(c.content)}`
        if (seen.has(fingerprint)) return false
        seen.add(fingerprint)
        return true
      })

      // Write all unique candidates
      for (const candidate of uniqueCandidates) {
        try {
          await get().writeMemory(candidate)
        } catch (err) {
          console.error('[MemoryStore] Failed to write extracted memory:', err)
        }
      }

      if (uniqueCandidates.length > 0) {
        console.log('[MemoryStore] Extracted', uniqueCandidates.length, 'memories from message', messageId)
      }
    } catch (err) {
      console.error('[MemoryStore] Failed to extract memories:', err)
    }
  },

  getMemoryContext: async (sessionId) => {
    try {
      const intent: RecallIntent = {
        types: ['preference', 'profile', 'semantic_fact'],
        scope: 'user'
      }

      const results = await get().searchMemory(intent)

      // Also get session-specific episodic memories
      if (sessionId) {
        const sessionResults = await get().searchMemory({
          types: ['episodic_event'],
          subjectId: sessionId
        })
        results.push(...sessionResults)
      }

      if (results.length === 0) return ''

      // Format memories as context string
      const lines: string[] = ['\n[用户记忆上下文]']

      const preferences = results.filter((m) => m.type === 'preference')
      const profiles = results.filter((m) => m.type === 'profile')
      const facts = results.filter((m) => m.type === 'semantic_fact')
      const events = results.filter((m) => m.type === 'episodic_event')

      if (profiles.length > 0) {
        lines.push('用户资料:')
        profiles.forEach((m) => {
          const text = m.content.statement || m.content.profile || JSON.stringify(m.content)
          lines.push(`  - ${text}`)
        })
      }

      if (preferences.length > 0) {
        lines.push('用户偏好:')
        preferences.forEach((m) => {
          const text = m.content.statement || m.content.preference || JSON.stringify(m.content)
          lines.push(`  - ${text}`)
        })
      }

      if (facts.length > 0) {
        lines.push('已知事实:')
        facts.forEach((m) => {
          const text = m.content.statement || m.content.fact || JSON.stringify(m.content)
          lines.push(`  - ${text}`)
        })
      }

      if (events.length > 0) {
        lines.push('会话事件:')
        events.slice(0, 5).forEach((m) => {
          const text = m.content.statement || m.content.event || JSON.stringify(m.content)
          lines.push(`  - ${text}`)
        })
      }

      lines.push('[用户记忆上下文结束]\n')

      return lines.join('\n')
    } catch (err) {
      console.error('[MemoryStore] Failed to get memory context:', err)
      return ''
    }
  }
}))
