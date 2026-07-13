/**
 * 图像处理状态管理 (Zustand)
 * M3 Phase 1: 图生图、局部重绘、Upscale、背景移除、扩图、变体、智能修图
 */

import type {
  ImageProcessOutput,
  ImageProcessProgress,
  ImageProcessTask,
  ImageProcessType
} from '@shared/types/image-processing'
import { create } from 'zustand'
import { createApiProxy } from '@/utils/api-proxy'

// Track active polling interval to prevent leaks
let pollingInterval: ReturnType<typeof setInterval> | null = null
// Generation counter to prevent stale async callbacks from updating state after reset
let storeGeneration = 0

const api = createApiProxy()

export type LocalImageProcessType = 'smart-repair' | 'inpaint' | 'outpaint' | 'remove-bg' | 'upscale' | 'variant'

export interface LocalImageProcessTask {
  id: string
  type: LocalImageProcessType
  sourceImage: string // base64
  maskImage?: string // for inpaint
  providerId?: string
  modelId?: string
  params: {
    strength?: number
    scale?: number // for upscale: 2x, 4x
    direction?: 'all' | 'left' | 'right' | 'top' | 'bottom' // for outpaint
    ratio?: number // expansion ratio
    prompt?: string // guidance prompt
    brightness?: number
    contrast?: number
    saturation?: number
    sharpness?: number
    denoise?: number
    quality?: 'standard' | 'high' | 'ultra'
    style?: string
    variations?: number
    brushSize?: number
  }
  result?: string
  status: 'idle' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
}

interface ImageProcessState {
  // 任务列表
  tasks: ImageProcessTask[]
  // 当前活跃任务
  activeTaskId: string | null
  // 是否正在处理
  isProcessing: boolean

  // Local UI state
  localTask: LocalImageProcessTask

  // 操作
  createTask: (
    type: ImageProcessType,
    data: {
      sourceImage: string
      prompt?: string
      negativePrompt?: string
      maskImage?: string
      strength?: number
      scaleFactor?: number
      providerId?: string
      modelId?: string
    }
  ) => Promise<string>
  cancelTask: (taskId: string) => Promise<void>
  updateTask: (progress: ImageProcessProgress) => void
  getActiveTask: () => ImageProcessTask | null

  // Local UI actions
  setSourceImage: (image: string) => void
  setTaskType: (type: LocalImageProcessType) => void
  setParams: (params: Partial<LocalImageProcessTask['params']>) => void
  setMaskImage: (mask?: string) => void
  setResult: (result?: string) => void
  setStatus: (status: LocalImageProcessTask['status']) => void
  setProgress: (progress: number) => void
  setError: (error?: string) => void
  setProviderModel: (providerId: string, modelId: string) => void
  process: () => Promise<void>
  reset: () => void
}

function generateId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createDefaultLocalTask(): LocalImageProcessTask {
  return {
    id: generateId(),
    type: 'smart-repair',
    sourceImage: '',
    params: {
      strength: 0.7,
      scale: 2,
      direction: 'all',
      ratio: 1.5,
      prompt: '',
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      denoise: 0,
      quality: 'high',
      style: 'default',
      variations: 1
    },
    status: 'idle',
    progress: 0
  }
}

