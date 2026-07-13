import { JuheClient } from '@juhe-management/client'
import type { PromptListFilters } from '@shared/types/prompts'
import { ipcMain } from 'electron'
import { fetchPrompt, fetchPrompts } from '../services/prompts-service'
import store, { getJuheBaseUrl } from '../stores/config'

function getApiKey(): string {
  const k = store.get('auth.apiKey')
  if (typeof k === 'string' && k.length > 0 && !k.includes('*')) return k
  throw new Error('No API key available')
}

function makeRelayClient(): JuheClient {
  return new JuheClient({ baseURL: getJuheBaseUrl(), apiKey: getApiKey(), timeout: 30000 })
}

export function registerPromptLibraryIpc(): void {
  ipcMain.handle('prompt-library:list', async (_event, filters: PromptListFilters = {}) => {
    const start = Date.now()
    try {
      const result = await fetchPrompts(filters)
      console.log(`[IPC:prompt-library:list] ✅ fetched ${result.data.length} prompts in ${Date.now() - start}ms`)
      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn(`[IPC:prompt-library:list] ⚠️ Failed after ${Date.now() - start}ms:`, errMsg)
      console.warn('[IPC:prompt-library:list]    Hint: Ensure you are logged in and the Juhe Management server is reachable at', getJuheBaseUrl())
      throw new Error(errMsg)
    }
  })

  ipcMain.handle('prompt-library:get', async (_event, id: number) => {
    const start = Date.now()
    try {
      const result = await fetchPrompt(id)
      console.log(`[IPC:prompt-library:get] ⏱️ fetched in ${Date.now() - start}ms`)
      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(`[IPC:prompt-library:get] ⏱️ Failed after ${Date.now() - start}ms:`, errMsg)
      throw new Error(errMsg)
    }
  })

  ipcMain.handle('prompt-library:categories', async (_event, type: 'image' | 'agent' | 'package' = 'image') => {
    const start = Date.now()
    try {
      const client = makeRelayClient()
      const result = await client.listPromptCategories(type)
      console.log(`[IPC:prompt-library:categories] ⏱️ fetched in ${Date.now() - start}ms`)
      return { data: result.data, pagination: result.pagination }
    } catch (error) {
      console.error(`[IPC:prompt-library:categories] ⏱️ Failed after ${Date.now() - start}ms:`, error)
      return { data: [], pagination: { page: 1, page_size: 0, total: 0, total_pages: 0 } }
    }
  })
}
