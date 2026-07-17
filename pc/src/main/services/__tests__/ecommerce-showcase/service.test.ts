import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Hoisted mocks ---------------------------------------------------------

const mockRows = vi.hoisted(() => [] as Record<string, unknown>[])

function findRows(pred: unknown): Record<string, unknown>[] {
  if (Array.isArray(pred)) {
    return findRows(pred[0])
  }
  if (pred && typeof pred === 'object' && 'column' in pred && 'value' in pred) {
    const { column, value } = pred as { column: { name: string }; value: unknown }
    return mockRows.filter((row) => row[column.name] === value)
  }
  return mockRows
}

const mockDb = vi.hoisted(() => ({
  insert: () => ({
    values: (obj: Record<string, unknown>) => {
      mockRows.push({ ...obj })
      return Promise.resolve()
    }
  }),
  update: () => ({
    set: (obj: Record<string, unknown>) => ({
      where: (pred: unknown) => {
        const targets = findRows(pred)
        for (const target of targets) {
          Object.assign(target, obj)
        }
        return Promise.resolve()
      }
    })
  }),
  select: () => ({
    from: () => ({
      where: (pred: unknown) => {
        const rows = findRows(pred)
        const limit = (n: number) => Promise.resolve(rows.slice(0, n))
        return Object.assign(Promise.resolve(rows), { limit })
      },
      orderBy: () => ({
        limit: (n: number) => Promise.resolve([...mockRows].reverse().slice(0, n))
      })
    })
  })
}))

const mockGenerateText = vi.hoisted(() => vi.fn())
const mockCreateTask = vi.hoisted(() => vi.fn())
const mockCancelTasks = vi.hoisted(() => vi.fn())
const mockQueueGetTask = vi.hoisted(() => vi.fn())
const mockQueue = {
  getTask: mockQueueGetTask,
  cancelTasks: mockCancelTasks
}

vi.mock('@main/db', () => ({ db: mockDb }))
vi.mock('@main/db/schema', () => ({
  showcaseTasks: {
    name: 'showcase_tasks',
    id: { name: 'id' },
    status: { name: 'status' },
    updatedAt: { name: 'updated_at' }
  }
}))
vi.mock('drizzle-orm', () => ({
  eq: (column: { name: string }, value: unknown) => ({ column, value }),
  and: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
  desc: () => null
}))
vi.mock('@cherrystudio/ai-core', () => ({ generateText: mockGenerateText }))
vi.mock('@shared/ecommerce-workflow/cost-estimate', () => ({
  estimateShowcaseCost: (_type: string, count: number) => 100 + count * 10
}))
vi.mock('@shared/ecommerce-workflow/module-types', async (importOriginal) => {
  const original = await importOriginal<typeof import('@shared/ecommerce-workflow/module-types')>()
  return original
})
vi.mock('@shared/utils/error-classifier', () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error))
}))
vi.mock('@shared/utils/image-prompt-safety', () => ({
  buildProductOnlyPrompt: (prompt: string) => prompt
}))
vi.mock('@main/services/ecommerce-workflow/utils', () => ({
  aspectRatioToImageSize: () => ({ width: 1024, height: 1024 }),
  buildAiCoreSettings: () => ({}),
  checkCapability: () => {},
  filePathToBase64DataUrl: () => Promise.resolve('data:image/png;base64,xxx'),
  mapProviderType: (type: string) => type,
  resolveProviderConfig: () => Promise.resolve({ providerType: 'openai' })
}))
vi.mock('@main/services/generation-router', () => ({
  createRoutedGenerationTask: mockCreateTask
}))
vi.mock('@main/services/queue', () => ({
  getGenerationQueue: () => mockQueue
}))

import {
  cancelTask,
  generateImages,
  generatePlan,
  generateSellingPoints,
  getTask,
  listTasks,
  recoverRunningTasksOnStartup
} from '../../ecommerce-showcase'

// --- Helpers ---------------------------------------------------------------

const baseInput = {
  productImage: '/tmp/product.png',
  productText: 'A wireless headphone',
  platform: 'amazon' as const,
  market: 'us' as const,
  language: 'en' as const,
  modules: ['main_visual'],
  visionChatProviderId: 'vision-provider',
  visionChatModelId: 'vision-model',
  imageProviderId: 'image-provider',
  imageModelId: 'image-model'
}

