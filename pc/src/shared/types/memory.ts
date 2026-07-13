/**
 * Memory (MGP Lite) Type Definitions
 * Shared between main process, preload, and renderer
 */

export type MemoryType = 'preference' | 'profile' | 'episodic_event' | 'semantic_fact' | 'procedural_rule'
export type MemoryScope = 'user' | 'session' | 'global'
export type MemoryStatus = 'active' | 'expired' | 'deleted'
export type MemorySource = 'chat' | 'user' | 'system' | 'import'

export interface Memory {
  id: string
  subjectId: string
  subjectType: 'user' | 'session'
  type: MemoryType
  content: Record<string, unknown>
  scope: MemoryScope
  confidence: number
  status: MemoryStatus
  expiresAt?: string
  sourceType: MemorySource
  sourceId?: string
  createdAt: string
  updatedAt: string
}

export interface MemoryCandidate {
  type: MemoryType
  content: Record<string, unknown>
  scope?: MemoryScope
  confidence?: number
  expiresAt?: string
}

export interface RecallIntent {
  query?: string
  types?: MemoryType[]
  scope?: MemoryScope
  subjectId?: string
}

export interface MemoryFilter {
  subjectId?: string
  subjectType?: 'user' | 'session'
  types?: MemoryType[]
  scope?: MemoryScope
  status?: MemoryStatus
  sourceType?: MemorySource
  limit?: number
  offset?: number
}
