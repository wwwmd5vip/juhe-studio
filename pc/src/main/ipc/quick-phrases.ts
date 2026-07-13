/**
 * Quick Phrases IPC
 * 聊天快捷短语系统 - 用于快速插入常用提示词
 */

import { desc, eq, like } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { db } from '../db'
import { quickPhrases } from '../db/schema'

export interface QuickPhrase {
  id: string
  title: string
  content: string
  isFavorite?: boolean
  orderKey?: number
  createdAt: string
  updatedAt: string
}

export function registerQuickPhrasesIpc() {
  // 获取所有快捷短语
  ipcMain.handle('quick-phrases:list', async () => {
    try {
      const result = await db
        .select()
        .from(quickPhrases)
        .orderBy(desc(quickPhrases.orderKey), desc(quickPhrases.updatedAt))
      return result
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 创建快捷短语
  ipcMain.handle('quick-phrases:create', async (_event, data: { title: string; content: string }) => {
    try {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await db.insert(quickPhrases).values({
        id,
        title: data.title,
        content: data.content,
        orderKey: Date.now(),
        createdAt: now,
        updatedAt: now
      })
      return { id, title: data.title, content: data.content, createdAt: now, updatedAt: now }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 更新快捷短语
  ipcMain.handle(
    'quick-phrases:update',
    async (_event, id: string, data: Partial<{ title: string; content: string; isFavorite: boolean }>) => {
      try {
        const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
        if (data.title !== undefined) update.title = data.title
        if (data.content !== undefined) update.content = data.content
        if (data.isFavorite !== undefined) update.isFavorite = data.isFavorite
        await db.update(quickPhrases).set(update).where(eq(quickPhrases.id, id))
        return true
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  // 删除快捷短语
  ipcMain.handle('quick-phrases:delete', async (_event, id: string) => {
    try {
      await db.delete(quickPhrases).where(eq(quickPhrases.id, id))
      return true
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 搜索快捷短语
  ipcMain.handle('quick-phrases:search', async (_event, query: string) => {
    try {
      const escaped = query.replace(/[%_]/g, '\\$&')
      const result = await db
        .select()
        .from(quickPhrases)
        .where(like(quickPhrases.title, `%${escaped}%`))
        .orderBy(desc(quickPhrases.orderKey))
      return result
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
