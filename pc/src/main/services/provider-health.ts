/**
 * Provider Health Monitor — 跟踪每个 Provider 渠道的健康状态。
 *
 * 核心指标：
 * - successCount / failureCount
 * - avgLatency（指数移动平均）
 * - lastError
 * - circuitOpen（熔断状态）
 * - healthScore（0–100，综合加权评分）
 *
 * 熔断策略：
 * - 连续失败 5 次 → 熔断打开（拒绝请求）
 * - 熔断后 30s → 半开（允许 1 次探测请求）
 * - 探测成功 → 关闭熔断
 * - 探测失败 → 重新熔断，冷却时间翻倍
 */

interface ProviderChannelHealth {
  providerId: string
  successCount: number
  failureCount: number
  consecutiveFailures: number
  avgLatency: number  // EMA
  lastError: string | null
  lastErrorAt: number | null

  // 熔断
  circuitOpen: boolean
  circuitOpenedAt: number | null
  halfOpenAt: number | null
  cooldownMs: number       // 当前冷却时间

  // 限流
  rateLimitRPM: number     // 每分钟最大请求数
  requestTimestamps: number[]
}

const healthMap = new Map<string, ProviderChannelHealth>()
const DEFAULT_COOLDOWN = 30_000        // 30 秒
const MAX_CONSECUTIVE_FAILURES = 5
const MAX_COOLDOWN = 300_000           // 5 分钟

function getOrCreate(key: string): ProviderChannelHealth {
  let h = healthMap.get(key)
  if (!h) {
    h = {
      providerId: key.split(':')[0],
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      avgLatency: 0,
      lastError: null,
      lastErrorAt: null,
      circuitOpen: false,
      circuitOpenedAt: null,
      halfOpenAt: null,
      cooldownMs: DEFAULT_COOLDOWN,
      rateLimitRPM: 60,
      requestTimestamps: []
    }
    healthMap.set(key, h)
  }
  return h
}

/** 生成每个 channel 的唯一 key */
function channelKey(providerId: string, channelId?: string): string {
  return channelId ? `${providerId}:${channelId}` : providerId
}

// ── 公共 API ──

export function recordSuccess(providerId: string, latency: number, channelId?: string): void {
  const h = getOrCreate(channelKey(providerId, channelId))
  h.successCount++
  h.consecutiveFailures = 0
  h.avgLatency = h.avgLatency === 0 ? latency : h.avgLatency * 0.7 + latency * 0.3
  h.requestTimestamps.push(Date.now())

  // 清除熔断
  if (h.circuitOpen || h.halfOpenAt) {
    h.circuitOpen = false
    h.circuitOpenedAt = null
    h.halfOpenAt = null
    h.cooldownMs = DEFAULT_COOLDOWN
  }

  // 清理旧的时间戳
  cleanTimestamps(h)
}

export function recordFailure(providerId: string, error: string, channelId?: string): void {
  const h = getOrCreate(channelKey(providerId, channelId))
  h.failureCount++
  h.consecutiveFailures++
  h.lastError = error
  h.lastErrorAt = Date.now()
  h.requestTimestamps.push(Date.now())

  if (h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !h.circuitOpen) {
    h.circuitOpen = true
    h.circuitOpenedAt = Date.now()
  }

  cleanTimestamps(h)
}

/** 检查是否熔断（调用前检查） */
export function isCircuitOpen(providerId: string, channelId?: string): boolean {
  const h = healthMap.get(channelKey(providerId, channelId))
  if (!h) return false
  if (!h.circuitOpen) return false

  // 检查是否到了半开时间
  const elapsed = Date.now() - (h.circuitOpenedAt || 0)
  if (elapsed > h.cooldownMs) {
    if (!h.halfOpenAt) {
      h.halfOpenAt = Date.now()
      return false // 允许一次探测
    }
    // 半开探测已经发过 → 重新熔断
    h.circuitOpenedAt = Date.now()
    h.halfOpenAt = null
    h.cooldownMs = Math.min(h.cooldownMs * 2, MAX_COOLDOWN)
    return true
  }

  return true
}

/** 检查速率限制 */
export function isRateLimited(providerId: string, channelId?: string): boolean {
  const h = healthMap.get(channelKey(providerId, channelId))
  if (!h) return false

  cleanTimestamps(h)
  return h.requestTimestamps.length >= h.rateLimitRPM
}

/** 健康评分（0–100） */
export function getHealthScore(providerId: string, channelId?: string): number {
  const h = healthMap.get(channelKey(providerId, channelId))
  if (!h) return 100

  if (h.circuitOpen) return 0

  const total = h.successCount + h.failureCount
  if (total === 0) return 100

  const successRate = h.successCount / total
  const latencyPenalty = Math.min(h.avgLatency / 10000, 1) * 20 // 10s+ latency = -20
  const consecutivePenalty = Math.min(h.consecutiveFailures * 5, 30)  // 每连续失败 -5，最多 -30

  return Math.max(0, Math.round(successRate * 100 - latencyPenalty - consecutivePenalty))
}

/** 获取所有 Provider 的健康摘要 */
export function getHealthSummary(): Array<{
  providerId: string
  channelId?: string
  healthScore: number
  circuitOpen: boolean
  successCount: number
  failureCount: number
  avgLatency: number
  lastError: string | null
}> {
  const result: ReturnType<typeof getHealthSummary> = []
  for (const [key, h] of healthMap) {
    const [providerId, channelId] = key.split(':')
    result.push({
      providerId,
      channelId: channelId || undefined,
      healthScore: getHealthScore(providerId, channelId),
      circuitOpen: h.circuitOpen,
      successCount: h.successCount,
      failureCount: h.failureCount,
      avgLatency: Math.round(h.avgLatency),
      lastError: h.lastError
    })
  }
  return result.sort((a, b) => b.healthScore - a.healthScore)
}

/** 重置所有状态（用于测试） */
export function resetHealthState(): void {
  healthMap.clear()
}

/** 设置限流 RPM */
export function setRateLimitRPM(providerId: string, rpm: number, channelId?: string): void {
  const h = getOrCreate(channelKey(providerId, channelId))
  h.rateLimitRPM = rpm
}

// ── 内部 ──

function cleanTimestamps(h: ProviderChannelHealth): void {
  const now = Date.now()
  const cutoff = now - 60_000 // 1 分钟窗口
  h.requestTimestamps = h.requestTimestamps.filter((t) => t > cutoff)
}
