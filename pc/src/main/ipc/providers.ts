/**
 * Provider IPC Handlers
 * 处理 Provider 连接测试、模型拉取等高级操作
 * API keys are encrypted before storage and decrypted when used
 *
 * 参考 cherry-studio 的实现：
 * - 支持系统代理 (HTTP_PROXY/HTTPS_PROXY/SOCKS_PROXY)
 * - 使用 Node.js 内置 https 模块 + 代理支持
 * - 增强错误分类和友好提示
 */

import { generateText } from '@cherrystudio/ai-core'
import {
  DEFAULT_MODELS_BY_PRESET as DEFAULT_TEST_MODELS_BY_PRESET,
  DEFAULT_TEST_MODELS_BY_NAME,
  ENDPOINT_TO_PROVIDER
} from '@shared/constants/provider-mapping'
import type { ConnectionTestResult, FetchModelsResult } from '@shared/types/provider'
import { errorMessage, getFriendlyErrorMessage } from '@shared/utils/error-classifier'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import { getPresetByBaseUrl, getPresetById } from '@shared/utils/provider-presets'
import { eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { db } from '../db'
import { models, providers } from '../db/schema'
import { decryptApiKey } from '../services/secure-storage'

// ===== 代理支持 =====
// 检测系统代理环境变量
function _getProxyUrl(): string | undefined {
  return (
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    undefined
  )
}

/**
 * 使用 Node.js 内置模块发起支持代理的 HTTP 请求
 * 回退到标准 fetch（Node.js 22+ 内置 fetch 支持 HTTP_PROXY 环境变量）
 */
async function fetchWithProxy(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options

  // Node.js 22+ 的 fetch 会自动读取 HTTP_PROXY/HTTPS_PROXY 环境变量
  // 所以只需要设置超时即可
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

function getTestModel(provider: typeof providers.$inferSelect): string | undefined {
  // 1. Explicit presetId takes highest priority
  if (provider.presetId && DEFAULT_TEST_MODELS_BY_PRESET[provider.presetId]) {
    return DEFAULT_TEST_MODELS_BY_PRESET[provider.presetId]
  }

  // 2. Try to infer preset from base URL for legacy providers
  const matched = provider.baseUrl ? getPresetByBaseUrl(provider.baseUrl) : undefined
  if (matched && DEFAULT_TEST_MODELS_BY_PRESET[matched.id]) {
    return DEFAULT_TEST_MODELS_BY_PRESET[matched.id]
  }

  // 3. Fallback to name-based matching
  return DEFAULT_TEST_MODELS_BY_NAME[provider.name]
}

/**
 * Decrypt API key from provider record for internal use only.
 * Never send decrypted keys to the renderer.
 */
function getDecryptedApiKey(provider: typeof providers.$inferSelect): string | undefined {
  if (!provider.apiKey) return undefined
  try {
    return decryptApiKey(provider.apiKey)
  } catch {
    return undefined
  }
}

function getModelCapabilities(modelId: string, type?: string | null, capabilities?: string[] | null) {
  return resolveModelCapabilities({
    name: modelId,
    type,
    capabilities
  })
}

/**
 * Sync models for a provider: delete all existing models and re-insert from the provided list.
 * Preserves existing model parameters, isEnabled state, and IDs where possible.
 */
async function syncModelsForProvider(
  providerId: string,
  remoteModels: Array<{ id: string; name: string; type: 'image' | 'video' | 'llm' }>
): Promise<{ added: number; updated: number }> {
  let added = 0
  let updated = 0

  await db.transaction(async (tx) => {
    const existingModels = await tx.select().from(models).where(eq(models.providerId, providerId))
    const existingByName = new Map<string, (typeof existingModels)[number]>()
    for (const m of existingModels) {
      if (!existingByName.has(m.name)) existingByName.set(m.name, m)
    }

    // 清空旧模型，用最新列表替换
    await tx.delete(models).where(eq(models.providerId, providerId))

    for (const m of remoteModels) {
      const caps = getModelCapabilities(m.id, m.type)
      const existing = existingByName.get(m.id)
      await tx.insert(models).values({
        id: existing?.id ?? crypto.randomUUID(),
        providerId,
        name: m.id,
        displayName: m.name,
        type: m.type,
        capabilities: caps,
        parameters: existing?.parameters ?? null,
        isEnabled: existing?.isEnabled ?? true,
        createdAt: existing?.createdAt ?? new Date().toISOString()
      })
      if (existing) updated++
      else added++
    }
  })

  return { added, updated }
}

export function registerProviderIpc() {
  // 测试 Provider 连接
  ipcMain.handle('provider:test-connection', async (_event, providerId: string): Promise<ConnectionTestResult> => {
    const startTime = Date.now()

    try {
      const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)
      const provider = result[0]

      if (!provider) {
        return { success: false, message: 'Provider not found' }
      }

      const testModel = getTestModel(provider)
      const apiKey = getDecryptedApiKey(provider)

      // ===== 特殊处理：Jimeng 即梦 =====
      // 火山引擎视觉 API 不支持标准 OpenAI /chat/completions，
      // 使用 submitTask 做轻量级连通性测试
      if (provider.presetId === 'jimeng') {
        const { getProviderCredentials } = await import('../services/jimeng-generation')
        const creds = await getProviderCredentials(providerId)
        if (!creds) {
          return {
            success: false,
            message: 'Jimeng API credentials not configured. Please set Access Key ID and Secret Access Key.'
          }
        }
        const latency = Date.now() - startTime
        return {
          success: true,
          message: `Jimeng credentials configured (${latency}ms)`,
          latency
        }
      }

      // ===== 特殊处理：Aliyun 阿里云百炼 =====
      // 图像/视频模型不支持标准 /chat/completions 测试
      if (provider.presetId === 'aliyun') {
        const apiKey = getDecryptedApiKey(provider)
        if (!apiKey) {
          return {
            success: false,
            message: 'Aliyun API key not configured. Please set your DashScope API Key.'
          }
        }
        // 尝试调用 /models 端点验证连接
        const modelsUrl = provider.baseUrl ? `${provider.baseUrl.replace(/\/$/, '')}/models` : null
        if (modelsUrl) {
          const res = await fetchWithProxy(modelsUrl, {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 15000
          })
          if (!res.ok) {
            const body = await res.text().catch(() => '')
            throw new Error(`Aliyun returned ${res.status}: ${body || res.statusText}`)
          }
        }
        const latency = Date.now() - startTime
        return {
          success: true,
          message: `Aliyun connected successfully (${latency}ms)`,
          latency
        }
      }

      if (testModel && provider.type === 'openai-chat-completions' && provider.baseUrl) {
        // Direct HTTP test for OpenAI-compatible endpoints to avoid ai-core URL quirks
        const chatUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`
        const res = await fetchWithProxy(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: testModel,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1
          }),
          timeout: 15000
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`Provider returned ${res.status}: ${body || res.statusText}`)
        }
      } else if (testModel) {
        // Fallback to ai-core for non-OpenAI endpoint types
        const aiCoreProviderId = ENDPOINT_TO_PROVIDER[provider.type] || 'openai-compatible'
        const settings: Record<string, string> = {}
        if (apiKey) settings.apiKey = apiKey
        if (provider.baseUrl) settings.baseURL = provider.baseUrl
        await generateText(aiCoreProviderId as Parameters<typeof generateText>[0], settings as never, {
          model: testModel,
          messages: [{ role: 'user', content: 'Hi' }],
          maxOutputTokens: 1
        })
      } else {
        // 没有预设测试模型时，尝试调用 /models 端点验证连接
        const modelsUrl = provider.baseUrl ? `${provider.baseUrl.replace(/\/$/, '')}/models` : null
        if (!modelsUrl) {
          return {
            success: false,
            message: 'Provider base URL not configured'
          }
        }
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`
        const res = await fetchWithProxy(modelsUrl, { headers, timeout: 15000 })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`Provider returned ${res.status}: ${body || res.statusText}`)
        }
      }

      const latency = Date.now() - startTime

      return {
        success: true,
        message: `Connected successfully (${latency}ms)`,
        latency
      }
    } catch (error) {
      const latency = Date.now() - startTime
      // 使用 getFriendlyErrorMessage 获取中文友好错误信息
      const friendlyMessage = getFriendlyErrorMessage(error, `连接测试失败`)

      return {
        success: false,
        message: friendlyMessage,
        latency
      }
    }
  })

  // Aliyun 百炼内置模型列表（图像/视频模型不支持 /models 端点）
  const ALIYUN_IMAGE_MODELS = [
    { id: 'wan2.6-t2i', name: 'Wanxiang 2.6 T2I', type: 'image' as const },
    { id: 'wan2.5-t2i-preview', name: 'Wanxiang 2.5 T2I Preview', type: 'image' as const },
    { id: 'wan2.2-t2i-flash', name: 'Wanxiang 2.2 T2I Flash', type: 'image' as const },
    { id: 'wan2.2-t2i-plus', name: 'Wanxiang 2.2 T2I Plus', type: 'image' as const },
    { id: 'wanx2.1-t2i-turbo', name: 'Wanxiang 2.1 T2I Turbo', type: 'image' as const },
    { id: 'wanx2.1-t2i-plus', name: 'Wanxiang 2.1 T2I Plus', type: 'image' as const },
    { id: 'wanx2.0-t2i-turbo', name: 'Wanxiang 2.0 T2I Turbo', type: 'image' as const },
    { id: 'z-image-turbo', name: 'Z-Image Turbo', type: 'image' as const },
    { id: 'kling/kling-v3-image-generation', name: 'Kling V3 Image', type: 'image' as const },
    { id: 'kling/kling-v3-omni-image-generation', name: 'Kling V3 Omni Image', type: 'image' as const }
  ]

  const ALIYUN_VIDEO_MODELS = [
    { id: 'wan2.7-t2v', name: 'Wanxiang 2.7 T2V', type: 'video' as const },
    { id: 'wan2.7-i2v-2026-04-25', name: 'Wanxiang 2.7 I2V', type: 'video' as const },
    { id: 'vidu/viduq3-pro_text2video', name: 'Vidu Q3 Pro T2V', type: 'video' as const },
    { id: 'vidu/viduq3-turbo_text2video', name: 'Vidu Q3 Turbo T2V', type: 'video' as const },
    { id: 'vidu/viduq2_text2video', name: 'Vidu Q2 T2V', type: 'video' as const },
    { id: 'happyhorse-1.0-t2v', name: 'HappyHorse T2V', type: 'video' as const },
    { id: 'happyhorse-1.0-r2v', name: 'HappyHorse R2V', type: 'video' as const }
  ]

  // Jimeng 内置模型列表（动态从 preset 获取，避免模块加载顺序问题）
  function getJimengModels() {
    const preset = getPresetById('jimeng')
    return (preset?.defaultModels ?? []).map((m) => ({
      id: m.name,
      name: m.displayName,
      type: (m.capabilities?.includes('video') ? 'video' : 'image') as 'image' | 'video'
    }))
  }

  // 从 Provider 拉取模型列表
  ipcMain.handle('provider:fetch-models', async (_event, providerId: string): Promise<FetchModelsResult> => {
    try {
      const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)
      const provider = result[0]

      if (!provider) {
        throw new Error('Provider not found')
      }

      // ===== 特殊处理：Jimeng 即梦 =====
      // 火山引擎视觉 API 没有 /models 端点，使用内置模型列表
      if (provider.presetId === 'jimeng') {
        const jimengModels = getJimengModels()
        const { added, updated } = await syncModelsForProvider(providerId, jimengModels)

        return {
          providerId,
          models: jimengModels.map((m) => ({
            modelId: m.id,
            name: m.name,
            capabilities: getModelCapabilities(m.id, m.type)
          })),
          total: jimengModels.length,
          added,
          updated
        }
      }

      // ===== 特殊处理：Aliyun 阿里云百炼 =====
      // 图像/视频模型没有 /models 端点，使用内置模型列表
      if (provider.presetId === 'aliyun') {
        const allAliyunModels = [...ALIYUN_IMAGE_MODELS, ...ALIYUN_VIDEO_MODELS]
        const { added, updated } = await syncModelsForProvider(providerId, allAliyunModels)

        return {
          providerId,
          models: allAliyunModels.map((m) => ({
            modelId: m.id,
            name: m.name,
            capabilities: getModelCapabilities(m.id, m.type)
          })),
          total: allAliyunModels.length,
          added,
          updated
        }
      }

      // ===== 标准流程：调用 /models 端点 =====
      const modelsUrl = provider.baseUrl ? `${provider.baseUrl.replace(/\/$/, '')}/models` : null

      if (!modelsUrl) {
        throw new Error('Provider base URL not configured')
      }

      const headers: Record<string, string> = {
        Accept: 'application/json'
      }
      const apiKey = getDecryptedApiKey(provider)
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`
      }

      // 使用支持代理的 fetch，30 秒超时
      let response: Response
      try {
        response = await fetchWithProxy(modelsUrl, { headers, timeout: 30000 })
      } catch (fetchErr) {
        throw new Error(getFriendlyErrorMessage(fetchErr, `无法连接到 ${provider.name}`))
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        let errorMsg = `服务器返回 ${response.status} ${response.statusText}`
        if (body) {
          // 尝试解析 JSON 错误
          try {
            const errJson = JSON.parse(body)
            errorMsg = errJson.error?.message || errJson.message || errorMsg
          } catch {
            errorMsg = body.slice(0, 200) || errorMsg
          }
        }
        throw new Error(errorMsg)
      }

      let data: {
        data?: Array<{
          id: string
          name?: string
          object?: string
          type?: string
        }>
      }
      try {
        data = await response.json()
      } catch {
        throw new Error('服务器返回的数据不是有效的 JSON 格式')
      }

      const remoteModels = data.data || []
      const chatModels = remoteModels.filter((m) => !m.object || m.object === 'model')

      // 获取现有模型（按 name 保留第一条，用于保留 isEnabled 等用户设置）
      const modelsToSync = chatModels.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        type: 'llm' as const
      }))
      const { added, updated } = await syncModelsForProvider(providerId, modelsToSync)

      return {
        providerId,
        models: chatModels.map((m) => ({
          modelId: m.id,
          name: m.name || m.id,
          capabilities: getModelCapabilities(m.id, m.type)
        })),
        total: chatModels.length,
        added,
        updated
      }
    } catch (error) {
      const message = errorMessage(error)
      // 如果已经是分类过的中文错误，直接抛出；否则包装
      if (message.includes('：') || message.includes('请检查')) {
        throw new Error(message)
      }
      throw new Error(getFriendlyErrorMessage(error, `拉取模型列表失败`))
    }
  })
}
