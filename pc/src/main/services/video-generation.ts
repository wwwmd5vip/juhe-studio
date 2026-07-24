/**
 * 视频生成服务
 * M4 Phase 1: 通过 FAL.AI 聚合器实现视频生成
 *
 * FAL.AI API 文档: https://fal.ai/docs
 * 支持模型: kling-video, luma-dream-machine, runway-gen4, wan-video 等
 */

import type { GenerationOutput, GenerationTask } from '@shared/types/generation'
import { httpRequest, HttpError } from '@shared/utils/http-client'

// FAL.AI API 配置
const FAL_BASE_URL = 'https://queue.fal.run'

// 模型映射: 内部 ID -> FAL endpoint
const FAL_MODEL_ENDPOINTS: Record<string, string> = {
  'kling-3.0': 'fal-ai/kling-video/v1/standard/text-to-video',
  'kling-2.0': 'fal-ai/kling-video/v1/standard/text-to-video',
  'seedance-2.0': 'fal-ai/seedance/v1/text-to-video',
  'veo-3.1': 'fal-ai/veo/v3.1/text-to-video',
  'wan-2.6': 'fal-ai/wan/v2.6/text-to-video',
  'luma-ray3': 'fal-ai/luma-ray/v2/text-to-video'
}

interface FalQueueResponse {
  request_id: string
  status: string
  response_url: string
  status_url: string
}

interface FalVideoResult {
  video?: {
    url: string
    file_name: string
    file_size: number
    content_type: string
  }
  images?: Array<{
    url: string
  }>
  seed?: number
}

/**
 * 提交视频生成任务到 FAL.AI 队列
 */
