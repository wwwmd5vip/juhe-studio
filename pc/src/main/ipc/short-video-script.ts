/**
 * 短视频脚本引擎 IPC
 */
import { ipcMain } from 'electron'
import { generateVideoScript } from '../services/short-video/script-generator'
import type { ScriptGenerateRequest } from '@shared/short-video/types'

export function registerShortVideoScriptIpc(): void {
  ipcMain.handle(
    'short-video:generate-script',
    async (_event, req: ScriptGenerateRequest) => {
      return generateVideoScript(req)
    }
  )
}
