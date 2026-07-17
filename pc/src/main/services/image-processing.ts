/**
 * 图像处理服务
 * M3 Phase 1: 图生图、局部重绘、Upscale、背景移除、扩图、变体
 */

import { generateImage } from '@cherrystudio/ai-core'
import { ENDPOINT_TO_PROVIDER } from '@shared/constants/provider-mapping'
import type { ImageProcessOutput, ImageProcessTask } from '@shared/types/image-processing'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { providers } from '../db/schema'
import { downloadImageAsBase64 } from './generation'
import { resolveUpstreamModelName } from './model-utils'

/**
 * 是否走"openai-compatible 图生图需要走 /images/generations 不能走 /images/edits"的特殊路径。
 *
 * AI SDK 的 OpenAICompatibleImageModel 在 prompt 含图片数组时统一路由到
 * /v1/images/edits（OpenAI 标准的 multipart/form-data edit endpoint）。
 * 但很多 openai-compatible 聚合中转（mxapi 类）只实现了 /v1/images/generations，
 * 把参考图作为 body.images 内联发送。
 *
 * 这里对 openai-chat-completions 走自定义 dispatch（/images/generations + 内联参考图），
 * 其他 provider 继续交给 ai-core（ai-core 自己决定的 endpoint 行为，依赖上游实现）。
 */
function shouldUseOpenAICompatibleRefPath(providerType: string): boolean {
  return providerType === 'openai-chat-completions'
}

interface DispatchImgRefGenParams {
  /** provider.type，决定走哪条路径 */
  providerType: string
  baseUrl: string
  apiKey: string
  modelId: string
  /** 上游 API 实际需要的模型名；若未提供，回退到 modelId */
  upstreamModelName?: string
  prompt: string
  /** data URL（含 base64），来自 task.sourceImage / maskImage */
  sourceImage: string
  maskImage?: string
  size?: string
  n?: number
}

/**
 * 与 ai-core.generateImage() 返回值兼容的最小子集：
 * parseOutputs() 只读 images[] / image，所以只需这两个字段形状。
 */
type AiCoreLikeResult = {
  images?: Array<{ base64: string; mediaType?: string }>
  image?: { base64: string; mediaType?: string }
}

async function dispatchImgRefGen(
  params: DispatchImgRefGenParams
): Promise<AiCoreLikeResult> {
  // 本地 model id（如 juhe-4）需映射为上游模型名（如 juhe-gpt-image-2），
  // 与文生图保持同一套解析逻辑。
  const upstreamModelName = await resolveUpstreamModelName(params.modelId)
  const paramsWithUpstream: DispatchImgRefGenParams = {
    ...params,
    upstreamModelName
  }

  if (shouldUseOpenAICompatibleRefPath(params.providerType)) {
    return runOpenAICompatibleRefGen(paramsWithUpstream)
  }
  // 其他 provider（含真实 OpenAI / Anthropic / Google 等）走 ai-core，
  // 它们自己的 /images/edits 端点是支持的。
  return runAiCoreRefGen(paramsWithUpstream)
}

/**
 * openai-compatible 路径：直接 POST /v1/images/generations，
 * reference images 走 body.images（mxapi 风格），这是聚合中转普遍实现的接口。
 */
