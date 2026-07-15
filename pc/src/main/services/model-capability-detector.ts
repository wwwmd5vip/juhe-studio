/**
 * Model Capability Detection Service
 *
 * 三级能力检测:
 *   1. DB 显式配置 (models.capabilities JSON)
 *   2. 名称正则推断 (resolveModelCapabilities)
 *   3. 轻量探针测试 (function_calling probe)
 *
 * 对标 RedBox/flowmuse 的模型能力系统。
 */
import { eq } from 'drizzle-orm'
import { generateText } from '@cherrystudio/ai-core'
import { resolveProvider } from '../utils/provider-resolver'
import { db } from '../db'
import { models } from '../db/schema'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import type { ModelCapability } from '@shared/types/provider'

// ── 缓存 ──

interface CachedCapability {
  capabilities: ModelCapability[]
  timestamp: number
  probed: boolean
}

const capabilityCache = new Map<string, CachedCapability>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 分钟

// ── Function Calling 探针 ──

const PROBE_SYSTEM_PROMPT = `You are a function calling test. Respond ONLY with: {"function_calling": true}. Do not add any other text.`

const PROBE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'capability_test',
    description: 'Test if function calling works',
    parameters: {
      type: 'object' as const,
      properties: {
        function_calling: { type: 'boolean' as const }
      },
      required: ['function_calling']
    }
  }
}

/**
 * 探测模型是否支持 function calling。
 * 发送一个简单的 tool-use 请求，检查模型是否返回 tool-call。
 */
async function probeFunctionCalling(
  providerId: string,
  modelId: string
): Promise<boolean> {
  try {
    const resolved = await resolveProvider(providerId)

    const settings: Record<string, string> = {}
    if (resolved.apiKey) settings.apiKey = resolved.apiKey
    if (resolved.baseURL) settings.baseURL = resolved.baseURL

    const result = await generateText(
      resolved.providerId as Parameters<typeof generateText>[0],
      settings as never,
      {
        model: modelId,
        messages: [
          { role: 'system', content: PROBE_SYSTEM_PROMPT },
          { role: 'user', content: 'Test function calling.' }
        ],
        maxRetries: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: { capability_test: PROBE_TOOL } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toolChoice: 'required' as any,
        temperature: 0
      }
    )

    // 检查是否有 tool-call 结果
    const text = result.text || ''
    // 如果模型响应中包含 "tool" 或模型实际执行了工具调用
    // generateText with toolChoice=required will throw if tools aren't supported
    return true
  } catch {
    // 任何错误（超时、API 不支持 tools 参数等）都意味着不支持
    return false
  }
}

// ── 主要 API ──

export interface DetectionResult {
  capabilities: ModelCapability[]
  source: 'explicit' | 'inferred' | 'probed'
  probedFunctionCalling?: boolean
}

/**
 * 检测模型能力。
 * 优先使用 DB 显式配置，其次名称推断，最后探针测试。
 */
export async function detectModelCapabilities(
  modelId: string,
  providerId?: string
): Promise<DetectionResult> {
  const cacheKey = `${modelId}:${providerId || 'unknown'}`
  const cached = capabilityCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      capabilities: cached.capabilities,
      source: cached.probed ? 'probed' : 'inferred',
      probedFunctionCalling: cached.probed
    }
  }

  // Level 1: DB 显式配置
  const modelRows = await db
    .select({ capabilities: models.capabilities, name: models.name })
    .from(models)
    .where(eq(models.id, modelId))
    .limit(1)

  const modelRow = modelRows[0]
  if (modelRow?.capabilities) {
    const explicitCaps = (modelRow.capabilities as string[]) ?? []
    if (explicitCaps.length > 0) {
      const caps = resolveModelCapabilities({
        name: modelRow.name || modelId,
        capabilities: explicitCaps
      })
      capabilityCache.set(cacheKey, { capabilities: caps, timestamp: Date.now(), probed: false })
      return { capabilities: caps, source: 'explicit' }
    }
  }

  // Level 2: 名称推断
  const inferredCaps = resolveModelCapabilities({
    name: modelId,
    capabilities: modelRow?.capabilities as string[] | undefined
  })

  // Level 3: Function calling 探针（异步，非阻塞）
  // 仅在推断不支持 function_calling 且提供了 providerId 时探测
  let probed = false
  if (!inferredCaps.includes('function_calling') && providerId) {
    try {
      probed = await probeFunctionCalling(providerId, modelId)
      if (probed && !inferredCaps.includes('function_calling')) {
        inferredCaps.push('function_calling')
      }
    } catch {
      // 探测失败，保持推断结果
    }
  }

  capabilityCache.set(cacheKey, { capabilities: inferredCaps, timestamp: Date.now(), probed })
  return {
    capabilities: inferredCaps,
    source: probed ? 'probed' : 'inferred',
    probedFunctionCalling: probed
  }
}

/**
 * 批量检测多个模型的能力。
 */
export async function detectMultipleModelCapabilities(
  models: Array<{ modelId: string; providerId: string }>
): Promise<Map<string, DetectionResult>> {
  const results = new Map<string, DetectionResult>()

  // 并行检测
  const promises = models.map(async ({ modelId, providerId }) => {
    const result = await detectModelCapabilities(modelId, providerId)
    results.set(modelId, result)
  })

  await Promise.allSettled(promises)
  return results
}

/**
 * 清除缓存。
 */
export function clearCapabilityCache(): void {
  capabilityCache.clear()
}
