/**
 * 主进程统一日志工具
 * 开发模式自动开启，生产环境通过 ENABLE_LOG=1 开启
 * 敏感数据自动脱敏（token, apiKey, password, secret）
 */

const isEnabled = process.env.NODE_ENV === 'development' || process.env.ENABLE_LOG === '1'

const SENSITIVE_KEYS = ['token', 'apikey', 'api_key', 'password', 'secret', 'accesskey']

function maskValue(key: string, value: unknown): unknown {
  const k = key.toLowerCase()
  if (SENSITIVE_KEYS.some((s) => k.includes(s)) && typeof value === 'string') {
    if (value.length <= 4) return '***'
    return value.slice(0, 4) + '***' + value.slice(-2)
  }
  return value
}

function maskObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = maskValue(k, v)
  }
  return result
}

function formatArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      try {
        return maskObject(a as Record<string, unknown>)
      } catch {
        return a
      }
    }
    return a
  })
}

export function createLogger(module: string) {
  const prefix = `[${module}]`
  return {
    log: (...args: unknown[]) => {
      if (isEnabled) console.log(prefix, ...formatArgs(args))
    },
    warn: (...args: unknown[]) => {
      if (isEnabled) console.warn(prefix, ...formatArgs(args))
    },
    error: (...args: unknown[]) => {
      // 错误始终输出
      console.error(prefix, ...formatArgs(args))
    },
    /** 带耗时的性能日志 */
    timing: <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now()
      return fn().then(
        (result) => {
          if (isEnabled) console.log(prefix, `${label} ✓ ${Date.now() - start}ms`)
          return result
        },
        (err) => {
          console.error(prefix, `${label} ✗ ${Date.now() - start}ms`, err)
          throw err
        }
      )
    }
  }
}

// 全局快捷方法
export const logger = createLogger('Main')
