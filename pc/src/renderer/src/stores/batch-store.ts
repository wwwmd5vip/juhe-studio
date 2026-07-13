/**
 * batch-store.ts — 批量队列状态管理
 * 灵感来源：YunQiao 批量生产车间、Mirror Studio 任务队列
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BatchStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed'

export interface BatchItem {
  id: string
  prompt: string
  negativePrompt?: string
  size?: string
  providerId: string
  model: string
  status: BatchStatus
  taskId?: string
  result?: string
  error?: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
}

interface BatchQueueState {
  items: BatchItem[]
  isRunning: boolean
  concurrency: number
  // Actions
  addItems: (items: Omit<BatchItem, 'id' | 'status' | 'createdAt'>[]) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<BatchItem>) => void
  clearCompleted: () => void
  clearAll: () => void
  startQueue: () => void
  pauseQueue: () => void
  retryItem: (id: string) => void
  setConcurrency: (n: number) => void
  importFromJSON: (json: string) => number
}

let idCounter = Date.now()
const genId = () => `batch-${++idCounter}`

export const useBatchQueueStore = create<BatchQueueState>()(
  persist(
    (set, get) => ({
      items: [],
      isRunning: false,
      concurrency: 3,

      addItems: (newItems) => {
        const items: BatchItem[] = newItems.map((item) => ({
          ...item,
          id: genId(),
          status: 'pending',
          createdAt: Date.now(),
        }))
        set((state) => ({ items: [...state.items, ...items] }))
      },

      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateItem: (id, patch) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }))
      },

      clearCompleted: () => set((state) => ({ items: state.items.filter((i) => i.status !== 'completed' && i.status !== 'failed') })),
      clearAll: () => set({ items: [], isRunning: false }),

      startQueue: () => set({ isRunning: true }),
      pauseQueue: () => set({ isRunning: false }),

      retryItem: (id) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, status: 'pending' as BatchStatus, error: undefined, taskId: undefined } : i)),
        }))
      },

      setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(10, n)) }),

      importFromJSON: (json) => {
        try {
          const parsed = JSON.parse(json) as Record<string, unknown>
          const raw: unknown[] = Array.isArray(parsed) ? parsed : (parsed.prompts as unknown[]) || (parsed.tasks as unknown[]) || []
          if (raw.length === 0) return 0
          interface ImportableItem { prompt: string; negativePrompt?: string; size?: string; providerId: string; model: string }
          const items: ImportableItem[] = raw.map((r: unknown) => {
            if (typeof r === 'string') return { prompt: r, size: '1024x1024', providerId: '', model: '' }
            const o = r as Record<string, unknown>
            return {
              prompt: (o.prompt as string) || (o.text as string) || '',
              negativePrompt: (o.negativePrompt as string) || (o.negative_prompt as string) || undefined,
              size: (o.size as string) || '1024x1024',
              providerId: (o.providerId as string) || '',
              model: (o.model as string) || '',
            }
          })
          get().addItems(items as Omit<BatchItem, 'id' | 'status' | 'createdAt'>[])
          return items.length
        } catch {
          return 0
        }
      },
    }),
    { name: 'juhe-batch-queue' }
  )
)
