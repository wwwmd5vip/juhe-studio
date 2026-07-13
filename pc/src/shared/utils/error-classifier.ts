/**
 * 错误分类器（统一实现）
 *
 * 合并了三处独立的错误分类逻辑：
 * - classifyError / getHttpStatusLabel：来自 renderer/src/utils/errorClassifier.ts
 * - getFriendlyErrorMessage：来自 main/ipc/providers.ts 的 classifyFetchError
 * - isNetworkError / errorMessage：新增工具函数
 */

import type { ErrorClassification, SerializedError } from '@shared/types/chat'

export function classifyError(error?: SerializedError, providerId?: string): ErrorClassification {
  const msg = (error?.message || '').toLowerCase()
  const providerSuffix = providerId ? `?id=${providerId}` : ''

  if (!error) {
    return { category: 'unknown', i18nKey: 'error.diagnosis.unknown', navTarget: null }
  }

  const status =
    (error as unknown as Record<string, unknown>).statusCode ?? (error as unknown as Record<string, unknown>).status
  const numStatus = typeof status === 'number' ? status : typeof status === 'string' ? parseInt(status, 10) : undefined

  // Auth errors (401/403)
  if (
    numStatus === 401 ||
    numStatus === 403 ||
    msg.includes('invalid_api_key') ||
    msg.includes('authentication') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('api key')
  ) {
    return { category: 'auth', i18nKey: 'error.diagnosis.auth', navTarget: `/settings/providers${providerSuffix}` }
  }

  // Model not found (404)
  if (
    numStatus === 404 ||
    msg.includes('model_not_found') ||
    msg.includes('model not found') ||
    msg.includes('model does not exist')
  ) {
    return { category: 'model', i18nKey: 'error.diagnosis.model', navTarget: `/settings/providers${providerSuffix}` }
  }

  // Quota / rate limit (429)
  if (
    numStatus === 429 ||
    msg.includes('quota') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('insufficient_balance') ||
    msg.includes('insufficient_quota') ||
    msg.includes('too many requests')
  ) {
    return { category: 'quota', i18nKey: 'error.diagnosis.quota', navTarget: `/settings/providers${providerSuffix}` }
  }

  // Context length exceeded
  if (
    msg.includes('context_length_exceeded') ||
    msg.includes('too many tokens') ||
    msg.includes('maximum context length') ||
    msg.includes('context window')
  ) {
    return { category: 'context_length', i18nKey: 'error.diagnosis.context_length', navTarget: null }
  }

  // Payload too large (413)
  if (numStatus === 413 || msg.includes('payload too large') || msg.includes('request entity too large')) {
    return { category: 'payload', i18nKey: 'error.diagnosis.payload', navTarget: null }
  }

  // Network errors
  if (
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('offline')
  ) {
    return { category: 'network', i18nKey: 'error.diagnosis.network', navTarget: '/settings' }
  }

  // Proxy / SSL certificate errors
  if (
    msg.includes('proxy') ||
    msg.includes('socks') ||
    msg.includes('certificate') ||
    msg.includes('self-signed') ||
    msg.includes('unable_to_verify_leaf_signature')
  ) {
    return { category: 'proxy', i18nKey: 'error.diagnosis.proxy', navTarget: '/settings' }
  }

  // Stream interrupted
  if (
    msg.includes('econnreset') ||
    msg.includes('stream') ||
    msg.includes('connection reset') ||
    msg.includes('aborted')
  ) {
    return { category: 'stream', i18nKey: 'error.diagnosis.stream', navTarget: null }
  }

  // Content filter (400 + safety keywords)
  if (
    numStatus === 400 &&
    (msg.includes('content_filter') || msg.includes('safety') || msg.includes('content_policy'))
  ) {
    return { category: 'content', i18nKey: 'error.diagnosis.content', navTarget: null }
  }

  // Server errors (5xx)
  if (numStatus && numStatus >= 500) {
    return { category: 'server', i18nKey: 'error.diagnosis.server', navTarget: null }
  }

  // Model deprecated / retired
  if (msg.includes('deprecated') || msg.includes('retired') || msg.includes('sunset') || msg.includes('decommission')) {
    return {
      category: 'deprecated',
      i18nKey: 'error.diagnosis.deprecated',
      navTarget: `/settings/providers${providerSuffix}`
    }
  }

  // Response parse errors
  if (
    msg.includes('json') ||
    msg.includes('unexpected token') ||
    msg.includes('invalid response') ||
    msg.includes('parse error') ||
    msg.includes('syntax error')
  ) {
    return { category: 'parse', i18nKey: 'error.diagnosis.parse', navTarget: null }
  }

  // 中文：图片/视频生成失败
  if (
    msg.includes('生成失败') ||
    msg.includes('生成超时') ||
    msg.includes('未返回结果') ||
    msg.includes('任务失败') ||
    msg.includes('接口请求失败') ||
    msg.includes('无法解析的数据')
  ) {
    return { category: 'generation', i18nKey: 'error.diagnosis.generation', navTarget: null }
  }

  // 中文：凭证未配置
  if (
    msg.includes('未配置') ||
    msg.includes('密钥未配置') ||
    msg.includes('api key') ||
    msg.includes('api密钥') ||
    msg.includes('请设置')
  ) {
    return { category: 'auth', i18nKey: 'error.diagnosis.auth', navTarget: '/settings/providers' }
  }

  // 中文：提供商/模型问题
  if (
    msg.includes('未找到该提供商') ||
    msg.includes('已被禁用') ||
    msg.includes('请选择模型')
  ) {
    return { category: 'model', i18nKey: 'error.diagnosis.model', navTarget: '/settings/providers' }
  }

  return { category: 'unknown', i18nKey: 'error.diagnosis.unknown', navTarget: null }
}

