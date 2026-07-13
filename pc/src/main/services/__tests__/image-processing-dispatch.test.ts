/**
 * dispatchImgRefGen 行为测试
 *
 * 注意：本文件只覆盖 image-processing 内新加的 helper（dispatchImgRefGen）的两条分支：
 *   - openai-chat-completions → POST /v1/images/generations
 *   - 其他 provider            → ai-core.generateImage
 *
 * 因为 helper 是 module 私有函数，通过 entry points（executeImg2Img 等）暴露的副作用
 * 难以独立 mock ai-core。我们这里直接：
 *   - vi.mock('@cherrystudio/ai-core', ...) 把 generateImage 桩掉
 *   - vi.stubGlobal('fetch', vi.fn()) 拦截 fetch
 *   - 调用 image-processing 里的导出函数 (executeImg2Img) 来串通整条路径
 *
 * 由此间接证明 dispatchImgRefGen 走对了分支。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockAiCoreGenerateImage = vi.hoisted(() => vi.fn())
const mockDownloadImageAsBase64 = vi.hoisted(() => vi.fn(async (_url: string) => 'REMOTE_B64'))

vi.mock('@cherrystudio/ai-core', () => ({
  generateImage: mockAiCoreGenerateImage
}))

vi.mock('../generation', () => ({
  downloadImageAsBase64: mockDownloadImageAsBase64
}))

vi.mock('../model-utils', () => ({
  resolveUpstreamModelName: vi.fn(async (id: string) => {
    // 模拟真实 DB 映射：本地 id → 上游模型名
    if (id === 'juhe-4') return 'juhe-gpt-image-2'
    return id
  })
}))

// 拦截 DB；executeImg2Img 会查 provider 行
const mockProviderRows = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string
    type: string
    baseUrl: string | null
    apiKey: string | null
    isEnabled: boolean
  }>
}))

vi.mock('@main/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockProviderRows.rows)
        })
      })
    }))
  }
}))

vi.mock('@main/db/schema', () => ({
  providers: { name: 'providers' }
}))

// secure-storage stub（dynamic import）
vi.mock('../secure-storage', () => ({
  decryptApiKey: vi.fn((k: string) => k) // 直通即可
}))

// electron.app stub（只有 getImageStorageDir / 等会间接用）
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/juhe-test') }
}))

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

import { executeImg2Img } from '../image-processing'

/** mock 一个 fetch：每次 call 都用 mockState.responses 顺序消费。 */
function mockFetchSequence(
  responses: Array<(url: string, init?: RequestInit) => Response>
) {
  let i = 0
  return vi.fn(async (url: string, init?: RequestInit) => {
    const make = responses[i++]
    if (!make) throw new Error(`mock out of fetch at call ${i}`)
    return make(url, init)
  })
}