async function runOpenAICompatibleRefGen(
  params: DispatchImgRefGenParams
): Promise<AiCoreLikeResult> {
  const url = `${params.baseUrl.replace(/\/$/, '')}/images/generations`
  const referenceImages = params.maskImage
    ? [params.sourceImage, params.maskImage]
    : [params.sourceImage]

  const body: Record<string, unknown> = {
    model: params.upstreamModelName ?? params.modelId,
    prompt: params.prompt,
    n: params.n ?? 1,
    response_format: 'b64_json',
    images: referenceImages,
    reference_mode: 'image-edit'
  }
  if (params.size) body.size = params.size

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw translateJuheError(response.status, text, params)
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>
    error?: { message?: string }
  }

  if (data.error?.message) {
    throw translateJuheError(response.status, JSON.stringify(data), params)
  }
  if (!data.data || data.data.length === 0) {
    throw new Error('上游没有返回图片数据')
  }

  const images: Array<{ base64: string; mediaType?: string }> = []
  for (const item of data.data) {
    if (item.b64_json) {
      let b64 = item.b64_json.trim()
      if (b64.startsWith('data:')) {
        const idx = b64.indexOf(',')
        if (idx !== -1) b64 = b64.slice(idx + 1)
      }
      b64 = b64.replace(/\s/g, '')
      images.push({ base64: b64, mediaType: 'image/png' })
    } else if (item.url) {
      // 复用我们已有的下载重试工具
      const b64 = await downloadImageAsBase64(item.url, undefined)
      images.push({ base64: b64, mediaType: 'image/png' })
    }
  }
  if (images.length === 0) {
    throw new Error('上游返回的图片数据无法解析（既无 b64_json 也无 url）')
  }
  return { images }
}

/**
 * 把上游 HTTP 500 + juhe_error JSON 翻译成对桌面用户直接可读的中文 actionable 错误。
 *
 * 上游 juhe-management 后端（`server/internal/relay/` 和 `server/internal/service/billing_service.go`）
 * 在以下场景会返回这种格式：
 *   - `no pricing configured for image generation`（admin 没给模型配 FixedPriceCents）
 *   - `no available channel for model and group`（admin 没给 (model, group) 配 channel，或都 disabled / auto-ban）
 *   - 其他 juhe_error 也大多是配置/路由类问题
 *
 * 桌面应用本身修不了这些（admin 后台运维范畴），但把"HTTP 500 一坨 JSON"
 * 翻译成"去看 admin 后台的 pricing 页面"能省下用户查源码的时间。
 */
function translateJuheError(
  status: number,
  rawBody: string,
  params: DispatchImgRefGenParams
): Error {
  const adminUrl = (() => {
    try {
      return new URL(params.baseUrl).origin
    } catch {
      return params.baseUrl
    }
  })()

  let json: { error?: { code?: string; message?: string; type?: string } } | null = null
  try {
    json = JSON.parse(rawBody)
  } catch {
    /* 非 JSON，原样抛 */
  }

  // 错误信息里只显示上游实际收到的模型名，避免暴露本地 modelId
  const modelLabel = params.upstreamModelName ?? params.modelId

  if (json?.error?.type === 'juhe_error' && json.error.message) {
    const raw = json.error.message
    const code = json.error.code || 'internal_error'

    // 常见错误模式 → 可读 actionable 提示
    if (raw.includes('no pricing configured for image generation')) {
      return new Error(
        `ERR_PROVIDER_NO_PRICING: provider 后端没有给模型「${modelLabel}」配置 image generation 定价。\n` +
          `请在 admin 后台（${adminUrl}）→ 渠道定价里给该渠道 × image 类型设置 FixedPriceCents。\n` +
          `原始上游错误：HTTP ${status} juhe_error(${code}) ${raw}`
      )
    }
    if (raw.includes('no available channel for model and group')) {
      return new Error(
        `ERR_PROVIDER_NO_CHANNEL: provider 后端没有可路由 (模型=${modelLabel}, 你的用户分组) 的可用渠道。\n` +
          `请到 admin 后台（${adminUrl}）检查：\n` +
          `  1) 该模型是否绑定了至少一个 status=1 且未 auto-ban 的渠道；\n` +
          `  2) 这些渠道是否覆盖了你的用户分组（group），或启用了 CrossGroupRetry。\n` +
          `原始上游错误：HTTP ${status} juhe_error(${code}) ${raw}`
      )
    }
    // 其他 juhe_error：透传 + 提示通用排查方向
    return new Error(
      `ERR_PROVIDER_REJECTED: 上游拒绝（${code}）：${raw}\n` +
        `这是 admin 后台配置/路由问题，请到 ${adminUrl} 排查。\n` +
        `（HTTP ${status}）`
    )
  }

  // 解析不了 juhe_error 格式 → 回退到原 HTTP 错误信息
  return new Error(`HTTP ${status} ${rawBody.slice(0, 200)}`)
}

