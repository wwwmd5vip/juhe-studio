/**
 * Memory (MGP Lite) IPC Handlers
 * Memory management system - CRUD, search, and lifecycle
 */

import type { Memory, MemoryCandidate, MemoryFilter, RecallIntent } from '@shared/types/memory'
import { and, desc, eq, inArray, like, or } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { db } from '../db'
import { memories } from '../db/schema'

function parseContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return { raw: content }
  }
}

function serializeContent(content: Record<string, unknown>): string {
  return JSON.stringify(content)
}

function toMemory(row: typeof memories.$inferSelect): Memory {
  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectType: row.subjectType as 'user' | 'session',
    type: row.type as Memory['type'],
    content: parseContent(row.content),
    scope: row.scope as Memory['scope'],
    confidence: row.confidence ?? 100,
    status: row.status as Memory['status'],
    expiresAt: row.expiresAt ?? undefined,
    sourceType: row.sourceType as Memory['sourceType'],
    sourceId: row.sourceId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function registerMemoryIpc() {
  // Write memory (create or update by content fingerprint)
  ipcMain.handle(
    'memory:write',
    async (
      _event,
      candidate: MemoryCandidate & { subjectId?: string; sourceType?: Memory['sourceType']; sourceId?: string }
    ) => {
      try {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const subjectId = candidate.subjectId ?? 'user'
        const subjectType = 'user'
        const scope = candidate.scope ?? 'user'
        const confidence = candidate.confidence ?? 100
        const sourceType = candidate.sourceType ?? 'chat'

        // Check for existing active memory of same type with same content fingerprint
        const contentFingerprint = JSON.stringify(candidate.content)
        const existing = await db
          .select()
          .from(memories)
          .where(
            and(
              eq(memories.subjectId, subjectId),
              eq(memories.type, candidate.type),
              eq(memories.status, 'active'),
              eq(memories.content, contentFingerprint)
            )
          )
          .limit(1)

        if (existing.length > 0) {
          // Update existing memory (bump confidence, refresh updatedAt)
          const existingId = existing[0].id
          await db
            .update(memories)
            .set({
              confidence: Math.min(100, (existing[0].confidence ?? 100) + 5),
              updatedAt: now
            })
            .where(eq(memories.id, existingId))

          const updated = await db.select().from(memories).where(eq(memories.id, existingId)).limit(1)

          return toMemory(updated[0])
        }

        // Create new memory
        const result = await db
          .insert(memories)
          .values({
            id,
            subjectId,
            subjectType,
            type: candidate.type,
            content: serializeContent(candidate.content),
            scope,
            confidence,
            status: 'active',
            expiresAt: candidate.expiresAt ?? null,
            sourceType,
            sourceId: candidate.sourceId ?? null,
            createdAt: now,
            updatedAt: now
          })
          .returning()

        return toMemory(result[0])
      } catch (error) {
        console.error('[Memory] Failed to write memory:', error)
        throw error
      }
    }
  )

  // Search memories (full-text + filter)
  ipcMain.handle('memory:search', async (_event, intent: RecallIntent) => {
    try {
      const conditions = [eq(memories.status, 'active')]

      if (intent.types && intent.types.length > 0) {
        conditions.push(inArray(memories.type, intent.types))
      }
      if (intent.scope) {
        conditions.push(eq(memories.scope, intent.scope))
      }
      if (intent.subjectId) {
        conditions.push(eq(memories.subjectId, intent.subjectId))
      }
      if (intent.query) {
        // Escape SQL LIKE wildcards to prevent pattern injection
        const escaped = intent.query.replace(/[%_]/g, '\\$&')
        const contentLike = like(memories.content, `%${escaped}%`)
        const typeLike = like(memories.type, `%${escaped}%`)
        if (contentLike && typeLike) {
          const queryCondition = or(contentLike, typeLike)
          if (queryCondition) {
            conditions.push(queryCondition)
          }
        }
      }

      const result = await db
        .select()
        .from(memories)
        .where(and(...conditions))
        .orderBy(desc(memories.confidence), desc(memories.updatedAt))
        .limit(50)

      return result.map(toMemory)
    } catch (error) {
      console.error('[Memory] Failed to search memories:', error)
      return []
    }
  })

  // Get memory by id
  ipcMain.handle('memory:get', async (_event, id: string) => {
    try {
      const result = await db.select().from(memories).where(eq(memories.id, id)).limit(1)
      return result[0] ? toMemory(result[0]) : null
    } catch (error) {
      console.error('[Memory] Failed to get memory:', error)
      return null
    }
  })

  // Update memory patch
  ipcMain.handle('memory:update', async (_event, id: string, patch: Partial<Memory>) => {
    try {
      const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
      if (patch.content !== undefined) update.content = serializeContent(patch.content)
      if (patch.confidence !== undefined) update.confidence = patch.confidence
      if (patch.scope !== undefined) update.scope = patch.scope
      if (patch.status !== undefined) update.status = patch.status
      if (patch.expiresAt !== undefined) update.expiresAt = patch.expiresAt ?? null

      await db.update(memories).set(update).where(eq(memories.id, id))
      return true
    } catch (error) {
      console.error('[Memory] Failed to update memory:', error)
      throw error
    }
  })

  // Expire memory
  ipcMain.handle('memory:expire', async (_event, id: string) => {
    try {
      await db
        .update(memories)
        .set({ status: 'expired', updatedAt: new Date().toISOString() })
        .where(eq(memories.id, id))
      return true
    } catch (error) {
      console.error('[Memory] Failed to expire memory:', error)
      throw error
    }
  })

  // Delete memory (soft delete)
  ipcMain.handle('memory:delete', async (_event, id: string) => {
    try {
      await db
        .update(memories)
        .set({ status: 'deleted', updatedAt: new Date().toISOString() })
        .where(eq(memories.id, id))
      return true
    } catch (error) {
      console.error('[Memory] Failed to delete memory:', error)
      throw error
    }
  })

  // List memories with filters
  ipcMain.handle('memory:list', async (_event, filter?: MemoryFilter) => {
    try {
      const conditions = []

      if (filter?.status) {
        conditions.push(eq(memories.status, filter.status))
      } else {
        conditions.push(eq(memories.status, 'active'))
      }

      if (filter?.subjectId) {
        conditions.push(eq(memories.subjectId, filter.subjectId))
      }
      if (filter?.subjectType) {
        conditions.push(eq(memories.subjectType, filter.subjectType))
      }
      if (filter?.types && filter.types.length > 0) {
        conditions.push(inArray(memories.type, filter.types))
      }
      if (filter?.scope) {
        conditions.push(eq(memories.scope, filter.scope))
      }
      if (filter?.sourceType) {
        conditions.push(eq(memories.sourceType, filter.sourceType))
      }

      const result = await db
        .select()
        .from(memories)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(memories.updatedAt))
        .limit(filter?.limit ?? 100)
        .offset(filter?.offset ?? 0)

      return result.map(toMemory)
    } catch (error) {
      console.error('[Memory] Failed to list memories:', error)
      return []
    }
  })
}
