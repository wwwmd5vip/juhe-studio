/**
 * Image-to-Image standalone store (Zustand)
 */

import type { GenerationProgress, GenerationTask } from '@shared/types/generation'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createApiProxy } from '@/utils/api-proxy'
import { error as toastError } from '@/components/ui/toast'

const api = createApiProxy()

export interface Img2ImgParams {
  providerId: string
  model: string
  transformation: string
  strength: number
  prompt: string
  style: string
  quality: string
  size: string
}

export type Img2ImgTask = GenerationTask

interface Img2ImgState {
  sourceImage: string | null
  params: Img2ImgParams
  result: string | null
  tasks: Img2ImgTask[]
  isProcessing: boolean
  activeTaskId: string | null
  setSourceImage: (image: string | null) => void
  setParams: (params: Partial<Img2ImgParams>) => void
  process: () => Promise<void>
  cancelProcess: () => Promise<void>
  updateTask: (progress: GenerationProgress) => void
}

const defaultParams: Img2ImgParams = {
  providerId: '',
  model: '',
  transformation: 'style-transfer',
  strength: 50,
  prompt: '',
  style: 'vivid',
  quality: 'standard',
  size: '1024x1024'
}

export const useImg2ImgStore = create<Img2ImgState>()(
  persist(
    (set, get) => ({
      sourceImage: null,
      params: { ...defaultParams },
      result: null,
      tasks: [],
      isProcessing: false,
      activeTaskId: null,

      setSourceImage: (image) => {
        set({ sourceImage: image })
      },

      setParams: (partial) => {
        set((state) => ({
          params: { ...state.params, ...partial }
        }))
      },

      process: async () => {
        const { params, sourceImage, tasks } = get()
        if (!sourceImage) return

        set({ isProcessing: true })

        try {
          const result = await api.generation.create({
            type: 'image',
            params: {
              providerId: params.providerId,
              model: params.model,
              prompt: params.prompt,
              referenceImages: [sourceImage],
              referenceWeight: params.strength / 100,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              style: params.style as any,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              quality: params.quality as any,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              size: params.size as any
            }
          })

          const newTask: Img2ImgTask = {
            id: result.taskId,
            type: 'image',
            status: 'pending',
            priority: 'normal',
            params: {
              providerId: params.providerId,
              model: params.model,
              prompt: params.prompt,
              referenceImages: [sourceImage],
              referenceWeight: params.strength / 100,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              style: params.style as any,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              quality: params.quality as any,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              size: params.size as any
            },
            outputs: [],
            progress: 0,
            stage: 'pending',
            createdAt: Date.now()
          }

          set({
            tasks: [newTask, ...tasks],
            activeTaskId: result.taskId,
            isProcessing: false
          })
        } catch (error) {
          console.error('Failed to process image:', error)
          toastError({ description: '图像处理失败，请重试' })
          set({ isProcessing: false })
        }
      },

      cancelProcess: async () => {
        const { activeTaskId } = get()
        if (!activeTaskId) return
        try {
          await api.generation.cancel(activeTaskId)
        } catch (error) {
          console.error('Failed to cancel image processing:', error)
        }
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === activeTaskId ? { ...t, status: 'cancelled' as const } : t)),
          isProcessing: false,
          activeTaskId: null
        }))
      },

      updateTask: (progress) => {
        set((state) => {
          const exists = state.tasks.find((t) => t.id === progress.taskId)
          let newTasks: Img2ImgTask[]

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
            newTasks = state.tasks
          }

          const isDone =
            progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled'

          return {
            tasks: newTasks,
            isProcessing: isDone ? false : state.isProcessing,
            activeTaskId: isDone ? null : state.activeTaskId
          }
        })
      }
    }),
    {
      name: 'cherrystudio-img2img-params',
      partialize: (state) => ({ params: state.params })
    }
  )
)

let unsubProgress: (() => void) | null = null
let unsubProgressBatch: (() => void) | null = null

export function initImg2ImgProgressListener() {
  if (unsubProgress) return
  unsubProgress = api.generation.onProgress((_event, data) => {
    const progress = data as GenerationProgress
    useImg2ImgStore.getState().updateTask(progress)
  })
  unsubProgressBatch = api.generation.onProgressBatch((_event, data) => {
    const batch = data as GenerationProgress[]
    const store = useImg2ImgStore.getState()
    for (const progress of batch) {
      store.updateTask(progress)
    }
  })
}

export function cleanupImg2ImgProgressListener() {
  unsubProgress?.()
  unsubProgress = null
  unsubProgressBatch?.()
  unsubProgressBatch = null
}
