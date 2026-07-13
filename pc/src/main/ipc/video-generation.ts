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

export function registerVideoGenerationIpc() {
  ipcMain.handle('video-generation:create', async (_event, req) => {
    // This feature is not yet implemented. Return an error instead of fake data.
    console.warn('[VideoGeneration] Not yet implemented', req)
    return { error: 'Video generation is not yet available' }
  })

  ipcMain.handle('video-generation:cancel', async (_event, taskId: string) => {
    return { taskId, cancelled: true }
  })

  ipcMain.handle('video-generation:modelscope', async (_event, req) => {
    console.warn('[VideoGeneration:Modelscope] Not yet implemented', req)
    return { error: 'Modelscope video generation is not yet available' }
  })
}
