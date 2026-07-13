import { ipcMain } from 'electron'

let mainWindow: Electron.BrowserWindow | null = null

export function setMainWindow(win: Electron.BrowserWindow) {
  mainWindow = win
}

function pushNodeUpdate(
  nodeId: string,
  status: string,
  outputs?: { url?: string; base64?: string; mediaType?: string }[],
  error?: string
) {
  mainWindow?.webContents.send('workflow:node:update', { nodeId, status, outputs, error })
}

export function registerComfyIpc() {
  ipcMain.handle('comfy:run', async (_event, req) => {
    // This feature is not yet implemented. Return an error instead of fake data.
    console.warn('[ComfyUI] Not yet implemented', req)
    return { error: 'ComfyUI integration is not yet available' }
  })

  ipcMain.handle('comfy:cancel', async (_event, taskId: string) => {
    return { taskId, cancelled: true }
  })
}
