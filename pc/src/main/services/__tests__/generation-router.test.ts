/**
 * generation-router 路由测试
 *
 * 关注点：
 *   - workflow/canvas 等旧节点只保存了 model，没保存 providerId。
 *   - createRoutedGenerationTask 应能按 model id 反查所属 provider 并补全，
 *     避免下游执行器因缺少 providerId 直接抛错。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDbSelect = vi.hoisted(() => vi.fn())
const mockCreateTask = vi.hoisted(() => vi.fn())

vi.mock('@main/db', () => ({
  db: {
    select: mockDbSelect
  }
}))

vi.mock('@main/db/schema', () => ({
  providers: { name: 'providers' },
  models: { name: 'models' }
}))

vi.mock('@main/services/queue', () => ({
  getGenerationQueue: vi.fn(() => ({
    createTask: mockCreateTask
  }))
}))

import { createRoutedGenerationTask } from '../generation-router'

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

describe('createRoutedGenerationTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTask.mockReturnValue({
      id: 'task-1',
      status: 'pending',
      params: {}
    } as unknown as ReturnType<typeof mockCreateTask>)
  })

  it('providerId 缺失时，根据 model id 反查并补全 providerId', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        models: [{ providerId: 'prov-from-model', type: 'image', capabilities: ['image'] }],
        providers: []
      })
    )

    await createRoutedGenerationTask({
      prompt: 'a cat',
      model: 'juhe-gpt-image-2',
      generationMode: 'image'
    })

    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    const passedParams = mockCreateTask.mock.calls[0][1]
    expect(passedParams.providerId).toBe('prov-from-model')
    expect(passedParams.model).toBe('juhe-gpt-image-2')
  })

  it('providerId 已存在时，不再反查 model 表，直接使用传入值', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        models: [{ providerId: 'prov-from-model', type: 'image', capabilities: ['image'] }],
        providers: [{ presetId: 'openai' }]
      })
    )

    await createRoutedGenerationTask({
      prompt: 'a cat',
      model: 'juhe-gpt-image-2',
      providerId: 'prov-explicit',
      generationMode: 'image'
    })

    const passedParams = mockCreateTask.mock.calls[0][1]
    expect(passedParams.providerId).toBe('prov-explicit')
  })

  it('model 不存在时保留原行为（providerId 为空），让下游校验给出明确错误', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        models: [],
        providers: []
      })
    )

    await createRoutedGenerationTask({
      prompt: 'a cat',
      model: 'unknown-model',
      generationMode: 'image'
    })

    const passedParams = mockCreateTask.mock.calls[0][1]
    expect(passedParams.providerId).toBeUndefined()
    expect(passedParams.model).toBe('unknown-model')
  })

  it('model 支持能力与生成模式不匹配时，抛出明确的中文错误', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        models: [{ providerId: 'prov-from-model', type: 'llm', capabilities: ['chat'] }],
        providers: []
      })
    )

    await expect(
      createRoutedGenerationTask({
        prompt: 'a cat',
        model: 'juhe-4',
        generationMode: 'image'
      })
    ).rejects.toThrow(/juhe-4.*不支持.*生成/)

    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('videoUrls 为空数组时按图像任务路由（空数组是 truthy，不得误判为视频）', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        models: [{ providerId: 'prov-from-model', type: 'image', capabilities: ['image'] }],
        providers: []
      })
    )

    await createRoutedGenerationTask({
      prompt: '换装',
      model: 'juhe-gpt-image-2',
      referenceImages: ['data:image/png;base64,xxx'],
      videoUrls: []
    })

    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    expect(mockCreateTask.mock.calls[0][0]).toBe('image')
  })

  it('videoUrls 有内容时才路由为视频任务', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain({
        models: [{ providerId: 'prov-from-model', type: 'video', capabilities: ['video'] }],
        providers: []
      })
    )

    await createRoutedGenerationTask({
      prompt: 'a walking cat',
      model: 'kling-3.0',
      videoUrls: ['https://example.com/ref.mp4']
    })

    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    expect(mockCreateTask.mock.calls[0][0]).toBe('video')
  })
})
