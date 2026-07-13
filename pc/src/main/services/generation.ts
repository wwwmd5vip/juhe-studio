/**
 * AI 生成服务
 * 封装 @cherrystudio/ai-core 的 generateImage/generateText
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { generateImage } from '@cherrystudio/ai-core'
import { ensureDir, atomicWriteFile, generateImageFilename } from '@main/utils/file-utils'
import { resolveProvider } from '@main/utils/provider-resolver'
import type { GenerationOutput, GenerationTask, TaskPriority } from '@shared/types/generation'
import { httpRequest } from '@shared/utils/http-client'
import { createLogger } from '@shared/utils/logger'
import { parseJsonField } from '@shared/utils/json-utils'
import { stripBinaryDataFromParams, updateTaskProgress } from '@shared/utils/task-utils'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { generations } from '../db/schema'
import { resolveUpstreamModelName } from './model-utils'

const logger = createLogger('Generation')

/** 获取图片存储目录 (userData/Data/Files/) */
export function getImageStorageDir(): string {
  return ensureDir('Data/Files')
}

/**
 * 迁移旧版图片 URL 为 juhe-image:// 格式。
 *
 * 旧版可能存储：bare filename (hash.png)、file:// 路径、或其他无 scheme 的格式。
 * 新版统一使用 juhe-image:// 协议。
 */
export function migrateLegacyImageUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  // Already a valid protocol URL — return as-is
  if (url.startsWith('juhe-image://') || url.startsWith('http://') || url.startsWith('https://')) return url
  // Legacy file:// URL — migrate
  if (url.startsWith('file://')) {
    return `juhe-image://${encodeURI(decodeURIComponent(url.slice(7)))}`
  }
  // data: URLs — skip (should be filtered out by callers)
  if (url.startsWith('data:')) return undefined
  // Bare filename (no :// means no scheme) — reconstruct full path
  if (!url.includes('://')) {
    const storageDir = getImageStorageDir()
    return `juhe-image://${encodeURI(join(storageDir, url))}`
  }
  // Unknown scheme — return as-is
  return url
}

/** 将 base64 数据保存为文件，返回 juhe-image:// URL */
function saveBase64ToFile(base64Data: string, mediaType = 'image/png'): string {
  const storageDir = getImageStorageDir()
  const filename = generateImageFilename(base64Data, mediaType)
  const filepath = join(storageDir, filename)

  console.log('[ImageStorage] Saving to:', filepath)

  if (!existsSync(filepath)) {
    const buffer = Buffer.from(base64Data, 'base64')
    atomicWriteFile(filepath, buffer)
    console.log('[ImageStorage] File saved, size:', buffer.length, 'bytes')
  } else {
    console.log('[ImageStorage] File already exists:', filepath)
  }

  // Verify file exists
  if (!existsSync(filepath)) {
    console.error('[ImageStorage] FAILED to save file:', filepath)
  }

  // Return juhe-image:// URL for access via custom protocol
  // encodeURI preserves slashes but encodes spaces (%20) - critical for paths like "Application Support"
  const fileUrl = `juhe-image://${encodeURI(filepath)}`
  console.log('[ImageStorage] Returning URL:', fileUrl)
  return fileUrl
}

/**
 * 从 juhe-image:// 或 file:// URL 中抽取 basename 作为 key。
 * 非 URL（裸文件名）直接返回。
 */
