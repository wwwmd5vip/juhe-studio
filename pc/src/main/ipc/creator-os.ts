/**
 * Creator OS IPC Handlers
 * Registers ipcMain.handle for all creator-os domain channels:
 *   project:*, asset:*, product-set:*, deliverable:*
 */
import { app, ipcMain } from 'electron'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { assets, deliverables } from '../db/schema'
import type { Asset, Deliverable } from '@shared/types/creator-os'
import { filterAllowed } from '@shared/utils/json-utils'
import { importAsset } from '../services/creator-os/assets'

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

// ── Deliverable IPC (basic — project + product-set are Phase 3-5) ──

ipcMain.handle('deliverable:list', async (_event, projectId: string) => {
  return db.select().from(deliverables).where(eq(deliverables.projectId, projectId))
})

export function registerCreatorOsIpc() {
  console.log('[IPC] Creator OS handlers registered')
}
