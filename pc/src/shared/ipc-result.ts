/**
 * IPC 错误信封约定
 *
 * 主进程 handler 存在两种错误形态：
 *   1. 直接 throw —— Electron 序列化为 renderer 端 rejected promise；
 *   2. 返回 `{ success: false, error }` 信封 —— renderer 必须检查 `.success`。
 *
 * 为让 renderer 只需 try/catch 一条错误处理路径，preload 调用本模块把
 * 形态 2 统一转换为 throw（信封中的 error 作为 Error message，不带
 * Electron 的 "Error invoking remote method" 前缀，比形态 1 更干净）。
 */

export interface IpcErrorEnvelope {
  success: false
  error: string
}

/**
 * 例外 channel：这些接口的 `{ success: false, error }` 是合法的领域结果
 * （如连通性/工具测试失败需要由 UI 内联展示），不是传输层失败，不得转 throw。
 */
export const DOMAIN_RESULT_CHANNELS: ReadonlySet<string> = new Set([
  'mcp:servers:test',
  'canvas-agent:call-tool'
])

/** 判断一个 IPC 返回值是否为错误信封（区别于正常数据或领域结果）。 */
export function isIpcErrorEnvelope(value: unknown): value is IpcErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).success === false &&
    typeof (value as Record<string, unknown>).error === 'string'
  )
}

/**
 * 解包 IPC 返回值：错误信封 → throw Error(error)；其他一律原样返回。
 * 成功信封 `{ success: true, data }` 保持原形状， renderer 现有 `.data` 读取不受影响。
 */
export function unwrapIpcResult<T>(channel: string, result: T): T {
  if (!DOMAIN_RESULT_CHANNELS.has(channel) && isIpcErrorEnvelope(result)) {
    throw new Error(result.error)
  }
  return result
}