function filenameFromImageUrl(url: string): string | null {
  if (typeof url !== 'string' || url.length === 0) return null
  try {
    if (url.startsWith('juhe-image://') || url.startsWith('file://')) {
      const stripped = url.replace(/^(?:juhe-image|file):\/\//, '')
      // 还原被编码的路径段（如 "Application%20Support"），但保留路径分隔符
      const decoded = decodeURIComponent(stripped)
      const idx = Math.max(decoded.lastIndexOf('/'), decoded.lastIndexOf('\\'))
      return idx >= 0 ? decoded.slice(idx + 1) : decoded
    }
    // Bare filename (no scheme) — strip any leading directories just in case
    const idx = Math.max(url.lastIndexOf('/'), url.lastIndexOf('\\'))
    return idx >= 0 ? url.slice(idx + 1) : url
  } catch {
    return null
  }
}

/**
 * 收集 generations 表里仍被引用的图片文件名。
 *
 * 用于 cleanupTempImages 只清理孤儿文件，避免破坏用户历史。
 *
 * 错误时返回 null：表示「不知道哪些文件被引用」，
 * 调用方应当放弃本次清理（保守策略，避免误删历史）。
 */
async function getReferencedImageFilenames(): Promise<Set<string> | null> {
  const refs = new Set<string>()
  try {
    const rows = await db
      .select({ resultUrls: generations.resultUrls, outputs: generations.outputs })
      .from(generations)
    for (const row of rows) {
      // resultUrls: JSON 序列化的字符串数组（juhe-image://encodedFilePath）
      if (row.resultUrls) {
        const parsed = parseJsonField(row.resultUrls, [])
        if (Array.isArray(parsed)) {
          for (const url of parsed) {
            const name = filenameFromImageUrl(url)
            if (name) refs.add(name)
          }
        }
      }
      // outputs: JSON 序列化的对象数组 { url, type, ... }
      if (row.outputs) {
        const parsed = parseJsonField(row.outputs, [])
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === 'object') {
              const url = (item as { url?: unknown }).url
              const name = filenameFromImageUrl(url as string)
              if (name) refs.add(name)
            }
          }
        }
      }
    }
    return refs
  } catch (err) {
    logger.error('读取引用失败，跳过本次清理以保护历史:', err)
    return null
  }
}

/**
 * 清理孤儿的图片文件（DB 中无任何记录引用）。
 *
 * ⚠️ 历史实现错误：曾基于 mtime（>24h）一键删除，导致所有超过 24h
 * 的历史图片全部 404（DB 行还在但文件被清）。现在以 DB 为准：
 * 保留所有仍被引用的文件，只清理孤儿。
 */
export async function cleanupTempImages(): Promise<void> {
  let refs: Set<string> | null
  try {
    refs = await getReferencedImageFilenames()
  } catch (err) {
    // 防御：理论上 getReferencedImageFilenames 已自吞错误返回 null，
    // 但万一它将来改成 throw，外层也兜底不删任何东西。
    logger.error('读取 DB 引用失败，跳过本次清理:', err)
    return
  }
  if (refs === null) {
    // DB 不可用 → 不知道哪些是孤儿 → 本轮不清，保护历史
    return
  }

  try {
    const dir = getImageStorageDir()
    const files = readdirSync(dir)
    let deleted = 0
    for (const file of files) {
      if (refs.has(file)) continue // 仍被引用，保留
      try {
        unlinkSync(join(dir, file))
        deleted++
      } catch (err) {
        logger.error('删除孤儿文件失败:', file, err)
      }
    }
    if (deleted > 0) {
      logger.info(`已清理 ${deleted} 个孤儿图片文件 from ${dir}`)
    }
  } catch (err) {
    logger.error('cleanupTempImages 文件 I/O 失败:', err)
  }
}

/**
 * 把 generations 表中文件已丢失的 image 行标记为 failed。
 *
 * 用途：旧的 mtime cleanup 把 >24h 图片清掉，DB 行还在但 URL 已 404。
 * 此函数启动时被调用一次，幂等（只动 status='completed' 的 image 行），
 * 让 UI 不再无限等图、改走 failed-state 提示。
 *
 * 只检查 result_urls 中以 juhe-image:// 开头且指向 Data/Files/ 的本地图片；
 * 远端 URL（http/https）跳过。
 */
