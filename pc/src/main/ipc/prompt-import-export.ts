/**
 * 提示词库双向导入/导出 — P2.4
 */
import { ipcMain, dialog } from 'electron'
import { writeFileSync, readFileSync } from 'node:fs'
import { db } from '../db'
import { promptTemplates } from '../db/schema'

export function registerPromptImportExportIpc(): void {
  // 导出：选中提示词导出为 JSON 文件
  ipcMain.handle('prompt:export', async (_event, promptIds: string[]) => {
    const results = await db
      .select()
      .from(promptTemplates)
      .where(
        promptIds.length > 0
          ? undefined // 需要 in operator，简化为取全部
          : undefined
      )

    // 按 ID 过滤
    const filtered = promptIds.length > 0
      ? results.filter((p) => promptIds.includes(p.id))
      : results

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      prompts: filtered.map((p) => ({
        name: p.name,
        category: p.category,
        content: p.content,
        description: p.description,
        tags: p.tags,
        aspectRatio: p.aspectRatio
      }))
    }

    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `prompts-export-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (filePath) {
      writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    }

    return { filePath, count: exportData.prompts.length }
  })

  // 导入：从 JSON 文件导入提示词
  ipcMain.handle('prompt:import', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!filePaths || filePaths.length === 0) return { imported: 0 }

    const raw = readFileSync(filePaths[0], 'utf-8')
    const data = JSON.parse(raw)

    const prompts = Array.isArray(data.prompts) ? data.prompts : Array.isArray(data) ? data : []
    const now = new Date().toISOString()
    let count = 0

    for (const p of prompts) {
      await db.insert(promptTemplates).values({
        id: crypto.randomUUID(),
        category: p.category || 'imported',
        name: p.name || 'Imported Prompt',
        content: p.content || '',
        description: p.description || null,
        tags: p.tags || null,
        aspectRatio: p.aspectRatio || null,
        createdAt: now,
        updatedAt: now
      })
      count++
    }

    return { imported: count }
  })
}
