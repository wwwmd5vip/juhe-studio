/**
 * Aliyun (阿里云百炼) 图像/视频生成服务
 * 通过 DashScope API 调用阿里云百炼的视觉生成服务
 *
 * 支持:
 * - 文生图: wan2.6-t2i, wan2.5-t2i-preview, wan2.2-t2i-flash, wan2.2-t2i-plus,
 *           wanx2.1-t2i-turbo, wanx2.1-t2i-plus, wanx2.0-t2i-turbo, z-image-turbo,
 *           kling/kling-v3-image-generation, kling/kling-v3-omni-image-generation
 * - 文生视频: wan2.7-t2v, vidu/viduq3-pro_text2video, vidu/viduq3-turbo_text2video,
 *             vidu/viduq2_text2video, happyhorse-1.0-t2v
 * - 图生视频: wan2.7-i2v-2026-04-25, happyhorse-1.0-r2v
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference
 */

import type { GenerationOutput, GenerationTask } from '@shared/types/generation'
import { ALIYUN_IMAGE_MODELS, ALIYUN_VIDEO_MODELS } from '@shared/constants/provider-mapping'
import { updateTaskProgress } from '@shared/utils/task-utils'
import { httpRequest, HttpError } from '@shared/utils/http-client'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { providers } from '../db/schema'

// DashScope API 配置
const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com'

// 同步图像生成模型（直接返回结果）
const SYNC_IMAGE_MODELS = new Set(['wan2.6-t2i', 'z-image-turbo'])

// 尺寸映射: 常见比例 -> width x height
const ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1': '1280*1280',
  '16:9': '1696*960',
  '9:16': '960*1696',
  '4:3': '1472*1104',
  '3:4': '1104*1472',
  '3:2': '1440*960',
  '2:3': '960*1440'
}

// 可灵尺寸映射
const KLING_ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16'
}

interface DashScopeSubmitResponse {
  output?: {
    task_id?: string
    task_status?: string
  }
  request_id?: string
  code?: string
  message?: string
}

interface DashScopeTaskResult {
  output?: {
    task_id?: string
    task_status?: string
    choices?: Array<{
      finish_reason?: string
      message?: {
        role?: string
        content?: Array<{
          type?: string
          image?: string
          text?: string
        }>
      }
    }>
    video_url?: string
  }
  request_id?: string
  code?: string
  message?: string
  usage?: {
    image_count?: number
    video_count?: number
  }
}

interface DashScopeSyncImageResponse {
  output?: {
    choices?: Array<{
      finish_reason?: string
      message?: {
        role?: string
        content?: Array<{
          type?: string
          image?: string
          text?: string
        }>
      }
    }>
  }
  usage?: {
    image_count?: number
    width?: number
    height?: number
  }
  request_id?: string
  code?: string
  message?: string
}

/**
 * 获取 Provider 的解密 API Key
 */
async function getProviderApiKey(providerId: string): Promise<string | null> {
  const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)

  const provider = result[0]
  if (!provider) return null

  if (provider.apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      return decryptApiKey(provider.apiKey).trim()
    } catch {
      // key decryption failed, skip
    }
  }

  // Juhe Management auto-injection has been removed — newapi-client preset handling moved to dedicated juhe provider

  return null
}

/**
 * 获取 Provider 的 baseUrl
 */
async function getProviderBaseUrl(providerId: string): Promise<string> {
  const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)

  const provider = result[0]
  return provider?.baseUrl || DASHSCOPE_BASE_URL
}

/**
 * 提交异步任务（图像/视频）
 */