export async function markMissingImageFiles(): Promise<void> {
  let rows: { id: string; resultUrls: string | null; outputs: string | null }[]
  try {
    rows = (await db
      .select({
        id: generations.id,
        resultUrls: generations.resultUrls,
        outputs: generations.outputs
      })
      .from(generations)
      .where(and(eq(generations.status, 'completed'), eq(generations.type, 'image')))) as typeof rows
  } catch (err) {
    logger.error('读取 completed image 失败:', err)
    return
  }

  let marked = 0
  for (const row of rows) {
    const urls = collectImageUrlsFromRow(row.resultUrls, row.outputs)
    if (urls.length === 0) continue
    let hasMissing = false
    for (const url of urls) {
      if (!url.startsWith('juhe-image://')) continue // 远端 / data: 跳过
      const localPath = decodeURIComponent(url.replace(/^(?:juhe-image|file):\/\//, ''))
      if (localPath.startsWith(getImageStorageDir()) && !existsSync(localPath)) {
        hasMissing = true
        break
      }
    }
    if (!hasMissing) continue
    try {
      await db
        .update(generations)
        .set({
          status: 'failed',
          errorMessage: '图片文件已丢失（早期清理逻辑误删，可手动重新生成）',
          updatedAt: new Date().toISOString()
        })
        .where(eq(generations.id, row.id))
      marked++
    } catch (err) {
      logger.error('标记缺失行失败:', row.id, err)
    }
  }
  if (marked > 0) {
    logger.info(`已将 ${marked} 条丢失图片的 image 行标记为 failed`)
  }
}

/** 从 generations 一行的两个 JSON 字段抽出所有 URL（不解析内层结构） */
function collectImageUrlsFromRow(resultUrls: string | null, outputs: string | null): string[] {
  const out: string[] = []
  for (const raw of [resultUrls, outputs]) {
    if (!raw) continue
    const parsed = parseJsonField(raw, [])
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') {
          out.push(item)
        } else if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
          out.push((item as { url: string }).url)
        }
      }
    }
  }
  return out
}

/**
 * 调用 OpenAI Compatible 图像生成 API（直接 HTTP）
 * 绕过 ai SDK 的 base64 解析问题，支持返回 URL 或 base64 的 provider
 */

/**
 * 把上游返回的图片 URL 下载下来，转成 base64 字符串。
 *
 * 内置：
 * - 自动重试（最多 3 次，间隔 1s/2s/4s）；
 * - 4xx 不重试（404/403 这类不是网络抖动，重试也白搭）；
 * - 透传上层 abort signal（用户取消、超时都会同步终止）；
 * - 每次失败打印 error.cause（DNS/连接/TLS 等真实原因）便于排查。
 *
 * 部分 OSS / CDN 会拒绝没有浏览器 UA 的 Node fetch，统一带一个 Chrome UA 避免 403。
 */
export async function downloadImageAsBase64(
  url: string,
  parentSignal: AbortSignal | undefined,
  options: { maxAttempts?: number; timeoutMs?: number } = {}
): Promise<string> {
  const maxAttempts = options.maxAttempts ?? 3
  const perAttemptTimeoutMs = options.timeoutMs ?? 60_000

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 每次重试都重新建一个独立超时 signal；外层 parentSignal 由调用方传入，
    // AbortSignal.any 把两者合在一起 → 用户取消或单次超时都能终止。
    const attemptTimeout = AbortSignal.timeout(perAttemptTimeoutMs)
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, attemptTimeout])
      : attemptTimeout

    try {
      const response = await fetch(url, {
        signal,
        headers: {
          // OSS / 部分 CDN 用 UA 鉴权，不带 UA 可能被拒
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        }
      })

      if (response.status >= 400 && response.status < 500) {
        // 客户端错误（404/403 等），不是网络抖动，重试无意义
        logger.warn(
          'Download non-retriable HTTP:',
          response.status,
          url.slice(0, 120)
        )
        lastError = new Error(`HTTP ${response.status}`)
        break
      }

      if (!response.ok) {
        // 5xx 等可以重试
        const text = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status} ${text.slice(0, 200)}`)
      }

      const buffer = await response.arrayBuffer()
      return Buffer.from(buffer).toString('base64')
    } catch (err) {
      lastError = err
      // 把 fetch 包装的真实原因打出来：cause.name / cause.code 才是关键信息
      const cause = err instanceof Error ? (err as { cause?: unknown }).cause : undefined
      const causeInfo =
        cause && typeof cause === 'object'
          ? { name: (cause as { name?: unknown }).name, code: (cause as { code?: unknown }).code }
          : null
      logger.warn(
        `Download attempt ${attempt}/${maxAttempts} failed:`,
        url.slice(0, 120),
        err instanceof Error ? err.message : String(err),
        causeInfo ? `cause=${JSON.stringify(causeInfo)}` : ''
      )

      if (attempt < maxAttempts) {
        // 指数退避：1s → 2s → 4s
        const delayMs = 2 ** (attempt - 1) * 1000
        try {
          await new Promise((r) => setTimeout(r, delayMs))
        } catch {
          // setTimeout 不会 reject，但保持 catch 以兼容 future
        }
      }
    }
  }

  // 三次都不行：抛错，让外层循环里 catch 后跳过这张图
  throw new Error(
    `下载失败（重试 ${maxAttempts} 次）：${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  )
}