export const useImageProcessStore = create<ImageProcessState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  isProcessing: false,
  localTask: createDefaultLocalTask(),

  createTask: async (type, data) => {
    set({ isProcessing: true })
    const result = await api.imageProcess.create({ type, ...data })
    set({ activeTaskId: result.taskId })
    return result.taskId
  },

  cancelTask: async (taskId) => {
    await api.imageProcess.cancel(taskId)
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' as const } : t)),
      isProcessing: false,
      activeTaskId: null
    }))
  },

  updateTask: (progress) => {
    set((state) => {
      const exists = state.tasks.find((t) => t.id === progress.taskId)
      let newTasks: ImageProcessTask[]

      if (exists) {
        newTasks = state.tasks.map((t) =>
          t.id === progress.taskId
            ? {
                ...t,
                status: progress.status,
                progress: progress.progress,
                stage: progress.stage,
                error: progress.message,
                outputs: progress.outputs || t.outputs
              }
            : t
        )
      } else {
        // 新任务，从 API 获取完整数据（使用 generation 计数器防竞态）
        const gen = storeGeneration
        api.imageProcess.get(progress.taskId).then((task) => {
          if (gen !== storeGeneration) return // State was reset since, discard
          if (task) {
            set((s) => ({
              tasks: [task as ImageProcessTask, ...s.tasks]
            }))
          }
        }).catch((err) => {
          if (gen !== storeGeneration) return
          console.warn('[imageProcess] get task failed:', err)
        })
        newTasks = state.tasks
      }

      const isDone = progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled'

      return {
        tasks: newTasks,
        isProcessing: isDone ? false : state.isProcessing,
        activeTaskId: isDone ? null : state.activeTaskId
      }
    })
  },

  getActiveTask: () => {
    const { activeTaskId, tasks } = get()
    return tasks.find((t) => t.id === activeTaskId) || null
  },

  // Local UI actions
  setSourceImage: (image) =>
    set((state) => ({
      localTask: { ...state.localTask, sourceImage: image }
    })),

  setTaskType: (type) =>
    set((state) => ({
      localTask: { ...state.localTask, type, status: 'idle', progress: 0 }
    })),

  setParams: (params) =>
    set((state) => ({
      localTask: { ...state.localTask, params: { ...state.localTask.params, ...params } }
    })),

  setMaskImage: (mask) =>
    set((state) => ({
      localTask: { ...state.localTask, maskImage: mask }
    })),

  setResult: (result) =>
    set((state) => ({
      localTask: { ...state.localTask, result }
    })),

  setStatus: (status) =>
    set((state) => ({
      localTask: { ...state.localTask, status }
    })),

  setProgress: (progress) =>
    set((state) => ({
      localTask: { ...state.localTask, progress }
    })),

  setError: (error) =>
    set((state) => ({
      localTask: { ...state.localTask, error }
    })),

  setProviderModel: (providerId, modelId) =>
    set((state) => ({
      localTask: { ...state.localTask, providerId, modelId }
    })),

  process: async () => {
    const { localTask } = get()
    if (!localTask.sourceImage || get().isProcessing) return

    // Validate provider and model are selected
    if (!localTask.providerId || !localTask.modelId) {
      get().setError('Please select a provider and model first')
      return
    }

    set({ isProcessing: true })
    get().setStatus('processing')
    get().setProgress(0)
    get().setResult(undefined)
    get().setError(undefined)

    // Map local type to backend type
    let backendType: ImageProcessType
    switch (localTask.type) {
      case 'smart-repair':
        backendType = 'img2img'
        break
      case 'variant':
        backendType = 'variant'
        break
      case 'upscale':
        backendType = 'upscale'
        break
      case 'inpaint':
        backendType = 'inpaint'
        break
      case 'remove-bg':
        backendType = 'remove-bg'
        break
      case 'outpaint':
        backendType = 'outpaint'
        break
      default:
        backendType = 'img2img'
    }

    try {
      const taskId = await get().createTask(backendType, {
        sourceImage: localTask.sourceImage,
        prompt: localTask.params.prompt,
        strength: localTask.params.strength,
        scaleFactor: localTask.params.scale,
        maskImage: localTask.maskImage,
        providerId: localTask.providerId,
        modelId: localTask.modelId
      })

      // Clear any previous polling interval before creating a new one
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }

      // Poll for result
      pollingInterval = setInterval(async () => {
        const task = await window.api.imageProcess.get(taskId)
        if (!task) return

        const t = task as {
          status: string
          progress: number
          outputs: ImageProcessOutput[]
          error?: string
        }

        get().setProgress(t.progress || 0)

        if (t.status === 'completed') {
          if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
          const base64 = t.outputs?.[0]?.base64
          if (base64) {
            get().setResult(`data:image/png;base64,${base64}`)
          }
          get().setStatus('completed')
          set({ isProcessing: false })
        } else if (t.status === 'failed') {
          if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
          get().setStatus('failed')
          get().setError(t.error || 'Processing failed')
          set({ isProcessing: false })
        }
      }, 500)
    } catch (err) {
      if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
      get().setStatus('failed')
      get().setError(err instanceof Error ? err.message : 'Unknown error')
      set({ isProcessing: false })
    }
  },

  reset: () => {
    // Clear any active polling interval to prevent timer leaks
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    storeGeneration++
    set({
      localTask: createDefaultLocalTask(),
      isProcessing: false,
      activeTaskId: null
    })
  }
}))

// 注册进度监听
let unsubProgress: (() => void) | null = null

export function initImageProcessProgressListener() {
  if (unsubProgress) return
  unsubProgress = api.imageProcess.onProgress((_event, data) => {
    const progress = data as ImageProcessProgress
    useImageProcessStore.getState().updateTask(progress)
  })
}

export function cleanupImageProcessProgressListener() {
  unsubProgress?.()
  unsubProgress = null
}
