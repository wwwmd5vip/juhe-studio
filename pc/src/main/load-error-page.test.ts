import { describe, expect, it } from 'vitest'
import {
  buildLoadErrorPageHtml,
  ERR_ABORTED,
  LOAD_MAX_RETRIES,
  loadRetryDelay,
  READY_TO_SHOW_TIMEOUT_MS,
  shouldRetryLoad
} from './load-error-page'

describe('shouldRetryLoad', () => {
  it('ERR_ABORTED(-3) 不重试（正常导航/重载被打断）', () => {
    expect(shouldRetryLoad(ERR_ABORTED, 1)).toBe(false)
    expect(shouldRetryLoad(ERR_ABORTED, 99)).toBe(false)
  })

  it('在重试次数上限内重试真实错误', () => {
    // -102 CONNECTION_REFUSED / -106 INTERNET_DISCONNECTED / -7 TIMED_OUT
    for (let attempt = 1; attempt <= LOAD_MAX_RETRIES; attempt++) {
      expect(shouldRetryLoad(-102, attempt)).toBe(true)
    }
  })

  it('超过上限后放弃（交给错误页兜底）', () => {
    expect(shouldRetryLoad(-102, LOAD_MAX_RETRIES + 1)).toBe(false)
    expect(shouldRetryLoad(-6, LOAD_MAX_RETRIES + 5)).toBe(false)
  })
})

describe('loadRetryDelay', () => {
  it('指数退避 1s/2s/4s', () => {
    expect(loadRetryDelay(1)).toBe(1000)
    expect(loadRetryDelay(2)).toBe(2000)
    expect(loadRetryDelay(3)).toBe(4000)
  })

  it('上限 8s', () => {
    expect(loadRetryDelay(4)).toBe(8000)
    expect(loadRetryDelay(10)).toBe(8000)
  })
})

describe('buildLoadErrorPageHtml', () => {
  it('包含品牌风格、重安装提示与错误详情', () => {
    const html = buildLoadErrorPageHtml({ errorCode: -102, errorDescription: 'ERR_CONNECTION_REFUSED' })
    expect(html).toContain('#1a1a2e') // 与 splash 一致的背景色
    expect(html).toContain('重新安装')
    expect(html).toContain('-102')
    expect(html).toContain('ERR_CONNECTION_REFUSED')
  })

  it('无错误码时展示超时文案', () => {
    const html = buildLoadErrorPageHtml({})
    expect(html).toContain('加载超时')
  })

  it('转义错误描述中的 HTML 特殊字符', () => {
    const html = buildLoadErrorPageHtml({ errorCode: -1, errorDescription: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('constants', () => {
  it('超时阈值与重试上限符合设计', () => {
    expect(READY_TO_SHOW_TIMEOUT_MS).toBe(30_000)
    expect(LOAD_MAX_RETRIES).toBe(3)
  })
})