async function submitAsyncTask(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
  options: {
    size?: string
    aspectRatio?: string
    seed?: number
    referenceImages?: string[]
    firstFrame?: string | null
    negativePrompt?: string
    n?: number
    resolution?: string
    duration?: number
    watermark?: boolean
  }
): Promise<string> {
  const isKling = model.startsWith('kling/')
  const isVideo = ALIYUN_VIDEO_MODELS.has(model)
  const isImage = ALIYUN_IMAGE_MODELS.has(model)

  // 构建请求体
  const body: Record<string, unknown> = {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }]
        }
      ]
    }
  }

  // 添加参考图（图生视频或图生图）
  const input = body.input as { messages: Array<{ content: Array<Record<string, unknown>> }> }
  if (options.referenceImages && options.referenceImages.length > 0) {
    const content = input.messages[0].content
    for (const img of options.referenceImages) {
      content.push({ image: img })
    }
  }

  if (options.firstFrame) {
    const content = input.messages[0].content
    content.push({ image: options.firstFrame })
  }

  // 添加 parameters
  const parameters: Record<string, unknown> = {}

  if (isImage) {
    // 图像生成参数
    if (isKling) {
      // 可灵参数
      const ar = options.aspectRatio || '1:1'
      parameters.aspect_ratio = KLING_ASPECT_RATIO_MAP[ar] || ar
      parameters.n = options.n ?? 1
      parameters.resolution = options.resolution || '1k'
    } else {
      // 万相/Z-Image 参数
      if (options.size) {
        parameters.size = options.size
      } else if (options.aspectRatio && ASPECT_RATIO_MAP[options.aspectRatio]) {
        parameters.size = ASPECT_RATIO_MAP[options.aspectRatio]
      }
      parameters.n = options.n ?? (model === 'wan2.6-t2i' ? 1 : 4)
      parameters.prompt_extend = true
      parameters.watermark = false
    }
  } else if (isVideo) {
    // 视频生成参数
    parameters.resolution = options.resolution || '720P'
    parameters.duration = options.duration || 5
    parameters.watermark = options.watermark ?? false
    parameters.prompt_extend = true

    if (options.aspectRatio) {
      parameters.ratio = options.aspectRatio
    }

    // Vidu 特殊参数
    if (model.startsWith('vidu/')) {
      parameters.size = options.size || '1024*576'
    }
  }

  if (options.negativePrompt) {
    parameters.negative_prompt = options.negativePrompt
  }

  if (options.seed !== undefined) {
    parameters.seed = options.seed
  }

  if (Object.keys(parameters).length > 0) {
    body.parameters = parameters
  }

  // 确定 endpoint
  let endpoint: string
  if (isVideo) {
    endpoint = `${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`
  } else if (isKling || model.startsWith('wan2.5') || model.startsWith('wan2.2') || model.startsWith('wanx')) {
    endpoint = `${baseUrl}/api/v1/services/aigc/image-generation/generation`
  } else {
    // wan2.6, z-image 使用同步接口
    endpoint = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }

  // 异步任务需要 X-DashScope-Async header
  if (isVideo || isKling || model.startsWith('wan2.5') || model.startsWith('wan2.2') || model.startsWith('wanx')) {
    headers['X-DashScope-Async'] = 'enable'
  }

  let data: DashScopeSubmitResponse
  try {
    const result = await httpRequest<DashScopeSubmitResponse>(endpoint, {
      method: 'POST',
      headers,
      body,
      timeoutMs: 120_000
    })
    data = result.data
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Aliyun] Submit failed:', {
        status: err.status,
        body: err.body?.slice(0, 500),
        model,
        endpoint
      })
      throw new Error(`阿里云接口请求失败， ${err.status} ${err.body?.slice(0, 200)}`)
    }
    throw err
  }

  if (data.code) {
    console.error('[Aliyun] Submit error:', { code: data.code, message: data.message, model })
    throw new Error(`阿里云接口请求失败， ${data.message || 'Unknown error'} (code: ${data.code})`)
  }

  const taskId = data.output?.task_id
  if (!taskId) {
    console.error('[Aliyun] No task_id in response:', { data, model })
    throw new Error('阿里云接口未返回任务ID，请重试')
  }

  return taskId
}

