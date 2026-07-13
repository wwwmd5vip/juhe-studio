import { ipcMain } from 'electron'
import { encryptApiKey } from '../services/secure-storage'
import { webSearchService } from '../services/websearch'

export function registerWebSearchIpc() {
  // Search keywords
  ipcMain.handle('websearch:search', async (_event, query: string, providerId?: string) => {
    try {
      const result = await webSearchService.searchKeywords(query, providerId)
      return result
    } catch (error) {
      console.error('[WebSearch] Search failed:', error)
      throw error
    }
  })

  // List configured providers
  ipcMain.handle('websearch:providers:list', async () => {
    try {
      const providers = await webSearchService.listProviders()
      // Mask API keys - never expose them to renderer
      return providers.map((p) => ({
        ...p,
        apiKey: p.apiKey ? '***' : undefined
      }))
    } catch (error) {
      console.error('[WebSearch] Failed to list providers:', error)
      return []
    }
  })

  // Create provider
  ipcMain.handle('websearch:providers:create', async (_event, data: Record<string, unknown>) => {
    try {
      const payload = { ...data }
      // Encrypt API key before storing
      if (typeof payload.apiKey === 'string' && payload.apiKey.length > 0) {
        payload.apiKey = encryptApiKey(payload.apiKey)
      }

      const provider = await webSearchService.createProvider(
        payload as Parameters<typeof webSearchService.createProvider>[0]
      )
      // Return with masked API key
      return { ...provider, apiKey: provider.apiKey ? '***' : undefined }
    } catch (error) {
      console.error('[WebSearch] Failed to create provider:', error)
      throw error
    }
  })

  // Update provider
  ipcMain.handle('websearch:providers:update', async (_event, id: string, data: Record<string, unknown>) => {
    try {
      const payload = { ...data }
      // Encrypt API key if provided and not masked
      if (typeof payload.apiKey === 'string' && payload.apiKey.length > 0 && payload.apiKey !== '***') {
        payload.apiKey = encryptApiKey(payload.apiKey)
      } else if (payload.apiKey === '***') {
        // Remove masked placeholder so we don't overwrite the existing key
        delete payload.apiKey
      }

      await webSearchService.updateProvider(id, payload as Parameters<typeof webSearchService.updateProvider>[1])
      return true
    } catch (error) {
      console.error('[WebSearch] Failed to update provider:', error)
      throw error
    }
  })

  // Delete provider
  ipcMain.handle('websearch:providers:delete', async (_event, id: string) => {
    try {
      await webSearchService.deleteProvider(id)
      return true
    } catch (error) {
      console.error('[WebSearch] Failed to delete provider:', error)
      throw error
    }
  })
}