/**
 * ai-core 路径：保留原有 ai-core.generateImage 行为。
 * 适用于真实 OpenAI / Anthropic / Google 等厂商——它们的 /images/edits 是正常实现的。
 */
async function runAiCoreRefGen(
  params: DispatchImgRefGenParams
): Promise<AiCoreLikeResult> {
  const providerId = ENDPOINT_TO_PROVIDER[params.providerType] || 'openai-compatible'
  const images: Array<string | undefined> = params.maskImage
    ? [params.sourceImage, params.maskImage]
    : [params.sourceImage]
  const aiCorePrompt = {
    text: params.prompt,
    images: images.filter(Boolean) as string[]
  }
  const settings: Record<string, string> = {
    apiKey: params.apiKey,
    baseURL: params.baseUrl
  }
  const result = await generateImage(
    providerId as Parameters<typeof generateImage>[0],
    settings as never,
    {
      model: params.upstreamModelName ?? params.modelId,
      prompt: aiCorePrompt as never,
      n: params.n ?? 1,
      size: params.size as never
    }
  )
  // result.images 是 ai-core 返回的 {base64, mediaType}[]；也可能是 result.image
  const out: Array<{ base64: string; mediaType?: string }> = []
  if (result.images && result.images.length > 0) {
    for (const img of result.images) {
      out.push({ base64: img.base64, mediaType: img.mediaType || 'image/png' })
    }
  } else if (result.image) {
    out.push({ base64: result.image.base64, mediaType: result.image.mediaType || 'image/png' })
  }
  return { images: out }
}

/**
 * 翻译 AI SDK 抛出的错误为对用户友好的可操作错误。
 *
 * 最常见的"误导性"错误是 404 + "Not Found"：AI SDK 的 OpenAICompatibleImageModel
 * 在 prompt 含图片数组时会路由到 /v1/images/edits（OpenAI 的 image edit endpoint），
 * 但很多 openai-compatible 中转后端根本没实现这个端点，于是返回 404。
 *
 * 翻译为 ERR_PROVIDER_NO_IMG2IMG，让 UI 能展示"当前 provider 不支持图生图"这种
 * 具体可操作的提示，而不是把 stack 直接暴露给用户。
 */
function translateAiSdkError(err: unknown, op: 'img2img' | 'inpaint' | 'upscale' | 'variant' | 'remove-bg' | 'outpaint'): Error {
  if (!(err instanceof Error)) {
    return err instanceof Error ? err : new Error(String(err))
  }

  const msg = err.message || ''
  const isApiCallError =
    (err as { name?: string }).name === 'AI_APICallError' ||
    msg.includes('AI_APICallError') ||
    /Not Found|HTTP 404|404 Not Found/i.test(msg)

  // 检测 /images/edits 端点缺失：
  // 1. AI SDK 抛 'Not Found'
  // 2. 错误链路里能拿到 url 字段，且 url.path 包含 /images/edits
  const url = (err as { url?: string }).url
  const isEditEndpointMissing = isApiCallError && typeof url === 'string' && url.includes('/images/edits')

  if (isEditEndpointMissing) {
    return new Error(
      `ERR_PROVIDER_NO_IMG2IMG: 当前 provider 的上游不支持 image edit endpoint（GET/POST /images/edits 均返回 404）。
` +
        '请按下面任一方式处理：\n' +
        '  1) 在「设置 → 模型服务」里换一个支持图生图的 provider；\n' +
        '  2) 联系上游管理员部署并暴露 /v1/images/edits（OpenAI 标准 multipart/form-data 端点）；\n' +
        `  3) 改用不需要图生图的操作（${op}）。\n` +
        `原始错误：${msg}`
    )
  }

  return err
}

/**
 * 图生图 - 基于参考图生成变体
 */
