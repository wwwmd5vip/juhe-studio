import { describe, expect, it } from 'vitest'
import { DOMAIN_RESULT_CHANNELS, isIpcErrorEnvelope, unwrapIpcResult } from './ipc-result'

describe('isIpcErrorEnvelope', () => {
  it('识别 { success:false, error:string } 信封', () => {
    expect(isIpcErrorEnvelope({ success: false, error: 'boom' })).toBe(true)
  })

  it('成功信封 / 普通数据 / 领域结果均不识别为错误信封', () => {
    expect(isIpcErrorEnvelope({ success: true, data: [1, 2] })).toBe(false)
    expect(isIpcErrorEnvelope({ success: true })).toBe(false)
    // 领域结果（如 provider 连通性测试）使用 message 而非 error
    expect(isIpcErrorEnvelope({ success: false, message: 'connection refused' })).toBe(false)
    expect(isIpcErrorEnvelope([1, 2, 3])).toBe(false)
    expect(isIpcErrorEnvelope('error')).toBe(false)
    expect(isIpcErrorEnvelope(null)).toBe(false)
    expect(isIpcErrorEnvelope(undefined)).toBe(false)
    expect(isIpcErrorEnvelope(42)).toBe(false)
  })
})

describe('unwrapIpcResult', () => {
  it('错误信封 → throw，message 为信封中的 error（无 Electron 前缀）', () => {
    expect(() => unwrapIpcResult('auth:login', { success: false, error: '登录失败' })).toThrowError(
      /^登录失败$/
    )
  })

  it('成功信封与普通数据原样透传', () => {
    const ok = { success: true, data: { user: 1 } }
    expect(unwrapIpcResult('auth:login', ok)).toBe(ok)
    const rows = [{ id: 1 }]
    expect(unwrapIpcResult('db:generations:list', rows)).toBe(rows)
    expect(unwrapIpcResult('queue:state', null)).toBe(null)
  })

  it('领域结果 channel 不转换（mcp:servers:test / canvas-agent:call-tool）', () => {
    for (const channel of DOMAIN_RESULT_CHANNELS) {
      const domainResult = { success: false, error: 'test connection failed' }
      expect(unwrapIpcResult(channel, domainResult)).toBe(domainResult)
    }
  })
})
