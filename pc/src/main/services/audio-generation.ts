/**
 * 音频生成服务
 * 支持 OpenAI TTS 兼容 API 和 FAL.AI 音频模型
 */

import type { GenerationOutput, GenerationTask } from '@shared/types/generation'
import { httpRequest, HttpError } from '@shared/utils/http-client'

// OpenAI TTS 兼容端点映射
const TTS_MODEL_ENDPOINTS: Record<string, string> = {
  'tts-1': '/v1/audio/speech',
  'tts-1-hd': '/v1/audio/speech',
  'openai-tts': '/v1/audio/speech'
}

// 默认 TTS 语音选项
const TTS_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse']

/**
 * 执行音频生成任务
 */
export async function executeAudioGeneration(task: GenerationTask): Promise<void> {
  const { params } = task

  if (!params.providerId) {
    throw new Error('ERR_NO_PROVIDER: Please select a provider for audio generation')
  }

  const model = params.model || 'tts-1'
  const apiKey = await getProviderApiKey(params.providerId)
  if (!apiKey) {
    throw new Error('ERR_NO_API_KEY: API key not configured for audio generation')
  }

  task.stage = 'submitting'
  task.progress = 10

  // 获取 provider 的 baseUrl
  const baseUrl = await getProviderBaseUrl(params.providerId)

  // 语音选项
  const voice = params.audioVoice || 'alloy'
  const speed = params.audioSpeed || '1.0'
  const format = params.audioFormat || 'mp3'
  const instructions = params.audioInstructions || ''

  // 构建请求体
  const requestBody: Record<string, unknown> = {
    model,
    input: params.prompt,
    voice: TTS_VOICES.includes(voice) ? voice : 'alloy',
    response_format: format,
    speed: parseFloat(speed) || 1.0
  }

  if (instructions) {
    requestBody.instructions = instructions
  }

  const url = `${baseUrl}${TTS_MODEL_ENDPOINTS[model] || '/v1/audio/speech'}`

  task.stage = 'generating'
  task.progress = 30

  console.log('[Audio] 发起音频生成请求:', {
    model,
    providerId: params.providerId,
    voice,
    speed,
    format,
    promptLength: params.prompt?.length
  })

  let response: Response
  try {
    const result = await httpRequest(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: requestBody,
      signal: task.abortController?.signal,
      raw: true
    })
    response = result.response
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Audio] API 返回错误:', {
        status: err.status,
        statusText: err.statusText,
        body: err.body?.slice(0, 500),
        model,
        prompt: params.prompt?.slice(0, 100)
      })
      throw new Error(`ERR_AUDIO_API_ERROR: API error: ${err.status} ${err.body}`)
    }
    console.error('[Audio] 网络请求失败:', {
      url,
      model,
      prompt: params.prompt?.slice(0, 100),
      error: err instanceof Error ? err.message : String(err)
    })
    throw err
  }

  task.progress = 70
  task.stage = 'processing'

  // 获取音频数据（音频响应为二进制，需从原始 response 读取 arrayBuffer）
  let audioBuffer: Buffer
  try {
    const arrayBuffer = await response.arrayBuffer()
    audioBuffer = Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[Audio] 读取音频响应失败:', err)
    throw new Error('ERR_AUDIO_READ_FAILED: Failed to read audio response')
  }

  task.progress = 90

  // 将音频保存为临时文件并上传
  const mimeType =
    format === 'mp3'
      ? 'audio/mpeg'
      : format === 'opus'
        ? 'audio/ogg'
        : format === 'aac'
          ? 'audio/aac'
          : format === 'flac'
            ? 'audio/flac'
            : format === 'pcm'
              ? 'audio/wav'
              : format === 'wav'
                ? 'audio/wav'
                : 'audio/mpeg'

  const dataUrl = `data:${mimeType};base64,${audioBuffer.toString('base64')}`

  const outputs: GenerationOutput[] = [
    {
      id: `${task.id}-audio-0`,
      type: 'audio',
      base64: dataUrl,
      mediaType: mimeType
    }
  ]

  task.outputs = outputs
  task.stage = 'completed'
  task.progress = 100

  console.log('[Audio] 生成完成:', {
    taskId: task.id,
    size: audioBuffer.length,
    format,
    mimeType
  })
}

/**
 * 从 provider 配置中获取 API Key
 */
async function getProviderApiKey(providerId: string): Promise<string | null> {
  const { db } = await import('../db')
  const { providers } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')

  const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)

  if (result.length > 0 && result[0].apiKey) {
    try {
      const { decryptApiKey } = await import('./secure-storage')
      return decryptApiKey(result[0].apiKey)
    } catch (err) {
      console.error('[Audio] 解密 API 密钥失败:', {
        providerId,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  return null
}

/**
 * 获取 provider 的 base URL
 */
async function getProviderBaseUrl(providerId: string): Promise<string> {
  const { db } = await import('../db')
  const { providers } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')

  const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)
  const baseUrl = result[0]?.baseUrl || 'https://api.openai.com'
  return baseUrl.replace(/\/+$/, '') // 去除尾部斜杠
}

/**
 * 取消音频生成任务
 */
export async function cancelAudioGeneration(_taskId: string): Promise<boolean> {
  // 音频生成通常很快完成，无需主动取消
  return true
}
