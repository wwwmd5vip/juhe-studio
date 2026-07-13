/**
 * cleanupTempImages 行为测试
 *
 * 背景：
 *   历史上 cleanupTempImages 基于 mtime（>24h）一键删除，导致用户的历史图片
 *   全部 404（DB 行还在但文件已被清）。正确做法：以 DB 为准，只删孤儿。
 *
 * 本测试通过 vi.mock 隔离 node:fs / electron / ../db 依赖，
 * 验证：保留被 DB 引用的文件、删除未被引用的孤儿文件。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────

const mockReaddirSync = vi.hoisted(() => vi.fn())
const mockUnlinkSync = vi.hoisted(() => vi.fn())
const mockExistsSync = vi.hoisted(() => vi.fn())
const mockUpdateFn = vi.hoisted(() => vi.fn())
const mockUserDataPath = vi.hoisted(() => '/tmp/juhe-test')
const mockDbRows = vi.hoisted(() => ({ rows: [] as unknown[] }))

vi.mock('node:fs', () => ({
  readdirSync: mockReaddirSync,
  unlinkSync: mockUnlinkSync,
  existsSync: mockExistsSync,
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  writeFileSync: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? mockUserDataPath : '/tmp'))
  }
}))

// Drizzle update chain helpers
function makeUpdateChain() {
  const chain: any = {
    set: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve())
  }
  return chain
}

// 给 select().from() 的返回值做一个「本身可 then、也支持链式 where」的双重对象，
// 这样 cleanupTempImages（不调 where）和 markMissingImageFiles（调 where）都能用。
function makeFromResult(rows: unknown[]) {
  const awaitable: any = Promise.resolve(rows)
  awaitable.where = vi.fn(() => Promise.resolve(rows))
  return awaitable
}

vi.mock('@main/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => makeFromResult(mockDbRows.rows)
    })),
    update: mockUpdateFn
  }
}))

vi.mock('@main/db/schema', () => ({
  generations: { name: 'generations' }
}))

// 其他重依赖：避免拉起真实 AI SDK
vi.mock('@cherrystudio/ai-core', () => ({ generateImage: vi.fn() }))

import { cleanupTempImages, downloadImageAsBase64, markMissingImageFiles } from '../generation'

/** 控制 mockExistsSync 在下一次及之后所有调用时的返回值 */
function setExistsResult(value: boolean | ((p: string) => boolean)) {
  const impl = typeof value === 'function' ? value : () => value
  mockExistsSync.mockImplementation((p: string) => impl(String(p)))
}

describe('cleanupTempImages（孤儿清理）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbRows.rows = []
    // readdirSync 默认空目录
    mockReaddirSync.mockReturnValue([])
  })

  it('保留 DB 中引用的文件，删除未被引用的孤儿文件', async () => {
    mockReaddirSync.mockReturnValue(['referenced.png', 'orphan.png', 'another-orphan.jpg'])
    mockDbRows.rows = [
      {
        resultUrls: JSON.stringify([
          `juhe-image://${mockUserDataPath}/Data/Files/referenced.png`
        ]),
        outputs: null
      }
    ]

    await cleanupTempImages()

    const unlinkCalls = mockUnlinkSync.mock.calls.map((c) => c[0])
    expect(unlinkCalls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('orphan.png'),
        expect.stringContaining('another-orphan.jpg')
      ])
    )
    expect(unlinkCalls.find((p) => String(p).includes('referenced.png'))).toBeUndefined()
  })

  it('outputs JSON 中的 url 也会被收集为引用', async () => {
    mockReaddirSync.mockReturnValue(['kept.png', 'orphan.png'])
    mockDbRows.rows = [
      {
        resultUrls: null,
        outputs: JSON.stringify([
          {
            id: 'task-1-0',
            type: 'image',
            url: `juhe-image://${mockUserDataPath}/Data/Files/kept.png`,
            mediaType: 'image/png'
          }
        ])
      }
    ]

    await cleanupTempImages()

    const unlinkCalls = mockUnlinkSync.mock.calls.map((c) => c[0])
    expect(unlinkCalls).toEqual(expect.arrayContaining([expect.stringContaining('orphan.png')]))
    expect(unlinkCalls.find((p) => String(p).includes('kept.png'))).toBeUndefined()
  })

  it('DB 读失败时不应崩溃，不应盲删', async () => {
    mockReaddirSync.mockReturnValue(['orphan.png'])
    mockDbRows.rows = []
    // 强制 db.select 抛错
    const failingDb = await import('@main/db')
    vi.mocked(failingDb.db.select).mockImplementationOnce(() => {
      throw new Error('DB locked')
    })

    await expect(cleanupTempImages()).resolves.toBeUndefined()
    // DB 读失败时跳过本次清理（保守策略）
    expect(mockUnlinkSync).not.toHaveBeenCalled()
  })

  it('引用包含 data: URL 时不影响孤儿判定', async () => {
    // 全部 DB 引用都是 data: → 不产生文件名 → 文件夹里所有文件都成孤儿
    mockReaddirSync.mockReturnValue(['real-orphan.png'])
    mockDbRows.rows = [
      {
        resultUrls: JSON.stringify(['data:image/png;base64,xxx']),
        outputs: null
      }
    ]

    await cleanupTempImages()

    expect(mockUnlinkSync).toHaveBeenCalledWith(
      expect.stringContaining('real-orphan.png')
    )
  })
})