describe('dispatchImgRefGen（通过 executeImg2Img）', () => {
  beforeEach(() => {
    mockProviderRows.rows = []
    mockAiCoreGenerateImage.mockReset()
    mockDownloadImageAsBase64.mockReset()
  })

  it('openai-chat-completions provider → 走 /v1/images/generations，不调 ai-core', async () => {
    mockProviderRows.rows = [
      {
        id: 'juhe',
        type: 'openai-chat-completions',
        baseUrl: 'http://upstream.test/v1',
        apiKey: 'tk',
        isEnabled: true
      }
    ]

    // mock fetch：识别 path 是否包含 /images/generations → 200 b64
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url)
      if (!u.includes('/images/generations')) {
        throw new Error(`unexpected fetch to ${u}`)
      }
      // 验证 body 含 images 数组 + reference_mode
      const body = JSON.parse(String(init?.body))
      expect(body.images).toEqual(['data:image/png;base64,SRC'])
      expect(body.reference_mode).toBe('image-edit')
      expect(body.response_format).toBe('b64_json')
      return new Response(JSON.stringify({ data: [{ b64_json: 'AAA' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    await executeImg2Img({
      id: 't1',
      type: 'img2img',
      providerId: 'juhe',
      modelId: 'm',
      prompt: 'p',
      sourceImage: 'data:image/png;base64,SRC',
      strength: 0.7,
      status: 'pending',
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    } as never)

    expect(mockAiCoreGenerateImage).not.toHaveBeenCalled() // 关键：没走 ai-core
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('openai-chat-completions 路径会把本地 modelId 映射为上游模型名', async () => {
    mockProviderRows.rows = [
      {
        id: 'juhe',
        type: 'openai-chat-completions',
        baseUrl: 'http://upstream.test/v1',
        apiKey: 'tk',
        isEnabled: true
      }
    ]

    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      // 真实 DB 中 juhe-4 对应的上游模型名是 juhe-gpt-image-2
      expect(body.model).toBe('juhe-gpt-image-2')
      return new Response(JSON.stringify({ data: [{ b64_json: 'AAA' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    })

    await executeImg2Img({
      id: 't-map',
      type: 'img2img',
      providerId: 'juhe',
      modelId: 'juhe-4',
      prompt: 'p',
      sourceImage: 'data:image/png;base64,SRC',
      strength: 0.7,
      status: 'pending',
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    } as never)

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('URL 形式返回 → 走 downloadImageAsBase64 拿 b64', async () => {
    mockProviderRows.rows = [
      {
        id: 'juhe',
        type: 'openai-chat-completions',
        baseUrl: 'http://upstream.test/v1',
        apiKey: 'tk',
        isEnabled: true
      }
    ]
    mockDownloadImageAsBase64.mockResolvedValueOnce('REMOTE_B64')

    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/images/generations')) {
        return new Response(JSON.stringify({ data: [{ url: 'https://cdn/x.png' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      throw new Error('unexpected fetch')
    })

    await executeImg2Img({
      id: 't2',
      type: 'img2img',
      providerId: 'juhe',
      modelId: 'm',
      prompt: 'p',
      sourceImage: 'data:image/png;base64,SRC',
      strength: 0.7,
      status: 'pending',
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    } as never)

    expect(mockDownloadImageAsBase64).toHaveBeenCalledWith('https://cdn/x.png', undefined)
  })

  it('google-generate-content provider → 走 ai-core，不调 fetch', async () => {
    mockProviderRows.rows = [
      {
        id: 'google',
        type: 'google-generate-content',
        baseUrl: 'http://google.test/v1',
        apiKey: 'k',
        isEnabled: true
      }
    ]
    mockAiCoreGenerateImage.mockResolvedValueOnce({ images: [{ base64: 'AICORE_B64' }] })

    global.fetch = vi.fn() // 不应被调用

    await executeImg2Img({
      id: 't3',
      type: 'img2img',
      providerId: 'google',
      modelId: 'm',
      prompt: 'p',
      sourceImage: 'data:image/png;base64,SRC',
      strength: 0.7,
      status: 'pending',
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    } as never)

    expect(mockAiCoreGenerateImage).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('上游返回 404 → 抛错（不再误为 "Not Found"，错误信息清晰）', async () => {
    mockProviderRows.rows = [
      {
        id: 'juhe',
        type: 'openai-chat-completions',
        baseUrl: 'http://upstream.test/v1',
        apiKey: 'tk',
        isEnabled: true
      }
    ]
    global.fetch = vi.fn(async () => {
      return new Response('not found', { status: 404 })
    })

    let caught: unknown = null
    try {
      await executeImg2Img({
        id: 't4',
        type: 'img2img',
        providerId: 'juhe',
        modelId: 'm',
        prompt: 'p',
        sourceImage: 'data:image/png;base64,SRC',
        strength: 0.7,
        status: 'pending',
        outputs: [],
        progress: 0,
        stage: 'queued',
        createdAt: Date.now()
      } as never)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect(String(caught)).toMatch(/HTTP 404/)
  })

  // ── juhe_error 翻译 ──────────────────────────────────────────────────

  function primeProvider() {
    mockProviderRows.rows = [
      {
        id: 'juhe',
        type: 'openai-chat-completions',
        baseUrl: 'http://upstream.test/v1',
        apiKey: 'tk',
        isEnabled: true
      }
    ]
  }

  function buildTask() {
    return {
      id: 't',
      type: 'img2img',
      providerId: 'juhe',
      modelId: 'deepseek-v4-pro',
      prompt: 'p',
      sourceImage: 'data:image/png;base64,SRC',
      strength: 0.7,
      status: 'pending',
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    } as never
  }

  it('500 + juhe_error("no pricing configured for image generation") → 翻译为 ERR_PROVIDER_NO_PRICING', async () => {
    primeProvider()
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: 'no pricing configured for image generation',
            type: 'juhe_error',
            code: 'internal_error'
          }
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    })

    await expect(executeImg2Img(buildTask())).rejects.toThrow(/ERR_PROVIDER_NO_PRICING/)
    await expect(executeImg2Img(buildTask())).rejects.toThrow(/deepseek-v4-pro/)
    await expect(executeImg2Img(buildTask())).rejects.toThrow(/admin 后台/)
  })

  it('500 + juhe_error 错误信息里只显示上游模型名，不暴露本地 modelId', async () => {
    primeProvider()
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: 'no pricing configured for image generation',
            type: 'juhe_error',
            code: 'internal_error'
          }
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    })

    const task = {
      ...buildTask(),
      modelId: 'juhe-4'
    } as never

    await expect(executeImg2Img(task)).rejects.toThrow(/juhe-gpt-image-2/)
    await expect(executeImg2Img(task)).rejects.not.toThrow(/juhe-4/)
  })

  it('失败日志中 model 字段也使用上游模型名，不暴露本地 modelId', async () => {
    primeProvider()
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: 'no pricing configured for image generation',
            type: 'juhe_error',
            code: 'internal_error'
          }
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const task = {
      ...buildTask(),
      modelId: 'juhe-4'
    } as never

    await expect(executeImg2Img(task)).rejects.toThrow()

    const errorLog = errorSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[ImageProcess]')
    )
    expect(errorLog).toBeTruthy()
    const loggedModel = (errorLog![1] as { model?: string }).model
    expect(loggedModel).toBe('juhe-gpt-image-2')
    expect(loggedModel).not.toBe('juhe-4')

    errorSpy.mockRestore()
  })

  it('500 + juhe_error("no available channel...") → 翻译为 ERR_PROVIDER_NO_CHANNEL + 提示', async () => {
    primeProvider()
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            message: 'no available channel for model and group',
            type: 'juhe_error',
            code: 'internal_error'
          }
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    })

    await expect(executeImg2Img(buildTask())).rejects.toThrow(/ERR_PROVIDER_NO_CHANNEL/)
    await expect(executeImg2Img(buildTask())).rejects.toThrow(/CrossGroupRetry/)
  })

  it('500 + juhe_error 其他未知错误 → 翻译为 ERR_PROVIDER_REJECTED', async () => {
    primeProvider()
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: { message: 'some unknown admin issue', type: 'juhe_error', code: 'weird' }
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    })

    await expect(executeImg2Img(buildTask())).rejects.toThrow(/ERR_PROVIDER_REJECTED/)
    await expect(executeImg2Img(buildTask())).rejects.toThrow(/weird/)
  })

  it('500 + 非 JSON body → 回退到 HTTP 500 raw 信息', async () => {
    primeProvider()
    global.fetch = vi.fn(async () => new Response('plain text 500', { status: 500 }))

    await expect(executeImg2Img(buildTask())).rejects.toThrow(/^HTTP 500 plain text/)
  })
})
