/**
 * Renderer 加载失败兜底（纯函数部分，便于单元测试）
 *
 * 背景：
 *   生产环境 renderer 加载失败（如 asar 损坏）时，旧实现只 console.error，
 *   splash 无限转圈、主窗口永不 show —— 用户面对无声卡死。
 *   现在：did-fail-load 有限重试（指数退避），最终失败加载静态错误页；
 *   ready-to-show 超时同样走错误页兜底。
 */

/** 最大重试次数（首次失败后的重试次数上限） */
export const LOAD_MAX_RETRIES = 3

/** ready-to-show 超时兜底阈值 */
export const READY_TO_SHOW_TIMEOUT_MS = 30_000

/** Chromium ERR_ABORTED：正常导航/重载被打断，不算加载失败 */
export const ERR_ABORTED = -3

/** 是否应重试：ABORTED 不重试；其余错误在次数上限内重试。 */
export function shouldRetryLoad(errorCode: number, failedAttempts: number): boolean {
  if (errorCode === ERR_ABORTED) return false
  return failedAttempts <= LOAD_MAX_RETRIES
}

/** 指数退避：1s / 2s / 4s，上限 8s。failedAttempts 从 1 开始。 */
export function loadRetryDelay(failedAttempts: number): number {
  return Math.min(1000 * 2 ** (failedAttempts - 1), 8000)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 生成静态错误页 HTML（data: URL 内联，风格与 splash 一致）。
 * 页面不依赖任何应用资源，保证在 renderer 文件损坏时也能渲染。
 */
export function buildLoadErrorPageHtml(opts: {
  errorCode?: number
  errorDescription?: string
}): string {
  const detail =
    opts.errorCode !== undefined
      ? `错误代码 ${opts.errorCode}${opts.errorDescription ? `：${escapeHtml(opts.errorDescription)}` : ''}`
      : '页面加载超时'
  return `<!DOCTYPE html><html><head><meta charset='utf-8'><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { display:flex; align-items:center; justify-content:center; height:100vh; background:#1a1a2e; font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif; overflow:hidden; user-select:none; -webkit-app-region:drag; }
    .container { text-align:center; color:#e0e0e0; max-width:320px; }
    .logo { width:64px; height:64px; margin:0 auto 24px; background:linear-gradient(135deg,#00f0ff,#7b2fff); border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:700; color:#fff; }
    h1 { font-size:20px; margin:0 0 12px; color:#ff9f43; font-weight:600; letter-spacing:2px; }
    .msg { font-size:13px; color:#bbb; line-height:1.8; margin-bottom:8px; }
    .detail { font-size:11px; color:#666; margin-top:16px; word-break:break-all; }
  </style></head><body>
    <div class='container'>
      <div class='logo'>聚</div>
      <h1>加载失败</h1>
      <p class='msg'>应用界面加载失败，应用文件可能已损坏。<br/>请尝试重新启动应用；若问题依旧，请重新安装。</p>
      <p class='detail'>${detail}</p>
    </div>
  </body></html>`
}
