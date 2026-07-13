/**
 * executeImageGeneration 模型 id -> 上游 name 映射测试
 *
 * 背景：
 *   本地 models 表用 id（如 juhe-4）作为内部标识，而 name（如 juhe-gpt-image-2）
 *   才是上游 API 能识别的模型名。生成请求前必须把 id 映射为 name，否则上游会
 *   返回 model not supported / 404。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────

const mockUserDataPath = vi.hoisted(() => '/tmp/juhe-test')
const mockDbSelect = vi.hoisted(() => vi.fn())
const mockFetch = vi.hoisted(() => vi.fn())
const mockDecryptApiKey = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? mockUserDataPath : '/tmp'))
  }
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn()
}))

vi.mock('@main/db', () => ({
  db: {
    select: mockDbSelect,
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve())
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    }))
  }
}))

vi.mock('@main/db/schema', () => ({
  generations: { name: 'generations' },
  models: { name: 'models' },
  providers: { name: 'providers' }
}))

vi.mock('@main/services/secure-storage', () => ({
  decryptApiKey: mockDecryptApiKey
}))

vi.mock('@cherrystudio/ai-core', () => ({
  generateImage: vi.fn()
}))

vi.stubGlobal('fetch', mockFetch)

import { executeImageGeneration } from '../generation'

function makeSelectChain(rowsByTable: Record<string, unknown[]>) {
  return {
    from: (table: { name?: string }) => {
      const rows = rowsByTable[table.name ?? ''] ?? []
      return {
        where: () => ({
          limit: () => Promise.resolve(rows)
        })
      }
    }
  }
}

function makeTask(modelId: string) {
  return {
    id: 'task-1',
    type: 'image' as const,
    status: 'pending' as const,
    priority: 'normal' as const,
    params: {
      providerId: 'juhe-management',
      model: modelId,
      prompt: 'a cat',
      n: 1
    },
    outputs: [],
    progress: 0,
    stage: 'queued' as const,
    createdAt: Date.now(),
    abortController: new AbortController()
  }
}

describe('executeImageGeneration 模型 id -> 上游 name 映射', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDecryptApiKey.mockReturnValue('sk-test')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            created: 1234567890,
            data: [{ b64_json: 'dGVzdA==' }]
          })
        )
    } as Response)
  })

  it('本地 model id 应映射为上游模型名后再发送请求', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        providers: [
          {
            id: 'juhe-management',
            type: 'openai-chat-completions',
            baseUrl: 'http://test/v1',
            apiKey: 'enc',
            isEnabled: true
          }
        ],
        models: [{ id: 'juhe-4', name: 'juhe-gpt-image-2' }]
      })
    )

    await executeImageGeneration(makeTask('juhe-4'))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('juhe-gpt-image-2')
  })

  it('models 表无记录时回退到原 model id', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        providers: [
          {
            id: 'juhe-management',
            type: 'openai-chat-completions',
            baseUrl: 'http://test/v1',
            apiKey: 'enc',
            isEnabled: true
          }
        ],
        models: []
      })
    )

    await executeImageGeneration(makeTask('custom-model'))

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('custom-model')
  })

  it('失败日志中不出现本地 modelId（juhe-4）', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        providers: [
          {
            id: 'juhe-management',
            type: 'openai-chat-completions',
            baseUrl: 'http://test/v1',
            apiKey: 'enc',
            isEnabled: true
          }
        ],
        models: [{ id: 'juhe-4', name: 'juhe-gpt-image-2' }]
      })
    )

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: {
              message: 'no pricing configured for image generation',
              type: 'juhe_error',
              code: 'internal_error'
            }
          })
        )
    } as Response)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(executeImageGeneration(makeTask('juhe-4'))).rejects.toThrow()

    const generationErrorLog = errorSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[Generation] Direct API call failed')
    )
    expect(generationErrorLog).toBeTruthy()
    const logPayload = generationErrorLog![1] as { model?: string; modelId?: string }
    expect(logPayload.model).toBe('juhe-gpt-image-2')
    expect(logPayload.modelId).toBeUndefined()

    errorSpy.mockRestore()
  })
})
