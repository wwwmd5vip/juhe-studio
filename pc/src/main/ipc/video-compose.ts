/**
 * Video Compose IPC — FFmpeg 视频合成桥接。
 */

import { ipcMain, BrowserWindow } from 'electron'
import { executeCompose, parseVideoDuration } from '../services/ffmpeg-pipeline'
import { detectFFmpeg } from '../services/ffmpeg-detect'
import type { ComposeRequest, ComposeProgress } from '@shared/types/ffmpeg'

let mainWindow: BrowserWindow | null = null

export function setVideoComposeWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function registerVideoComposeIpc(): void {
  // 检测 FFmpeg 可用性
  ipcMain.handle('ffmpeg:detect', async () => {
    return detectFFmpeg()
  })

  // 执行视频合成
  ipcMain.handle('ffmpeg:compose', async (_event, req: ComposeRequest) => {
    try {
      const result = await executeCompose(req, (progress: ComposeProgress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ffmpeg:progress', progress)
        }
      })
      return result
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // 解析视频时长
  ipcMain.handle('ffmpeg:duration', async (_event, filePath: string) => {
    return parseVideoDuration(filePath)
  })
}
