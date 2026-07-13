/**
 * Skills IPC
 * Skill management system - CRUD and markdown parsing for SKILL.md files
 */

import { desc, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import matter from 'gray-matter'
import { db } from '../db'
import { skills } from '../db/schema'

export interface Skill {
  id: string
  name: string
  title: string
  description?: string
  content: string
  category?: string
  isEnabled?: boolean
  isBuiltin?: boolean
  metadata?: Record<string, unknown>
  icon?: string
  orderKey?: number
  createdAt: string
  updatedAt: string
}

export interface SkillCreateData {
  name: string
  title: string
  description?: string
  content: string
  category?: string
  icon?: string
  metadata?: Record<string, unknown>
}

export interface ParsedSkillMarkdown {
  content: string
  data: Record<string, unknown>
}

export function registerSkillsIpc() {
  // List all skills
  ipcMain.handle('skills:list', async () => {
    try {
      const result = await db.select().from(skills).orderBy(desc(skills.orderKey), desc(skills.updatedAt))
      return result
    } catch (error) {
      console.error('[Skills] Failed to list skills:', error)
      return []
    }
  })

  // Get skill by id
  ipcMain.handle('skills:get', async (_event, id: string) => {
    try {
      const result = await db.select().from(skills).where(eq(skills.id, id)).limit(1)
      return result[0] ?? null
    } catch (error) {
      console.error('[Skills] Failed to get skill:', error)
      return null
    }
  })

  // Create skill
  ipcMain.handle('skills:create', async (_event, data: SkillCreateData) => {
    try {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const result = await db
        .insert(skills)
        .values({
          id,
          name: data.name,
          title: data.title,
          description: data.description ?? null,
          content: data.content,
          category: data.category ?? 'custom',
          isEnabled: true,
          isBuiltin: false,
          metadata: data.metadata ?? null,
          icon: data.icon ?? null,
          orderKey: Date.now(),
          createdAt: now,
          updatedAt: now
        })
        .returning()
      return result[0]
    } catch (error) {
      console.error('[Skills] Failed to create skill:', error)
      throw error
    }
  })

  // Update skill
  ipcMain.handle('skills:update', async (_event, id: string, data: Partial<Skill>) => {
    try {
      const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
      if (data.name !== undefined) update.name = data.name
      if (data.title !== undefined) update.title = data.title
      if (data.description !== undefined) update.description = data.description
      if (data.content !== undefined) update.content = data.content
      if (data.category !== undefined) update.category = data.category
      if (data.isEnabled !== undefined) update.isEnabled = data.isEnabled
      if (data.isBuiltin !== undefined) update.isBuiltin = data.isBuiltin
      if (data.metadata !== undefined) update.metadata = data.metadata
      if (data.icon !== undefined) update.icon = data.icon
      if (data.orderKey !== undefined) update.orderKey = data.orderKey

      await db.update(skills).set(update).where(eq(skills.id, id))
      return true
    } catch (error) {
      console.error('[Skills] Failed to update skill:', error)
      throw error
    }
  })

  // Delete skill (only custom skills)
  ipcMain.handle('skills:delete', async (_event, id: string) => {
    try {
      const existing = await db.select().from(skills).where(eq(skills.id, id)).limit(1)

      if (existing.length === 0) {
        throw new Error('Skill not found')
      }

      if (existing[0].isBuiltin) {
        throw new Error('Cannot delete built-in skills')
      }

      await db.delete(skills).where(eq(skills.id, id))
      return true
    } catch (error) {
      console.error('[Skills] Failed to delete skill:', error)
      throw error
    }
  })

  // Toggle isEnabled
  ipcMain.handle('skills:toggle', async (_event, id: string) => {
    try {
      const existing = await db.select().from(skills).where(eq(skills.id, id)).limit(1)

      if (existing.length === 0) {
        throw new Error('Skill not found')
      }

      const newEnabled = !existing[0].isEnabled
      await db
        .update(skills)
        .set({ isEnabled: newEnabled, updatedAt: new Date().toISOString() })
        .where(eq(skills.id, id))
      return newEnabled
    } catch (error) {
      console.error('[Skills] Failed to toggle skill:', error)
      throw error
    }
  })

  // Parse SKILL.md content, extract YAML frontmatter
  ipcMain.handle('skills:parse-markdown', async (_event, markdown: string) => {
    try {
      const parsed = matter(markdown)
      return {
        content: parsed.content,
        data: parsed.data as Record<string, unknown>
      } as ParsedSkillMarkdown
    } catch (error) {
      console.error('[Skills] Failed to parse markdown:', error)
      throw error
    }
  })
}