export async function submitVideoGeneration(task: GenerationTask): Promise<void> {
  const { params } = task

  if (!params.providerId || !params.model) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model for video generation')
  }

  // 防误路由：FAL 执行器只服务 FAL provider。
  // 非 FAL provider（如 juhe-management）的视频任务发到这里说明上游类型推断出错，
  // 绝不能静默地用错误的凭据调用 fal.run。
  const presetId = await getProviderPresetId(params.providerId)
  if (presetId !== 'fal') {
    throw new Error(
      `ERR_VIDEO_UNSUPPORTED_PROVIDER: 视频生成当前仅支持 FAL 渠道（当前 provider: ${params.providerId}）。请确认没有误选视频生成类型，或在设置中配置 FAL provider`
    )
  }

  // 获取 API Key (从 provider 配置或环境变量)
  const apiKey = await getApiKey(params.providerId)
  if (!apiKey) {
    throw new Error('ERR_FAL_NO_API_KEY: FAL.AI API key not configured')
  }

  const endpoint = FAL_MODEL_ENDPOINTS[params.videoModel || 'kling-3.0']
  if (!endpoint) {
    throw new Error(`ERR_UNSUPPORTED_VIDEO_MODEL: Unsupported video model: ${params.videoModel}`)
  }

  task.stage = 'submitting'
  task.progress = 10

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    prompt: params.prompt,
    duration: params.duration || 5,
    aspect_ratio: params.aspectRatio || '16:9'
  }

  if (params.negativePrompt) {
    requestBody.negative_prompt = params.negativePrompt
  }

  if (params.seed !== undefined) {
    requestBody.seed = params.seed
  }

  // img2video: 如果有参考图
  if (params.referenceImages && params.referenceImages.length > 0) {
    requestBody.image_url = params.referenceImages[0]
  }

  const url = `${FAL_BASE_URL}/${endpoint}`

  // 提交到 FAL 队列
  let queueData: FalQueueResponse
  try {
    const { data } = await httpRequest<FalQueueResponse>(url, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}` },
      body: requestBody,
      timeoutMs: 120_000
    })
    queueData = data
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Video] FAL API 返回错误:', {
        status: err.status,
        statusText: err.statusText,
        body: err.body.slice(0, 500),
        endpoint: url,
        model: params.videoModel,
        prompt: params.prompt?.slice(0, 100)
      })
      throw new Error(`ERR_FAL_API_ERROR: FAL API error: ${err.status} ${err.body}`)
    }
    console.error('[Video] 网络请求失败:', {
      endpoint: url,
      model: params.videoModel,
      prompt: params.prompt?.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  task.stage = 'queued'
  task.progress = 20

  // 轮询获取结果
  await pollFalResult(task, queueData.status_url, queueData.response_url, apiKey)
}

/**
 * 轮询 FAL.AI 任务结果
 */
async function pollFalResult(
  task: GenerationTask,
  statusUrl: string,
  responseUrl: string,
  apiKey: string
): Promise<void> {
  const maxAttempts = 120 // 最多轮询 120 次 (约 10 分钟)
  const pollInterval = 5000 // 每 5 秒轮询一次

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 检查任务是否被取消
    if (task.status === 'cancelled') {
      return
    }

    // 查询状态
    let statusData: { status: string }
    try {
      const { data } = await httpRequest<{ status: string }>(statusUrl, {
        method: 'GET',
        headers: { Authorization: `Key ${apiKey}` },
        timeoutMs: 30_000
      })
      statusData = data
    } catch (err) {
      if (err instanceof HttpError) {
        console.error('[Video] 查询状态失败:', {
          status: err.status,
          body: err.body.slice(0, 500),
          statusUrl,
          attempt,
          model: task.params.videoModel
        })
        throw new Error(`ERR_FAL_STATUS_ERROR: FAL status query error: ${err.status}`)
      }
      console.error('[Video] 查询状态网络错误:', {
        statusUrl,
        attempt,
        model: task.params.videoModel,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      throw err
    }

    if (statusData.status === 'COMPLETED') {
      // 获取结果
      let result: FalVideoResult
      try {
        const { data } = await httpRequest<FalVideoResult>(responseUrl, {
          method: 'GET',
          headers: { Authorization: `Key ${apiKey}` },
          timeoutMs: 30_000
        })
        result = data
      } catch (err) {
        if (err instanceof HttpError) {
          console.error('[Video] 获取结果失败:', {
            status: err.status,
            body: err.body.slice(0, 500),
            responseUrl,
            model: task.params.videoModel
          })
          throw new Error(`ERR_FAL_RESULT_ERROR: FAL result fetch error: ${err.status}`)
        }
        console.error('[Video] 获取结果网络错误:', {
          responseUrl,
          model: task.params.videoModel,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        })
        throw err
      }

      // 解析输出
      const outputs: GenerationOutput[] = []

      if (result.video) {
        outputs.push({
          id: `${task.id}-0`,
          type: 'video',
          url: result.video.url,
          mediaType: result.video.content_type || 'video/mp4'
        })
      }

      task.outputs = outputs
      task.progress = 100
      task.stage = 'completed'
      return
    } else if (statusData.status === 'FAILED') {
      console.error('[Video] FAL.AI 任务失败:', {
        statusUrl,
        model: task.params.videoModel,
        prompt: task.params.prompt?.slice(0, 100)
      })
      throw new Error('ERR_FAL_GENERATION_FAILED: FAL.AI video generation failed')
    } else {
      // IN_PROGRESS 或 IN_QUEUE
      task.stage = statusData.status === 'IN_PROGRESS' ? 'generating' : 'queued'
      task.progress = statusData.status === 'IN_PROGRESS' ? 60 : 30
    }

    // 等待下一轮
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  console.error('[Video] Video generation timed out:', {
    statusUrl,
    model: task.params.videoModel,
    prompt: task.params.prompt?.slice(0, 100),
    maxAttempts,
    totalTimeMs: maxAttempts * pollInterval
  })
  throw new Error('ERR_VIDEO_TIMEOUT: Video generation timed out (exceeded 10 minutes)')
}

/**
 * 查询 provider 的 presetId（用于校验执行器与 provider 是否匹配）
 */
async function getProviderPresetId(providerId: string): Promise<string | null> {
  const { db } = await import('../db')
  const { providers } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')

  const result = await db
    .select({ presetId: providers.presetId })
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1)

  return result[0]?.presetId ?? null
}

/**
 * 获取 API Key (decrypted from secure storage)
 */
async function getApiKey(providerId: string): Promise<string | null> {
  // 从 provider 配置中获取
  const { db } = await import('../db')
  const { providers } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')

  const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)

  if (result.length > 0 && result[0].apiKey) {
    try {
      const { decryptApiKey } = await import('../services/secure-storage')
      return decryptApiKey(result[0].apiKey)
    } catch (err) {
      console.error('[Video] 解密 API 密钥失败:', {
        providerId,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  // 尝试从环境变量获取
  return process.env.FAL_API_KEY || null
}

/**
 * 取消视频生成任务
 * 注: FAL.AI 队列任务取消需要通过 webhook 或忽略结果实现
 */
export async function cancelVideoGeneration(_taskId: string): Promise<boolean> {
  // FAL.AI does not support cancelling queued tasks.
  // The task will be marked as cancelled locally in the queue,
  // and polling will skip it.
  return false
}
