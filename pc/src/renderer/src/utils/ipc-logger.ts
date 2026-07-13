/**
 * Renderer IPC 代理日志
 * 包装 window.api 调用，开发模式下输出结构化日志
 */

declare const __DEV__: boolean
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false

function maskArg(a: unknown): unknown {
  if (a && typeof a === 'object' && !Array.isArray(a)) {
    const r: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(a as Record<string, unknown>)) {
      const kl = k.toLowerCase()
      if (kl.includes('token') || kl.includes('apikey') || kl.includes('api_key') || kl.includes('password') || kl.includes('secret')) {
        r[k] = typeof v === 'string' && v.length > 4 ? v.slice(0, 4) + '***' : '***'
      } else {
        r[k] = v
      }
    }
    return r
  }
  return a
}

export function createIpcLogger() {
  if (!isDev) return

  const api = (window as unknown as { api: Record<string, (...args: unknown[]) => Promise<unknown>> }).api
  const handler: ProxyHandler<Record<string, (...args: unknown[]) => Promise<unknown>>> = {
    get(target, prop: string) {
      const fn = target[prop]
      if (typeof fn !== 'function') return fn
      return async (...args: unknown[]) => {
        const start = Date.now()
        const maskedArgs = args.map(maskArg)
        try {
          const result = await fn(...args)
          console.log(`[IPC] ${prop}`, maskedArgs.length <= 1 ? maskedArgs[0] : maskedArgs, '→', Date.now() - start + 'ms', result !== undefined ? '✓' : '')
          return result
        } catch (err) {
          console.error(`[IPC] ${prop} ✗`, Date.now() - start + 'ms', err instanceof Error ? err.message : err)
          throw err
        }
      }
    }
  }
  ;(window as unknown as { api: Record<string, (...args: unknown[]) => Promise<unknown>> }).api = new Proxy(api, handler)
}

export const ipcLog = {
  log: (label: string, ...args: unknown[]) => {
    if (isDev) console.log(`[IPC:trace] ${label}`, ...args)
  },
  error: (label: string, ...args: unknown[]) => {
    console.error(`[IPC:trace] ${label}`, ...args)
  }
}
