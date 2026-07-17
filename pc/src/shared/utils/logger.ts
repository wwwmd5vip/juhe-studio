export interface Logger {
  info(msg: string, ...ctx: unknown[]): void
  error(msg: string, ...ctx: unknown[]): void
  warn(msg: string, ...ctx: unknown[]): void
}

export function createLogger(tag: string): Logger {
  return {
    info(msg, ...ctx) {
      console.log(`[${tag}] ${msg}`, ...ctx)
    },
    error(msg, ...ctx) {
      console.error(`[${tag}] ${msg}`, ...ctx)
    },
    warn(msg, ...ctx) {
      console.warn(`[${tag}] ${msg}`, ...ctx)
    }
  }
}
