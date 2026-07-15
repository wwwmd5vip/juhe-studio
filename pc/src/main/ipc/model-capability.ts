/**
 * 模型能力检测 IPC
 */
import { ipcMain } from 'electron'
import {
  detectModelCapabilities,
  detectMultipleModelCapabilities,
  clearCapabilityCache
} from '../services/model-capability-detector'

export function registerModelCapabilityIpc(): void {
  ipcMain.handle(
    'model-capability:detect',
    async (_event, modelId: string, providerId?: string) => {
      return detectModelCapabilities(modelId, providerId)
    }
  )

  ipcMain.handle(
    'model-capability:detect-multiple',
    async (_event, models: Array<{ modelId: string; providerId: string }>) => {
      const results = await detectMultipleModelCapabilities(models)
      return Array.from(results.entries()).map(([modelId, result]) => ({
        modelId,
        ...result
      }))
    }
  )

  ipcMain.handle('model-capability:clear-cache', async () => {
    clearCapabilityCache()
    return { ok: true }
  })
}
