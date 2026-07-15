import { ipcMain } from 'electron'
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceStats,
  getUncategorizedCount
} from '../services/workspace-service'

export function registerWorkspaceIpc(): void {
  ipcMain.handle('workspace:list', () => listWorkspaces())
  ipcMain.handle('workspace:get', (_e, id: string) => getWorkspace(id))
  ipcMain.handle('workspace:create', (_e, data: Record<string, unknown>) =>
    createWorkspace(data as any)
  )
  ipcMain.handle('workspace:update', (_e, id: string, data: Record<string, unknown>) =>
    updateWorkspace(id, data as any)
  )
  ipcMain.handle('workspace:delete', (_e, id: string) => deleteWorkspace(id))
  ipcMain.handle('workspace:stats', (_e, id: string) => getWorkspaceStats(id))
  ipcMain.handle('workspace:uncategorized-count', () => getUncategorizedCount())
}
