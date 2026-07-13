import type { GenerationParams, GenerationTask, GenerationType, TaskPriority } from '@shared/types/generation'
import type { ModelCapability } from '@shared/types/provider'
import { ALIYUN_IMAGE_MODELS, ALIYUN_VIDEO_MODELS } from '@shared/constants/provider-mapping'
import { eq } from 'drizzle-orm'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import { db } from '../db'
import { models, providers } from '../db/schema'
import { getGenerationQueue } from './queue'

const JIMENG_MODEL_ALIASES: Record<string, string> = {
  'jimeng-i2v-first-v30': 'jimeng-i2v-s2-pro'
}

export async function createRoutedGenerationTask(
  params: GenerationParams,
  priority: TaskPriority = 'normal'
): Promise<GenerationTask> {
  const queue = getGenerationQueue()

  let resolvedParams = params
  const requiredCapability = getRequiredCapability(resolvedParams)

  // 如果调用方只给了 model 没给 providerId（例如旧 workflow 节点只存了 model），
  // 按 model id 反查所属 provider 并补全，避免下游执行器因缺少 providerId 拒绝。
  // 同时校验 model 是否支持当前生成模式，给出可操作的错误信息。
  const modelId = resolvedParams.model
  if (modelId) {
    try {
      const modelResult = await db
        .select({
          providerId: models.providerId,
          type: models.type,
          capabilities: models.capabilities
        })
        .from(models)
        .where(eq(models.id, modelId))
        .limit(1)
      const modelRow = modelResult[0]
      if (modelRow) {
        if (!resolvedParams.providerId && modelRow.providerId) {
          resolvedParams = { ...resolvedParams, providerId: modelRow.providerId }
        }
        if (requiredCapability) {
          const caps = resolveModelCapabilities({
            name: modelId,
            type: modelRow.type,
            capabilities: Array.isArray(modelRow.capabilities) ? modelRow.capabilities : null
          })
          if (!caps.includes(requiredCapability)) {
            throw new Error(
              `模型 "${modelId}" 不支持${capabilityLabel(requiredCapability)}生成，请在工作流节点重新选择对应类型的模型`
            )
          }
        }
      }
    } catch (err) {
      // 把明确的校验错误直接抛出去；DB/未知错误只记录，不阻塞（让上游兜底）
      if (err instanceof Error && err.message.includes('不支持')) {
        throw err
      }
      console.warn('[GenerationRouter] Failed to resolve/validate model:', err)
    }
  }

  // 查询 provider presetId
  let providerPresetId: string | null = null
  if (resolvedParams.providerId) {
    try {
      const providerResult = await db
        .select({ presetId: providers.presetId })
        .from(providers)
        .where(eq(providers.id, resolvedParams.providerId))
        .limit(1)
      providerPresetId = providerResult[0]?.presetId || null
    } catch (err) {
      console.warn('[GenerationRouter] Failed to query provider presetId:', err)
    }
  }

  // Jimeng 路由
  if (providerPresetId === 'jimeng' || resolvedParams.model?.startsWith('jimeng-')) {
    const modelName = resolvedParams.model || ''
    const normalizedModel = JIMENG_MODEL_ALIASES[modelName] || modelName
    if (normalizedModel !== resolvedParams.model) {
      resolvedParams = { ...resolvedParams, model: normalizedModel }
    }
    return queue.createTask('jimeng' as GenerationType, resolvedParams, priority)
  }

  // Aliyun 路由
  if (providerPresetId === 'aliyun') {
    if (ALIYUN_IMAGE_MODELS.has(resolvedParams.model || '')) {
      return queue.createTask('aliyun-image' as GenerationType, resolvedParams, priority)
    }
    if (ALIYUN_VIDEO_MODELS.has(resolvedParams.model || '')) {
      return queue.createTask('aliyun-video' as GenerationType, resolvedParams, priority)
    }
    console.warn('[GenerationRouter] Aliyun provider but unsupported model:', resolvedParams.model)
  }

  // 默认路由：根据 params 推断 type
  const type: GenerationType = inferGenerationType(resolvedParams)
  return queue.createTask(type, resolvedParams, priority)
}

function inferGenerationType(params: GenerationParams): GenerationType {
  // 优先使用显式生成模式
  if (params.generationMode === 'audio') return 'audio'
  if (params.generationMode === 'video') return 'video'
  if (params.generationMode === 'text') return 'text'
  // 回退到旧逻辑
  if (params.videoUrl || params.videoUrls) return 'video'
  if (params.firstFrame || params.lastFrame) return 'video'
  return 'image'
}

function getRequiredCapability(params: GenerationParams): ModelCapability | null {
  if (params.generationMode === 'audio') return 'audio'
  if (params.generationMode === 'video') return 'video'
  if (params.generationMode === 'text') return 'chat'
  if (params.generationMode === 'image') return 'image'
  // 回退到旧逻辑
  if (params.videoUrl || params.videoUrls || params.firstFrame || params.lastFrame) return 'video'
  return 'image'
}

function capabilityLabel(cap: ModelCapability): string {
  switch (cap) {
    case 'image':
      return '图像'
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
    case 'chat':
      return '文本'
    default:
      return String(cap)
  }
}