describe('markMissingImageFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DB 不可用时跳过，不抛错', async () => {
    // 强制 db.select 抛错
    const failingDb = await import('@main/db')
    vi.mocked(failingDb.db.select).mockImplementationOnce(() => {
      throw new Error('DB locked')
    })

    await expect(markMissingImageFiles()).resolves.toBeUndefined()
    expect(mockUpdateFn).not.toHaveBeenCalled()
  })

  it('文件不存在时把 status 改为 failed', async () => {
    // existsSync 是从 generation.ts 静态导入的，覆盖它需要补充 mock
    // 这里把 mockFsExists 接到 setExistsResult
    setExistsResult(false)
    const updateChain = makeUpdateChain()
    mockUpdateFn.mockReturnValueOnce(updateChain)

    mockDbRows.rows = [
      {
        id: 'gen-1',
        resultUrls: JSON.stringify([
          `juhe-image://${mockUserDataPath}/Data/Files/missing.png`
        ]),
        outputs: null
      }
    ]

    await markMissingImageFiles()

    expect(mockUpdateFn).toHaveBeenCalled()
    const setPayload = updateChain.set.mock.calls[0][0]
    expect(setPayload.status).toBe('failed')
    expect(String(setPayload.errorMessage)).toContain('已丢失')
  })

  it('文件存在时不做任何修改', async () => {
    setExistsResult(true)
    mockDbRows.rows = [
      {
        id: 'gen-2',
        resultUrls: JSON.stringify([`juhe-image://${mockUserDataPath}/Data/Files/ok.png`]),
        outputs: null
      }
    ]

    await markMissingImageFiles()

    expect(mockUpdateFn).not.toHaveBeenCalled()
  })

  it('远端 URL 不在检查范围', async () => {
    // 远程 URL 不应触发文件存在性检查，更不应改写 DB
    mockDbRows.rows = [
      {
        id: 'gen-3',
        resultUrls: JSON.stringify(['https://cdn.example.com/foo.png']),
        outputs: null
      }
    ]

    await markMissingImageFiles()

    expect(mockUpdateFn).not.toHaveBeenCalled()
  })
})

describe('downloadImageAsBase64（URL 下载重试）', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    vi.clearAllMocks()
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  function mockFetchSequence(responses: Array<() => Response | Error>) {
    let i = 0
    return vi.fn(async (_url: string, _init?: RequestInit) => {
      const make = responses[i++]
      if (!make) throw new Error(`mock out of responses at call ${i}`)
      const item = make()
      if (item instanceof Error) throw item
      return item
    })
  }

  function okResponse(body: Uint8Array = new Uint8Array([1, 2, 3])) {
    return new Response(body, { status: 200, headers: { 'content-type': 'image/png' } })
  }

  it('成功一次就返回 base64', async () => {
    global.fetch = mockFetchSequence([() => okResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))])
    const b64 = await downloadImageAsBase64('https://example.com/x.png', undefined, { timeoutMs: 5000 })
    expect(b64).toBe(Buffer.from(Buffer.from([0x89, 0x50, 0x4e, 0x47])).toString('base64'))
  })

  it('4xx 不重试，立刻抛错', async () => {
    let calls = 0
    global.fetch = vi.fn(async () => {
      calls++
      return new Response('not found', { status: 404 })
    })
    await expect(
      downloadImageAsBase64('https://example.com/missing', undefined, { timeoutMs: 5000 })
    ).rejects.toThrow(/404/)
    expect(calls).toBe(1)
  })

  it('网络错误指数退避重试 3 次后抛错', async () => {
    // 用真实短退避（maxAttempts=2 + 小间隔），避免与 AbortSignal.timeout 交互产生孤儿 reject
    let calls = 0
    global.fetch = vi.fn(async () => {
      calls++
      const e: any = new Error('fetch failed')
      e.cause = { name: 'ENOTFOUND', code: 'ENOTFOUND' }
      throw e
    })
    await expect(
      downloadImageAsBase64('https://example.com/x', undefined, { maxAttempts: 2, timeoutMs: 5000 })
    ).rejects.toThrow(/重试 2 次/)
    expect(calls).toBe(2)
  })

  it('5xx 视为可重试；中途成功就停止', async () => {
    let calls = 0
    global.fetch = vi.fn(async () => {
      calls++
      if (calls < 2) return new Response('boom', { status: 503 })
      return okResponse(new Uint8Array([0xff]))
    })
    const b64 = await downloadImageAsBase64('https://example.com/x', undefined, {
      maxAttempts: 3,
      timeoutMs: 5000
    })
    expect(b64).toBe(Buffer.from(Buffer.from([0xff])).toString('base64'))
    expect(calls).toBe(2) // 第一次 503 → 重试 → 第二次 200 → 返回
  })
})