async function callOpenAICompatibleImageAPI(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  n: number,
  size?: string,
  seed?: number,
  referenceImages?: string[],
  quality?: string,
  style?: string,
  referenceMode?: string,
  aspectRatio?: string,
  signal?: AbortSignal
): Promise<{ images: string[]; revisedPrompt?: string }> {
  const normalizedModel = model.toLowerCase()
  const supportsQualityStyle =
    /^(gpt-image|dall-e|dall-e-|image-|midjourney|flux|seedream|cogview|kolors|imagen|recraft|z-image|grok-imagine)/i.test(
      normalizedModel
    ) || /(?:gpt|openai).*image/i.test(normalizedModel)

  const hasRefImages = !!(referenceImages && referenceImages.length > 0)
  // 统一使用 /images/generations + JSON（MXAPI 适配器会转换为 reference_images + data URL）
  const url = `${baseUrl.replace(/\/$/, '')}/images/generations`

  // 原有 JSON 逻辑
  const body: Record<string, unknown> = {
    model,
    prompt,
    n,
    response_format: 'b64_json'
  }
  if (size) body.size = size
  if (aspectRatio) body.aspect_ratio = aspectRatio
  if (seed != null) body.seed = seed
  if (supportsQualityStyle && quality) body.quality = quality
  if (supportsQualityStyle && style) body.style = style

  // 参考图处理：保留 data: 前缀（MXAPI 适配器会转为 reference_images data URL）
  if (hasRefImages) {
    body.images = referenceImages
    if (referenceMode) body.reference_mode = referenceMode
  }

  // Log reference image details for debugging
  const refImageDetails =
    referenceImages?.map((img, i) => ({
      index: i,
      length: img.length,
      isDataUrl: img.startsWith('data:'),
      prefix: img.slice(0, 30)
    })) ?? []

  const bodyJson = JSON.stringify(body)
  logger.info('Direct API call:', {
    url,
    model,
    prompt: prompt?.slice(0, 100),
    n,
    size,
    aspectRatio,
    seed,
    hasReferenceImages: !!(referenceImages && referenceImages.length > 0),
    referenceImageCount: referenceImages?.length ?? 0,
    referenceImageDetails: refImageDetails,
    bodySize: bodyJson.length,
    bodyKeys: Object.keys(body)
  })

  // httpRequest handles timeout (120s) + abort signal combination and error parsing internally.
  // HttpError already carries a parsed human-readable message, so we let it propagate.
  const { data } = await httpRequest<{
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>
    error?: { message?: string }
  }>(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal
  })

  if (data.error) {
    logger.error('Direct API returned error:', data.error)
    throw new Error(data.error.message || '服务端返回了错误，请检查上游渠道配置')
  }

  if (!data.data || data.data.length === 0) {
    logger.error('Direct API no data array:', JSON.stringify(data).slice(0, 500))
    throw new Error('模型没有返回图片数据，请检查模型配置是否正确')
  }

  const images: string[] = []
  let revisedPrompt: string | undefined

  for (let i = 0; i < data.data.length; i++) {
    const item = data.data[i]
    logger.info(`Direct API data[${i}]:`, {
      hasB64: !!item.b64_json,
      b64Length: item.b64_json?.length ?? 0,
      hasUrl: !!item.url,
      urlPrefix: item.url?.slice(0, 50),
      hasRevisedPrompt: !!item.revised_prompt
    })
    if (item.b64_json) {
      // 清理 base64：移除 data URL 前缀、换行符、空格
      let cleaned = item.b64_json.trim()
      if (cleaned.startsWith('data:')) {
        const commaIndex = cleaned.indexOf(',')
        if (commaIndex !== -1) {
          cleaned = cleaned.slice(commaIndex + 1)
        }
      }

      function _shouldRetryWithoutQualityStyle(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error)
        return /不合法的quality|invalid.*quality|style/i.test(message)
      }

      function _stripQualityStyle(params: {
        prompt: string
        model: string
        n?: number
        size?: string
        seed?: number
        referenceImages?: string[]
        quality?: string
        style?: string
        referenceMode?: string
      }) {
        return {
          ...params,
          quality: undefined,
          style: undefined
        }
      }

      cleaned = cleaned.replace(/\s/g, '')
      images.push(cleaned)
    } else if (item.url) {
      // 返回的是 URL，下载为 base64（带重试 + 详细 cause 日志）
      try {
        const base64 = await downloadImageAsBase64(item.url, signal)
        images.push(base64)
      } catch (downloadErr) {
        // 已经做过详细日志 / 重试；这里只跳过这张图
      }
    }
    if (item.revised_prompt && !revisedPrompt) {
      revisedPrompt = item.revised_prompt
    }
  }

  if (images.length === 0) {
    logger.error('Direct API no images extracted:', JSON.stringify(data).slice(0, 500))
    throw new Error('图片生成失败：上游返回了图片链接但下载失败，请检查网络连接或联系管理员')
  }

  logger.info('Direct API success:', { imageCount: images.length, firstImageLength: images[0]?.length })
  return { images, revisedPrompt }
}

