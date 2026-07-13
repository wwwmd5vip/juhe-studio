/**
 * Juhe Management 提示词 IPC Handlers
 * 通过 JuheClient SDK 对接后端提示词接口（中继端 /v1）
 */

import { JuheClient } from '@juhe-management/client'
import { ipcMain } from 'electron'
import { syncJuheModels } from '../services/model-sync'
import store, { getJuheBaseUrl } from '../stores/config'

function getToken(): string | null {
  try {
    const t = store.get('auth.jwtToken')
    return typeof t === 'string' && t.length > 0 ? t : null
  } catch {
    return null
  }
}

function getApiKey(): string | null {
  try {
    const k = store.get('auth.apiKey')
    return typeof k === 'string' && k.length > 0 && !k.includes('*') ? k : null
  } catch {
    return null
  }
}

function makeRelayClient(): JuheClient {
  const baseURL = getJuheBaseUrl()
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('No API key available. Please login to Juhe Management first.')
  }
  return new JuheClient({ baseURL, apiKey, timeout: 30000 })
}

function ok<T>(data?: T) {
  return { success: true, data }
}
function fail(error: string) {
  return { success: false, error }
}

export function registerJuhePromptsIpc() {
  console.log('[JuhePrompts] Registering IPC handlers...')

  /** 列出已发布的提示词（中继端） */
  ipcMain.handle(
    'juhe-prompts:list',
    async (
      _e,
      params: {
        type?: 'image' | 'agent' | 'package'
        page?: number
        page_size?: number
        category_id?: number
        tag?: string
        keyword?: string
      } = {}
    ) => {
      try {
        const client = makeRelayClient()
        const result = await client.listPrompts(params.type ?? 'image', {
          page: params.page ?? 1,
          page_size: params.page_size ?? 20,
          category_id: params.category_id,
          tag: params.tag,
          keyword: params.keyword
        })
        return ok(result)
      } catch (err) {
        return fail(err instanceof Error ? err.message : 'Failed to list prompts')
      }
    }
  )

  /** 获取单个提示词详情（含 content） */
  ipcMain.handle('juhe-prompts:get', async (_e, id: number) => {
    try {
      const client = makeRelayClient()
      const prompt = await client.getPrompt(id)
      return ok(prompt)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed to get prompt')
    }
  })

  /** 渲染提示词（Mustache 变量替换） */
  ipcMain.handle(
    'juhe-prompts:render',
    async (
      _e,
      params: {
        id: number
        variables: Record<string, string>
      }
    ) => {
      try {
        const client = makeRelayClient()
        const content = await client.renderPrompt(params.id, params.variables ?? {})
        return ok({ content })
      } catch (err) {
        return fail(err instanceof Error ? err.message : 'Failed to render prompt')
      }
    }
  )

  /** 渲染封装功能提示词（package） */
  ipcMain.handle(
    'juhe-prompts:renderPackage',
    async (
      _e,
      params: {
        id: number
        variables: Record<string, string>
      }
    ) => {
      try {
        const client = makeRelayClient()
        const results = await client.renderPackage(params.id, params.variables ?? {})
        return ok(results)
      } catch (err) {
        return fail(err instanceof Error ? err.message : 'Failed to render package')
      }
    }
  )

  /** 获取 API Key 状态（用于判断是否已连接） */
  ipcMain.handle('juhe-prompts:status', async () => {
    try {
      const jwt = getToken()
      const apiKey = getApiKey()
      const baseUrl = getJuheBaseUrl()
      return ok({
        connected: !!(jwt && apiKey),
        baseUrl,
        hasKey: !!apiKey
      })
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  /** 尝试同步模型并获取 API Key（登录后首次调用） */
  ipcMain.handle('juhe-prompts:ensureKey', async () => {
    try {
      const result = await syncJuheModels()
      const apiKey = getApiKey()
      return ok({ synced: result.synced, hasKey: !!apiKey })
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed to sync')
    }
  })
}
