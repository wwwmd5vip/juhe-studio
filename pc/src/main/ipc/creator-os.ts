/**
 * Creator OS IPC Handlers
 * Registers ipcMain.handle for all creator-os domain channels:
 *   project:*, asset:*, product-set:*, deliverable:*
 */
import { app, ipcMain } from 'electron'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { assets } from '../db/schema'
import type { Asset, Project } from '@shared/types/creator-os'
import type { GenerationParams } from '@shared/types/generation'
import { filterAllowed } from '@shared/utils/json-utils'
import { importAsset } from '../services/creator-os/assets'
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject
} from '../services/creator-os/projects'
import { updateDeliverable, getDeliverablesForProject } from '../services/creator-os/deliverables'
import {
  cancelProductSet,
  getBatchStatus,
  retryProductSetItems,
  submitProductSet,
  submitProductSetWithParams
} from '../services/creator-os/product-set'
import { exportAssets } from '../services/creator-os/export'

// ── Asset IPC ──

ipcMain.handle('asset:import', async (_event, projectId: string, sourcePath: string) => {
  if (typeof projectId !== 'string' || projectId.length === 0) throw new Error('Invalid projectId')
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) throw new Error('Invalid sourcePath')
  const assetsRoot = `${app.getPath('userData')}/assets`
  return importAsset(projectId, sourcePath, assetsRoot)
})

ipcMain.handle('asset:list', async (_event, projectId: string, filter?: { kind?: string }) => {
  const conditions = [eq(assets.projectId, projectId)]
  if (filter?.kind) conditions.push(eq(assets.kind, filter.kind as Asset['kind']))
  return db.select().from(assets).where(and(...conditions))
})

ipcMain.handle('asset:delete', async (_event, assetId: string) => {
  await db.delete(assets).where(eq(assets.id, assetId))
  return true
})

// ── Project IPC ──

ipcMain.handle('project:create', async (_event, data: Record<string, unknown>) => {
  const filtered = filterAllowed(data, ['name', 'category', 'description', 'status'])
  return createProject(filtered as Partial<Project>)
})

ipcMain.handle('project:list', async () => listProjects())

ipcMain.handle('project:get', async (_event, id: string) => getProject(id))

ipcMain.handle('project:update', async (_event, id: string, data: Record<string, unknown>) => {
  const filtered = filterAllowed(data, ['name', 'category', 'description', 'status'])
  return updateProject(id, filtered)
})

ipcMain.handle('project:delete', async (_event, id: string) => {
  await deleteProject(id)
  return true
})

// ── Deliverable IPC ──

ipcMain.handle('deliverable:list', async (_event, projectId: string) => {
  return getDeliverablesForProject(projectId)
})

ipcMain.handle('deliverable:update', async (_event, id: string, data: Record<string, unknown>) => {
  const filtered = filterAllowed(data, ['label', 'isSelected', 'sortOrder'])
  await updateDeliverable(id, filtered)
  return true
})

// ── Product Set IPC ──

ipcMain.handle('product-set:submit', async (_event, projectId: string, templateId: string) => {
  return submitProductSet(projectId, templateId)
})

ipcMain.handle(
  'product-set:submitWithParams',
  async (_event, projectId: string, slotParams: Record<string, unknown>) => {
    return submitProductSetWithParams(projectId, slotParams as Record<string, GenerationParams>)
  }
)

ipcMain.handle('product-set:status', async (_event, projectId: string) => {
  return getBatchStatus(projectId)
})

ipcMain.handle('product-set:retry', async (_event, projectId: string, taskIds: string[]) => {
  return retryProductSetItems(projectId, taskIds)
})

ipcMain.handle('product-set:cancel', async (_event, projectId: string) => {
  return cancelProductSet(projectId)
})

// ── Export IPC ──

ipcMain.handle('deliverable:export', async (_event, projectId: string, outputDir: string) => {
  return exportAssets(projectId, outputDir)
})

export function registerCreatorOsIpc() {
  console.log('[IPC] Creator OS handlers registered')
}