/**
 * 图像生成执行器
 * 被 GenerationQueue 调用执行实际生成任务
 */
export async function executeImageGeneration(task: GenerationTask): Promise<void> {
  const { params } = task
  const startTime = Date.now()

  if (!params.providerId || !params.model) {
    throw new Error('请选择模型和提供商后再生成图片')
  }

  // 获取 Provider 配置
  const resolved = await resolveProvider(params.providerId)

  // 本地 model id（juhe-4）需要映射为上游模型名（juhe-gpt-image-2）才能被上游识别
  const upstreamModelName = await resolveUpstreamModelName(params.model)

  logger.info('Image generation start:', {
    taskId: task.id,
    providerId: resolved.providerId,
    providerType: resolved.providerType,
    model: upstreamModelName,
    prompt: params.prompt?.slice(0, 100),
    n: params.n ?? 1,
    size: params.size,
    aspectRatio: params.aspectRatio,
    seed: params.seed,
    quality: params.quality,
    style: params.style,
    baseUrl: resolved.baseURL,
    hasApiKey: !!resolved.apiKey
  })

  // 更新进度
  updateTaskProgress(task, 'generating', 30)

  const outputs: GenerationOutput[] = []
  let revisedPrompt: string | undefined

  // 对于 openai-compatible provider，使用直接 HTTP 调用绕过 ai SDK 的 base64 解析问题
  if (resolved.providerId === 'openai-compatible' && resolved.baseURL && resolved.apiKey) {
    try {
      const result = await callOpenAICompatibleImageAPI(
        resolved.baseURL,
        resolved.apiKey,
        upstreamModelName,
        params.prompt,
        params.n ?? 1,
        params.size,
        params.seed,
        params.referenceImages,
        params.quality,
        params.style,
        params.referenceMode,
        params.aspectRatio,
        task.abortController?.signal
      )

      updateTaskProgress(task, 'processing', 80)

      for (let i = 0; i < result.images.length; i++) {
        outputs.push({
          id: `${task.id}-${i}`,
          type: 'image',
          base64: result.images[i],
          mediaType: 'image/png'
        })
      }
      revisedPrompt = result.revisedPrompt
    } catch (err) {
      logger.error('Direct API call failed:', {
        taskId: task.id,
        providerId: resolved.providerId,
        model: upstreamModelName,
        prompt: params.prompt?.slice(0, 100),
        baseUrl: resolved.baseURL,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      if (params.quality || params.style) {
        logger.warn('Retrying without quality/style due to provider error')
        const retryResult = await callOpenAICompatibleImageAPI(
          resolved.baseURL,
          resolved.apiKey,
          upstreamModelName,
          params.prompt,
          params.n ?? 1,
          params.size,
          params.seed,
          params.referenceImages,
          undefined,
          undefined,
          params.referenceMode,
          params.aspectRatio,
          task.abortController?.signal
        )

        updateTaskProgress(task, 'processing', 80)

        for (let i = 0; i < retryResult.images.length; i++) {
          outputs.push({
            id: `${task.id}-${i}`,
            type: 'image',
            base64: retryResult.images[i],
            mediaType: 'image/png'
          })
        }
        revisedPrompt = retryResult.revisedPrompt
      } else {
        throw err
      }
    }
  } else {
    // 构建 ai-core 设置
    const settings: Record<string, string> = {}
    if (resolved.apiKey) {
      settings.apiKey = resolved.apiKey
    }
    if (resolved.baseURL) {
      settings.baseURL = resolved.baseURL
    }

    // 构建 provider-specific options
    const providerOptions: Record<string, Record<string, unknown>> = {}
    if (params.quality) {
      providerOptions.openai = { ...providerOptions.openai, quality: params.quality }
    }
    if (params.style) {
      providerOptions.openai = { ...providerOptions.openai, style: params.style }
    }

    // 调用 ai-core generateImage
    let result
    try {
      result = await generateImage(resolved.providerId as Parameters<typeof generateImage>[0], settings as never, {
        model: upstreamModelName,
        prompt: params.prompt,
        n: params.n ?? 1,
        size: params.size,
        aspectRatio: params.aspectRatio as `${number}:${number}` | undefined,
        seed: params.seed,
        providerOptions: Object.keys(providerOptions).length > 0 ? (providerOptions as never) : undefined
      })
    } catch (err) {
      logger.error('generateImage failed:', {
        taskId: task.id,
        providerId: resolved.providerId,
        model: upstreamModelName,
        prompt: params.prompt?.slice(0, 100),
        baseUrl: resolved.baseURL,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      throw err
    }

    // 解析结果
    updateTaskProgress(task, 'processing', 80)

    if (result.images && result.images.length > 0) {
      for (let i = 0; i < result.images.length; i++) {
        const img = result.images[i]
        outputs.push({
          id: `${task.id}-${i}`,
          type: 'image',
          base64: img.base64,
          mediaType: img.mediaType || 'image/png'
        })
      }
    } else if (result.image) {
      outputs.push({
        id: `${task.id}-0`,
        type: 'image',
        base64: result.image.base64,
        mediaType: result.image.mediaType || 'image/png'
      })
    }

    // 提取修订后的提示词（OpenAI DALL-E 特有）
    revisedPrompt = (result.providerMetadata?.openai as Record<string, unknown> | undefined)?.revisedPrompt as
      | string
      | undefined
  }

  logger.info('Image generation completed:', {
    taskId: task.id,
    duration: `${Date.now() - startTime}ms`,
    outputCount: outputs.length,
    revisedPrompt: revisedPrompt?.slice(0, 100)
  })

  // Convert base64 outputs to files and return juhe-image:// URLs
  const fileOutputs: GenerationOutput[] = outputs.map((output) => {
    if (output.base64) {
      const fileUrl = saveBase64ToFile(output.base64, output.mediaType)
      return {
        ...output,
        base64: undefined,
        url: fileUrl
      }
    }
    return output
  })

  task.outputs = fileOutputs
  updateTaskProgress(task, 'completed', 100)
}

/**
 * 保存生成结果到数据库（完整任务数据）
 */
/** Strip base64 from outputs to prevent DB bloat - only store URLs and metadata */
function stripBase64FromOutputs(
  outputs: GenerationTask['outputs']
): Array<Omit<GenerationOutput, 'base64'> & { base64?: undefined }> {
  return outputs.map((o) => ({
    id: o.id,
    type: o.type,
    url: o.url,
    // Never store base64 in DB - only URLs
    base64: undefined,
    mediaType: o.mediaType,
    width: o.width,
    height: o.height
  }))
}

export async function saveGenerationToDb(task: GenerationTask): Promise<void> {
  // Strip base64 before storing to prevent DB bloat and OOM
  const cleanOutputs = stripBase64FromOutputs(task.outputs)
  const urlsOnly = task.outputs.map((o) => o.url).filter(Boolean) as string[]

  await db
    .insert(generations)
    .values({
      id: task.id,
      type: task.type,
      providerId: task.params.providerId || 'unknown',
      modelId: task.params.model || 'unknown',
      prompt: task.params.prompt,
      negativePrompt: task.params.negativePrompt,
      seed: task.params.seed,
      width: task.outputs[0]?.width,
      height: task.outputs[0]?.height,
      parameters: JSON.stringify(task.params),
      resultUrls: JSON.stringify(urlsOnly),
      status: task.status,
      errorMessage: task.error,
      // Task persistence fields
      priority: task.priority,
      progress: task.progress,
      stage: task.stage,
      startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
      completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
      externalTaskId: task.externalTaskId,
      externalProvider: task.externalProvider,
      outputs: JSON.stringify(cleanOutputs),
      createdAt: new Date(task.createdAt).toISOString(),
      updatedAt: new Date().toISOString()
    })
    .onConflictDoUpdate({
      target: generations.id,
      set: {
        status: task.status,
        errorMessage: task.error,
        resultUrls: JSON.stringify(urlsOnly),
        width: task.outputs[0]?.width,
        height: task.outputs[0]?.height,
        priority: task.priority,
        progress: task.progress,
        stage: task.stage,
        startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
        completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        externalTaskId: task.externalTaskId,
        externalProvider: task.externalProvider,
        outputs: JSON.stringify(cleanOutputs),
        updatedAt: new Date().toISOString()
      }
    })
}

/**
 * 从数据库加载所有生成任务（用于重启后恢复队列）
 */
export async function loadGenerationsFromDb(): Promise<GenerationTask[]> {
  const rows = await db.select().from(generations).orderBy(generations.createdAt)
  const tasks: GenerationTask[] = []

  for (const row of rows) {
    try {
      const rawParams = parseJsonField(row.parameters, {})
      // Strip base64 image data from params to prevent memory bloat on restore
      const params = stripBinaryDataFromParams(rawParams as Record<string, unknown>)
      const outputs = parseJsonField(row.outputs, [])
      const resultUrls = parseJsonField(row.resultUrls, [])

      // 如果 outputs 为空但有 resultUrls，构建基本 outputs (never restore base64)
      // Migrate old file:// URLs to juhe-image:// for secure display
      let finalOutputs: GenerationOutput[] = Array.isArray(outputs) ? outputs : []
      if (finalOutputs.length === 0 && Array.isArray(resultUrls) && resultUrls.length > 0) {
        finalOutputs = resultUrls
          .filter((url: string) => !url.startsWith('data:')) // Skip any data URLs
          .map((url: string, i: number) => {
            // Migrate legacy URLs to juhe-image://
            const migratedUrl = migrateLegacyImageUrl(url) || url
            return {
              id: `${row.id}-output-${i}`,
              type: row.type as GenerationTask['type'],
              url: migratedUrl,
              mediaType: 'image/png'
            }
          })
      }

      const task: GenerationTask = {
        id: row.id,
        type: row.type as GenerationTask['type'],
        status: row.status as GenerationTask['status'],
        priority: (row.priority as TaskPriority) || 'normal',
        params: params as unknown as GenerationTask['params'],
        outputs: finalOutputs,
        error: row.errorMessage || undefined,
        progress: row.progress || 0,
        stage: row.stage || 'queued',
        createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
        startedAt: row.startedAt ? new Date(row.startedAt).getTime() : undefined,
        completedAt: row.completedAt ? new Date(row.completedAt).getTime() : undefined,
        externalTaskId: row.externalTaskId || undefined,
        externalProvider: row.externalProvider as 'jimeng' | 'aliyun' | undefined
      }
      tasks.push(task)
    } catch (err) {
      console.error('[DB] Failed to restore generation task:', row.id, err)
    }
  }

  console.log('[DB] Loaded generations from DB:', { count: tasks.length })
  return tasks
}