/**
 * 查询异步任务结果
 */
async function getAsyncTaskResult(apiKey: string, baseUrl: string, taskId: string): Promise<DashScopeTaskResult> {
  try {
    const { data } = await httpRequest<DashScopeTaskResult>(`${baseUrl}/api/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      timeoutMs: 30_000
    })
    return data
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Aliyun] Query failed:', {
        status: err.status,
        body: err.body?.slice(0, 500),
        taskId
      })
      throw new Error(`阿里云接口请求失败， ${err.status} ${err.body?.slice(0, 200)}`)
    }
    throw err
  }
}

/**
 * 同步图像生成（wan2.6-t2i, z-image-turbo）
 */
async function generateSyncImage(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
  options: {
    size?: string
    aspectRatio?: string
    seed?: number
    negativePrompt?: string
  }
): Promise<GenerationOutput[]> {
  const body: Record<string, unknown> = {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }]
        }
      ]
    },
    parameters: {
      prompt_extend: false,
      watermark: false
    }
  }

  // 添加尺寸
  const parameters = body.parameters as Record<string, unknown>
  if (options.size) {
    parameters.size = options.size
  } else if (options.aspectRatio && ASPECT_RATIO_MAP[options.aspectRatio]) {
    parameters.size = ASPECT_RATIO_MAP[options.aspectRatio]
  }

  if (options.seed !== undefined) {
    parameters.seed = options.seed
  }

  let data: DashScopeSyncImageResponse
  try {
    const result = await httpRequest<DashScopeSyncImageResponse>(
      `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body,
        timeoutMs: 120_000
      }
    )
    data = result.data
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Aliyun] Sync image failed:', {
        status: err.status,
        body: err.body?.slice(0, 500),
        model
      })
      throw new Error(`阿里云接口请求失败， ${err.status} ${err.body?.slice(0, 200)}`)
    }
    throw err
  }

  if (data.code) {
    throw new Error(`阿里云接口请求失败， ${data.message || 'Unknown error'} (code: ${data.code})`)
  }

  const outputs: GenerationOutput[] = []
  const choices = data.output?.choices || []

  for (const choice of choices) {
    const content = choice.message?.content || []
    for (const item of content) {
      if (item.type === 'image' && item.image) {
        outputs.push({
          id: crypto.randomUUID(),
          type: 'image',
          url: item.image,
          mediaType: 'image/png'
        })
      }
    }
  }

  return outputs
}

/**
 * 轮询异步任务结果
 * 关键：每次状态更新后主动触发 onUpdate 回调，让队列推送进度到渲染进程
 */
async function pollAsyncTask(
  apiKey: string,
  baseUrl: string,
  taskId: string,
  task: GenerationTask,
  maxAttempts: number,
  pollInterval: number,
  outputType: 'image' | 'video'
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (task.status === 'cancelled') {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    const result = await getAsyncTaskResult(apiKey, baseUrl, taskId)

    const status = result.output?.task_status?.toUpperCase()

    if (status === 'SUCCEEDED') {
      const outputs: GenerationOutput[] = []

      // 图像结果
      if (outputType === 'image') {
        const choices = result.output?.choices || []
        for (const choice of choices) {
          const content = choice.message?.content || []
          for (const item of content) {
            if (item.type === 'image' && item.image) {
              outputs.push({
                id: crypto.randomUUID(),
                type: 'image',
                url: item.image,
                mediaType: 'image/png'
              })
            }
          }
        }
      }

      // 视频结果
      if (outputType === 'video') {
        const videoUrl = result.output?.video_url
        if (videoUrl) {
          outputs.push({
            id: crypto.randomUUID(),
            type: 'video',
            url: videoUrl,
            mediaType: 'video/mp4'
          })
        }
      }

      if (outputs.length === 0) {
        throw new Error('阿里云任务已完成但未返回结果')
      }

      task.outputs = outputs
      task.progress = 100
      task.stage = 'completed'
      return
    } else if (status === 'FAILED') {
      throw new Error(result.message || `阿里云任务失败： ${result.code || 'Unknown error'}`)
    } else if (status === 'UNKNOWN') {
      throw new Error('阿里云任务不存在或已过期')
    } else {
      // PENDING / RUNNING — 更新进度并触发回调
      updateTaskProgress(task, status === 'RUNNING' ? 'generating' : 'queued', status === 'RUNNING' ? 60 : 30)
    }
  }

  throw new Error(`阿里云${outputType === 'image' ? 'image' : 'video'} generation timed out`)
}