export async function executeImg2Img(task: ImageProcessTask): Promise<void> {
  const { sourceImage, prompt, strength = 0.7 } = task

  if (!task.providerId || !task.modelId) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model for img2img')
  }

  const providerList = await db.select().from(providers).where(eq(providers.id, task.providerId)).limit(1)
  const provider = providerList[0]

  if (!provider || !provider.isEnabled) {
    throw new Error('ERR_PROVIDER_NOT_FOUND: Provider not found or disabled')
  }

  // 本地 modelId（如 juhe-4）解析为上游模型名，日志/请求中统一使用上游名
  const upstreamModelName = await resolveUpstreamModelName(task.modelId)

  const settings: Record<string, string> = {}

  // Decrypt API key for internal use
  let apiKey: string | undefined
  if (provider.apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      apiKey = decryptApiKey(provider.apiKey)
    } catch (err) {
      console.error('[ImageProcess] 解密 API 密钥失败:', {
        providerId: task.providerId,
        providerType: provider.type,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (apiKey) settings.apiKey = apiKey
  if (provider.baseUrl) settings.baseURL = provider.baseUrl

  const providerId = ENDPOINT_TO_PROVIDER[provider.type] || 'openai-compatible'

  task.stage = 'generating'
  task.progress = 30

  let result
  try {
    result = await dispatchImgRefGen({
      providerType: provider.type,
      baseUrl: provider.baseUrl || '',
      apiKey: apiKey || '',
      modelId: task.modelId,
      upstreamModelName,
      prompt: prompt || 'transform this image',
      sourceImage
    })
  } catch (err) {
    console.error('[ImageProcess] 图生图生成失败:', {
      providerId: task.providerId,
      providerType: provider.type,
      model: upstreamModelName,
      prompt: prompt?.slice(0, 100),
      strength,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  task.progress = 80
  task.stage = 'processing'

  const outputs = parseOutputs(result, task.id)
  task.outputs = outputs
  task.progress = 100
  task.stage = 'completed'
}

/**
 * 图像变体 - 基于原图生成相似变体
 */
export async function executeVariant(task: ImageProcessTask): Promise<void> {
  // 变体本质上是 strength=0.3 的图生图
  task.strength = 0.3
  await executeImg2Img(task)
}

/**
 * Upscale - 超分辨率放大
 * 注：大多数 AI 图像 API 不直接支持 upscale，这里使用 img2img + 更高分辨率实现
 */
export async function executeUpscale(task: ImageProcessTask): Promise<void> {
  const { sourceImage, scaleFactor = 2 } = task

  if (!task.providerId || !task.modelId) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model for upscaling')
  }

  const providerList = await db.select().from(providers).where(eq(providers.id, task.providerId)).limit(1)
  const provider = providerList[0]

  if (!provider || !provider.isEnabled) {
    throw new Error('ERR_PROVIDER_NOT_FOUND: Provider not found or disabled')
  }

  // 本地 modelId（如 juhe-4）解析为上游模型名，日志/请求中统一使用上游名
  const upstreamModelName = await resolveUpstreamModelName(task.modelId)

  const settings: Record<string, string> = {}

  // Decrypt API key for internal use
  let apiKey: string | undefined
  if (provider.apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      apiKey = decryptApiKey(provider.apiKey)
    } catch (err) {
      console.error('[ImageProcess] 解密 API 密钥失败:', {
        providerId: task.providerId,
        providerType: provider.type,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (apiKey) settings.apiKey = apiKey
  if (provider.baseUrl) settings.baseURL = provider.baseUrl

  const providerId = ENDPOINT_TO_PROVIDER[provider.type] || 'openai-compatible'

  task.stage = 'upscaling'
  task.progress = 20


  // 使用更高分辨率 + 细节增强 prompt
  const size = scaleFactor >= 4 ? '1536x1536' : '1024x1024'
  const prompt =
    task.prompt ||
    `Enhance and upscale this image, preserving all details, ${scaleFactor}x resolution, ultra sharp, high quality`

  let result
  try {
    result = await dispatchImgRefGen({
      providerType: provider.type,
      baseUrl: provider.baseUrl || '',
      apiKey: apiKey || '',
      modelId: task.modelId,
      upstreamModelName,
      prompt,
      sourceImage,
      size
    })
  } catch (err) {
    console.error('[ImageProcess] 超分辨率放大失败:', {
      providerId: task.providerId,
      providerType: provider.type,
      model: upstreamModelName,
      prompt: prompt?.slice(0, 100),
      scaleFactor,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  task.progress = 80
  task.stage = 'processing'

  const outputs = parseOutputs(result, task.id)
  task.outputs = outputs
  task.progress = 100
  task.stage = 'completed'
}

/**
 * 局部重绘 - 基于 mask 编辑图像区域
 * 注：需要 provider 支持（如 DALL-E 2 image_edit）
 */
export async function executeInpaint(task: ImageProcessTask): Promise<void> {
  const { sourceImage, maskImage, prompt } = task

  if (!maskImage) {
    throw new Error('ERR_NO_MASK: Inpaint requires a mask image')
  }

  if (!task.providerId || !task.modelId) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model for inpainting')
  }

  const providerList = await db.select().from(providers).where(eq(providers.id, task.providerId)).limit(1)
  const provider = providerList[0]

  if (!provider || !provider.isEnabled) {
    throw new Error('ERR_PROVIDER_NOT_FOUND: Provider not found or disabled')
  }

  // 本地 modelId（如 juhe-4）解析为上游模型名，日志/请求中统一使用上游名
  const upstreamModelName = await resolveUpstreamModelName(task.modelId)

  const settings: Record<string, string> = {}

  // Decrypt API key for internal use
  let apiKey: string | undefined
  if (provider.apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      apiKey = decryptApiKey(provider.apiKey)
    } catch (err) {
      console.error('[ImageProcess] 解密 API 密钥失败:', {
        providerId: task.providerId,
        providerType: provider.type,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (apiKey) settings.apiKey = apiKey
  if (provider.baseUrl) settings.baseURL = provider.baseUrl

  const providerId = ENDPOINT_TO_PROVIDER[provider.type] || 'openai-compatible'

  task.stage = 'inpainting'
  task.progress = 30


  let result
  try {
    result = await dispatchImgRefGen({
      providerType: provider.type,
      baseUrl: provider.baseUrl || '',
      apiKey: apiKey || '',
      modelId: task.modelId,
      upstreamModelName,
      prompt: prompt || 'Fill this area naturally',
      sourceImage,
      maskImage: task.maskImage
    })
  } catch (err) {
    console.error('[ImageProcess] 局部重绘失败:', {
      providerId: task.providerId,
      providerType: provider.type,
      model: upstreamModelName,
      prompt: prompt?.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  task.progress = 80
  task.stage = 'processing'

  const outputs = parseOutputs(result, task.id)
  task.outputs = outputs
  task.progress = 100
  task.stage = 'completed'
}

/**
 * 背景移除 - 使用 prompt 引导生成透明背景效果
 * 注：纯 AI 方案，非精确抠图。精确抠图需要 CV 模型如 rembg。
 */
export async function executeRemoveBg(task: ImageProcessTask): Promise<void> {
  const { sourceImage } = task

  if (!task.providerId || !task.modelId) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model')
  }

  const providerList = await db.select().from(providers).where(eq(providers.id, task.providerId)).limit(1)
  const provider = providerList[0]

  if (!provider || !provider.isEnabled) {
    throw new Error('ERR_PROVIDER_NOT_FOUND: Provider not found or disabled')
  }

  // 本地 modelId（如 juhe-4）解析为上游模型名，日志/请求中统一使用上游名
  const upstreamModelName = await resolveUpstreamModelName(task.modelId)

  const settings: Record<string, string> = {}

  // Decrypt API key for internal use
  let apiKey: string | undefined
  if (provider.apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      apiKey = decryptApiKey(provider.apiKey)
    } catch (err) {
      console.error('[ImageProcess] 解密 API 密钥失败:', {
        providerId: task.providerId,
        providerType: provider.type,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (apiKey) settings.apiKey = apiKey
  if (provider.baseUrl) settings.baseURL = provider.baseUrl

  const providerId = ENDPOINT_TO_PROVIDER[provider.type] || 'openai-compatible'

  task.stage = 'removing-bg'
  task.progress = 30


  let result
  try {
    result = await dispatchImgRefGen({
      providerType: provider.type,
      baseUrl: provider.baseUrl || '',
      apiKey: apiKey || '',
      modelId: task.modelId,
      upstreamModelName,
      prompt: 'Same subject on pure white background, clean edges, product photography style, isolated subject',
      sourceImage
    })
  } catch (err) {
    console.error('[ImageProcess] 背景移除失败:', {
      providerId: task.providerId,
      providerType: provider.type,
      model: upstreamModelName,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  task.progress = 80
  task.stage = 'processing'

  const outputs = parseOutputs(result, task.id)
  task.outputs = outputs
  task.progress = 100
  task.stage = 'completed'
}

/**
 * 扩图 - 向外扩展画布
 */
export async function executeOutpaint(task: ImageProcessTask): Promise<void> {
  const { sourceImage, prompt } = task

  if (!task.providerId || !task.modelId) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model')
  }

  const providerList = await db.select().from(providers).where(eq(providers.id, task.providerId)).limit(1)
  const provider = providerList[0]

  if (!provider || !provider.isEnabled) {
    throw new Error('ERR_PROVIDER_NOT_FOUND: Provider not found or disabled')
  }

  // 本地 modelId（如 juhe-4）解析为上游模型名，日志/请求中统一使用上游名
  const upstreamModelName = await resolveUpstreamModelName(task.modelId)

  const settings: Record<string, string> = {}

  // Decrypt API key for internal use
  let apiKey: string | undefined
  if (provider.apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      apiKey = decryptApiKey(provider.apiKey)
    } catch (err) {
      console.error('[ImageProcess] 解密 API 密钥失败:', {
        providerId: task.providerId,
        providerType: provider.type,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  if (apiKey) settings.apiKey = apiKey
  if (provider.baseUrl) settings.baseURL = provider.baseUrl

  const providerId = ENDPOINT_TO_PROVIDER[provider.type] || 'openai-compatible'

  task.stage = 'outpainting'
  task.progress = 30


  let result
  try {
    result = await dispatchImgRefGen({
      providerType: provider.type,
      baseUrl: provider.baseUrl || '',
      apiKey: apiKey || '',
      modelId: task.modelId,
      upstreamModelName,
      prompt: prompt || 'Extend this image seamlessly, matching the style and content',
      sourceImage,
      size: '1536x1024'
    })
  } catch (err) {
    console.error('[ImageProcess] 扩图失败:', {
      providerId: task.providerId,
      providerType: provider.type,
      model: upstreamModelName,
      prompt: prompt?.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  task.progress = 80
  task.stage = 'processing'

  const outputs = parseOutputs(result, task.id)
  task.outputs = outputs
  task.progress = 100
  task.stage = 'completed'
}

// ===== 工具函数 =====

function parseOutputs(result: AiCoreLikeResult, taskId: string): ImageProcessOutput[] {
  const outputs: ImageProcessOutput[] = []

  if (result.images && result.images.length > 0) {
    for (let i = 0; i < result.images.length; i++) {
      const img = result.images[i]
      outputs.push({
        id: `${taskId}-${i}`,
        base64: img.base64,
        mediaType: img.mediaType || 'image/png'
      })
    }
  } else if (result.image) {
    outputs.push({
      id: `${taskId}-0`,
      base64: result.image.base64,
      mediaType: result.image.mediaType || 'image/png'
    })
  }

  return outputs
}
