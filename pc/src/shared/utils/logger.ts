export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void
  error(msg: string, ctx?: Record<string, unknown>): void
  warn(msg: string, ctx?: Record<string, unknown>): void
}

export function createLogger(tag: string): Logger {
  return {
    info(msg, ctx) {
      console.log(`[${tag}]`, msg, ctx ?? '')
    },
    error(msg, ctx) {
      console.error(`[${tag}]`, msg, ctx ?? '')
    },
    warn(msg, ctx) {
      console.warn(`[${tag}]`, msg, ctx ?? '')
    }
  }
}