/**
 * Aliyun 图像生成执行器
 */
export async function executeAliyunImageGeneration(task: GenerationTask): Promise<void> {
  const { params } = task
  const startTime = Date.now()

  if (!params.providerId || !params.model) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model first')
  }

  if (!ALIYUN_IMAGE_MODELS.has(params.model)) {
    throw new Error(`ERR_UNSUPPORTED_ALIYUN_MODEL: Unsupported Aliyun image model: ${params.model}`)
  }

  const apiKey = await getProviderApiKey(params.providerId)
  if (!apiKey) {
    throw new Error('阿里云API密钥未配置，请在设置中填写DashScope API Key')
  }

  const baseUrl = await getProviderBaseUrl(params.providerId)

  console.log('[Aliyun] Image generation start:', {
    taskId: task.id,
    model: params.model,
    prompt: params.prompt?.slice(0, 100),
    size: params.size,
    aspectRatio: params.aspectRatio,
    seed: params.seed,
    isSync: SYNC_IMAGE_MODELS.has(params.model),
    baseUrl
  })

  // 同步生成模型（无异步任务，重试即重新生成）
  if (SYNC_IMAGE_MODELS.has(params.model)) {
    task.stage = 'submitting'
    task.progress = 10

    task.stage = 'generating'
    task.progress = 50

    console.log('[Aliyun] Sync image generate:', { model: params.model, prompt: params.prompt?.slice(0, 100) })
    const outputs = await generateSyncImage(apiKey, baseUrl, params.model, params.prompt, {
      size: params.size,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      negativePrompt: params.negativePrompt
    })

    if (outputs.length === 0) {
      throw new Error('阿里云图像生成未返回任何图片')
    }

    console.log('[Aliyun] Sync image completed:', {
      taskId: task.id,
      duration: `${Date.now() - startTime}ms`,
      outputCount: outputs.length
    })
    task.outputs = outputs
    task.progress = 100
    task.stage = 'completed'
    return
  }

  // 重试场景：如果已有 externalTaskId 且是 Aliyun 任务，直接轮询查询结果
  let taskId: string
  if (task.externalTaskId && task.externalProvider === 'aliyun') {
    taskId = task.externalTaskId
    console.log('[Aliyun] Retry mode, using existing taskId:', taskId)
    task.stage = 'queued'
    task.progress = 20
  } else {
    // 新任务：提交
    task.stage = 'submitting'
    task.progress = 10

    console.log('[Aliyun] Submit async image:', {
      model: params.model,
      prompt: params.prompt?.slice(0, 100),
      n: params.n
    })
    taskId = await submitAsyncTask(apiKey, baseUrl, params.model, params.prompt, {
      size: params.size,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      referenceImages: params.referenceImages,
      negativePrompt: params.negativePrompt,
      n: params.n
    })

    console.log('[Aliyun] Async image submitted:', { taskId, model: params.model })
    // 保存供应商任务 ID，用于重试时直接查询
    task.externalTaskId = taskId
    task.externalProvider = 'aliyun'

    task.stage = 'queued'
    task.progress = 20
  }

  // 轮询获取结果
  try {
    await pollAsyncTask(apiKey, baseUrl, taskId, task, 120, 5000, 'image')
    console.log('[Aliyun] Image generation completed:', {
      taskId: task.id,
      externalTaskId: taskId,
      duration: `${Date.now() - startTime}ms`,
      outputCount: task.outputs.length,
      outputs: task.outputs.map((o) => ({ type: o.type, hasUrl: !!o.url, hasBase64: !!o.base64 }))
    })
  } catch (err) {
    console.error('[Aliyun] Image generation failed:', {
      taskId: task.id,
      externalTaskId: taskId,
      duration: `${Date.now() - startTime}ms`,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }
}

/**
 * Aliyun 视频生成执行器
 */
export async function executeAliyunVideoGeneration(task: GenerationTask): Promise<void> {
  const { params } = task
  const startTime = Date.now()

  if (!params.providerId || !params.model) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model first')
  }

  if (!ALIYUN_VIDEO_MODELS.has(params.model)) {
    throw new Error(`ERR_UNSUPPORTED_ALIYUN_MODEL: Unsupported Aliyun video model: ${params.model}`)
  }

  const apiKey = await getProviderApiKey(params.providerId)
  if (!apiKey) {
    throw new Error('阿里云API密钥未配置，请在设置中填写DashScope API Key')
  }

  const baseUrl = await getProviderBaseUrl(params.providerId)

  console.log('[Aliyun] Video generation start:', {
    taskId: task.id,
    model: params.model,
    prompt: params.prompt?.slice(0, 100),
    size: params.size,
    aspectRatio: params.aspectRatio,
    seed: params.seed,
    duration: params.duration,
    resolution: params.quality === 'hd' ? '1080P' : '720P',
    hasReferenceImages: !!params.referenceImages?.length,
    hasFirstFrame: !!params.firstFrame,
    baseUrl
  })

  // 重试场景：如果已有 externalTaskId 且是 Aliyun 任务，直接轮询查询结果
  let taskId: string
  if (task.externalTaskId && task.externalProvider === 'aliyun') {
    taskId = task.externalTaskId
    console.log('[Aliyun] Retry mode, using existing taskId:', taskId)
    task.stage = 'queued'
    task.progress = 20
  } else {
    // 新任务：提交
    task.stage = 'submitting'
    task.progress = 10

    console.log('[Aliyun] Submit async video:', {
      model: params.model,
      prompt: params.prompt?.slice(0, 100),
      duration: params.duration
    })
    const durationNum = params.duration != null ? Number(params.duration) : NaN
    taskId = await submitAsyncTask(apiKey, baseUrl, params.model, params.prompt, {
      size: params.size,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      referenceImages: params.referenceImages,
      firstFrame: params.firstFrame,
      negativePrompt: params.negativePrompt,
      resolution: params.quality === 'hd' ? '1080P' : '720P',
      duration: Number.isFinite(durationNum) ? durationNum : undefined,
      watermark: false
    })

    console.log('[Aliyun] Async video submitted:', { taskId, model: params.model })
    // 保存供应商任务 ID，用于重试时直接查询
    task.externalTaskId = taskId
    task.externalProvider = 'aliyun'

    task.stage = 'queued'
    task.progress = 20
  }

  // 轮询获取结果（视频需要更长时间）
  try {
    await pollAsyncTask(apiKey, baseUrl, taskId, task, 180, 8000, 'video')
    console.log('[Aliyun] Video generation completed:', {
      taskId: task.id,
      externalTaskId: taskId,
      duration: `${Date.now() - startTime}ms`,
      outputCount: task.outputs.length,
      outputs: task.outputs.map((o) => ({
        type: o.type,
        hasUrl: !!o.url,
        hasBase64: !!o.base64,
        mediaType: o.mediaType
      }))
    })
  } catch (err) {
    console.error('[Aliyun] Video generation failed:', {
      taskId: task.id,
      externalTaskId: taskId,
      duration: `${Date.now() - startTime}ms`,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }
}
