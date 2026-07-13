import { is } from '@electron-toolkit/utils'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export function initUpdater(): void {
  // Register stub handlers in development so renderer doesn't crash
  if (is.dev) {
    console.log('[Updater] Skipped in development mode')
    ipcMain.handle('updater:check', async () => ({ success: false, error: 'Not available in development' }))
    ipcMain.handle('updater:download', async () => ({ success: false, error: 'Not available in development' }))
    ipcMain.handle('updater:install', () => {})
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for update...')
    notifyRenderer('checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version)
    notifyRenderer('available', info)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No update available')
    notifyRenderer('not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log('[Updater] Download progress:', progress.percent)
    notifyRenderer('progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded')
    notifyRenderer('downloaded', info)

    dialog
      .showMessageBox({
        type: 'info',
        title: '更新就绪',
        message: `新版本 ${info.version} 已下载完成，是否现在安装？`,
        buttons: ['立即安装', '稍后']
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err)
    notifyRenderer('error', { message: err.message })
  })

  // IPC handlers for renderer to trigger updater actions
  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })
}

function notifyRenderer(status: string, data?: unknown) {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('updater:status', { status, data })
  }
}

export function checkForUpdates(): void {
  if (is.dev) return
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Updater] Check failed:', err)
  })
}