async function waitForStatus(id: string, status: string, maxMs = 3000) {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    const task = await getTask(id)
    if (task?.status === status) return task
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  const last = await getTask(id)
  throw new Error(`Timeout waiting for status ${status}, last status: ${last?.status}, error: ${last?.errorMsg}`)
}

// --- Tests -----------------------------------------------------------------

describe('ecommerce-showcase service', () => {
  beforeEach(() => {
    mockRows.length = 0
    vi.clearAllMocks()
    mockGenerateText.mockReset()
    mockCreateTask.mockReset()
    mockQueueGetTask.mockReset()
    mockQueueGetTask.mockReturnValue({ status: 'pending' })
    mockCancelTasks.mockReset()
  })

  it('generateSellingPoints creates a task and completes it with parsed selling points', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({ selling_points: ['Premium sound', 'Long battery life'] })
    })

    const id = await generateSellingPoints(baseInput)
    expect(id).toBeTruthy()

    const task = await getTask(id)
    expect(task?.type).toBe('selling_points')

    const completed = await waitForStatus(id, 'completed')
    expect(completed.result).toEqual({ sellingPoints: ['Premium sound', 'Long battery life'] })
    expect(completed.errorMsg).toBeUndefined()
  })

  it('generatePlan creates a task and completes it with parsed modules', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        modules: [
          {
            id: 'main_visual',
            title: 'Main Image',
            imagePrompt: 'A clean product shot',
            copyRequirements: 'Highlight portability'
          }
        ]
      })
    })

    const id = await generatePlan({
      ...baseInput,
      sellingPoints: ['Premium sound']
    })

    const completed = await waitForStatus(id, 'completed')
    expect(completed.result).toEqual({
      modules: [
        {
          id: 'main_visual',
          title: 'Main Image',
          imagePrompt: 'A clean product shot',
          copyRequirements: 'Highlight portability'
        }
      ]
    })
  })

  it('generateImages creates a task and can be cancelled before generation finishes', async () => {
    mockCreateTask.mockResolvedValueOnce({ id: 'gen-task-1' })

    const id = await generateImages({
      ...baseInput,
      plan: {
        modules: [
          {
            id: 'main_visual',
            title: 'Main Image',
            imagePrompt: 'A clean product shot',
            copyRequirements: 'Highlight portability'
          }
        ]
      }
    })

    const task = await getTask(id)
    expect(task?.type).toBe('images')

    // Wait until runImages has created the routed generation task before cancelling
    let withGenerationIds = await getTask(id)
    const started = Date.now()
    while (!withGenerationIds?.generationTaskIds && Date.now() - started < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      withGenerationIds = await getTask(id)
    }
    expect(withGenerationIds?.generationTaskIds).toEqual(['gen-task-1'])

    await cancelTask(id)

    const cancelled = await waitForStatus(id, 'cancelled')
    expect(cancelled.status).toBe('cancelled')
    expect(mockCancelTasks).toHaveBeenCalledWith(['gen-task-1'])
  })

  it('listTasks returns tasks ordered by updatedAt descending', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ selling_points: ['A'] })
    })

    const id1 = await generateSellingPoints(baseInput)
    const id2 = await generateSellingPoints(baseInput)

    // Force different updatedAt values by mutating rows directly.
    const row1 = mockRows.find((r) => r.id === id1)
    const row2 = mockRows.find((r) => r.id === id2)
    if (row1) row1.updatedAt = '2026-01-01T00:00:00.000Z'
    if (row2) row2.updatedAt = '2026-01-02T00:00:00.000Z'

    const tasks = await listTasks(10)
    expect(tasks.map((t) => t.id)).toEqual([id2, id1])
  })

  it('recoverRunningTasksOnStartup marks running image tasks as failed and cancels generation tasks', async () => {
    mockRows.push({
      id: 'running-images',
      type: 'images',
      status: 'running',
      input: {},
      generationTaskIds: ['gen-1', 'gen-2'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })

    await recoverRunningTasksOnStartup()

    const task = await getTask('running-images')
    expect(task?.status).toBe('failed')
    expect(task?.errorMsg).toContain('App restarted')
    expect(mockCancelTasks).toHaveBeenCalledWith(['gen-1', 'gen-2'])
  })
})