export function getHttpStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
  return labels[status] || `HTTP ${status}`
}

/**
 * 判断是否为网络类错误
 */
export function isNetworkError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase()
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('abort') ||
    message.includes('offline') ||
    message.includes('enet') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  )
}

/**
 * 返回友好的中文错误信息
 *
 * 合并自 main/ipc/providers.ts 的 classifyFetchError 逻辑。
 */
export function getFriendlyErrorMessage(error: unknown, context?: string): string {
  const message = errorMessage(error)

  // 代理错误
  if (message.includes('proxy') || message.includes('PROXY')) {
    return `代理连接失败: ${message}。请检查系统代理设置或尝试关闭代理。`
  }

  // DNS / 连接错误
  if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    const ctx = context || '服务器'
    return `无法解析服务器地址: ${ctx}。请检查网络连接和 Base URL 是否正确。`
  }

  // 连接被拒绝
  if (message.includes('ECONNREFUSED')) {
    const ctx = context || '服务器'
    return `连接被拒绝: ${ctx}。请检查服务器是否运行或 Base URL 是否正确。`
  }

  // 连接超时
  if (message.includes('ETIMEDOUT') || message.includes('timeout') || message.includes('abort')) {
    const ctx = context || '请求'
    return `请求超时: ${ctx}。请检查网络连接，或稍后重试。`
  }

  // SSL 错误
  if (message.includes('SSL') || message.includes('CERT') || message.includes('TLS')) {
    const ctx = context || '连接'
    return `SSL 证书错误: ${ctx}。请检查网络环境或尝试使用代理。`
  }

  // 网络不可达
  if (message.includes('ENETUNREACH') || message.includes('EHOSTUNREACH')) {
    const ctx = context || '服务器'
    return `网络不可达: ${ctx}。请检查网络连接。`
  }

  // 通用 fetch failed（通常是底层网络问题）
  if (message.includes('fetch failed')) {
    const ctx = context || '请求'
    return `网络请求失败: ${ctx}。可能原因：1) 网络连接问题 2) 代理配置问题 3) 服务器不可达。请检查网络设置和 Base URL。`
  }

  return context ? `${context}: ${message}` : message
}

/**
 * 从任意错误中提取字符串消息
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
