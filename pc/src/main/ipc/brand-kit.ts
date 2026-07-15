/**
 * Brand Kit IPC — 品牌 Kit CRUD 桥接。
 */

import { ipcMain } from 'electron'
import {
  listBrandKits,
  getBrandKit,
  createBrandKit,
  updateBrandKit,
  deleteBrandKit,
  buildBrandPrompt
} from '../services/brand-kit'

export function registerBrandKitIpc(): void {
  ipcMain.handle('brand-kit:list', async () => {
    return listBrandKits()
  })

  ipcMain.handle('brand-kit:get', async (_event, id: string) => {
    return getBrandKit(id)
  })

  ipcMain.handle('brand-kit:create', async (_event, data: Record<string, unknown>) => {
    return createBrandKit(data as any)
  })

  ipcMain.handle('brand-kit:update', async (_event, id: string, data: Record<string, unknown>) => {
    return updateBrandKit(id, data as any)
  })

  ipcMain.handle('brand-kit:delete', async (_event, id: string) => {
    return deleteBrandKit(id)
  })

  ipcMain.handle('brand-kit:build-prompt', async (_event, id: string) => {
    const brand = await getBrandKit(id)
    return buildBrandPrompt(brand)
  })
}
