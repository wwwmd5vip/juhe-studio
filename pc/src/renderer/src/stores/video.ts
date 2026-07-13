/**
 * @deprecated This store has been merged into the Generation store.
 * Video generation now uses useGenerationStore from '@/stores/generation'.
 * All video parameters and modes are handled via VideoParameterPanel in the /generate route.
 * This file is kept for reference only and should not be used in new code.
 *
 * Video Generation standalone store (Zustand)
 */

import type { GenerationProgress, GenerationTask } from '@shared/types/generation'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createApiProxy } from '@/utils/api-proxy'

// 防御性代理 — preload 失败时给出清晰错误而非 "can't access property 'X', api is undefined"
const api = createApiProxy()

export type VideoMode = 'text' | 'image' | 'first-last-frame' | 'multi-reference'

export interface VideoParams {
  providerId: string
  model: string
  duration: number | string
  resolution: string
  fps: number
  prompt: string
  negativePrompt: string
  style: string
  camera: string
  lighting: string
  mode: VideoMode
  firstFrame: string | null
  lastFrame: string | null
  referenceImages: string[]
  referenceTags: string[]
  motionStrength: number
  cameraStrength: 'weak' | 'medium' | 'strong'
  aspectRatio: string
  // 小云雀参数
  productName: string
  modelImages: string[]
  videoUrls: string[]
  language: string
  enableWatermark: boolean
}

export type VideoTask = GenerationTask

interface VideoState {
  params: VideoParams
  tasks: VideoTask[]
  isGenerating: boolean
  activeTaskId: string | null
  setParams: (params: Partial<VideoParams>) => void
  setMode: (mode: VideoMode) => void
  addReferenceImage: (image: string) => void
  removeReferenceImage: (index: number) => void
  setReferenceTag: (index: number, tag: string) => void
  setFirstFrame: (image: string | null) => void
  setLastFrame: (image: string | null) => void
  generate: () => Promise<void>
  cancelGenerate: () => Promise<void>
  updateTask: (progress: GenerationProgress) => void
}

const defaultParams: VideoParams = {
  providerId: '',
  model: '',
  duration: 5,
  resolution: '1080p',
  fps: 30,
  prompt: '',
  negativePrompt: '',
  style: 'cinematic',
  camera: 'static',
  lighting: 'natural',
  mode: 'text',
  firstFrame: null,
  lastFrame: null,
  referenceImages: [],
  referenceTags: [],
  motionStrength: 50,
  cameraStrength: 'medium',
  aspectRatio: '16:9',
  // 小云雀参数
  productName: '',
  modelImages: [],
  videoUrls: [],
  language: 'Chinese',
  enableWatermark: true
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set, get) => ({
      params: { ...defaultParams },
      tasks: [],
      isGenerating: false,
      activeTaskId: null,

      setParams: (partial) => {
        set((state) => ({
          params: { ...state.params, ...partial }
        }))
      },

      setMode: (mode) => {
        set((state) => ({
          params: { ...state.params, mode }
        }))
      },

      addReferenceImage: (image) => {
        set((state) => {
          if (state.params.referenceImages.length >= 4) return state
          return {
            params: {
              ...state.params,
              referenceImages: [...state.params.referenceImages, image],
              referenceTags: [...state.params.referenceTags, 'character']
            }
          }
        })
      },

      removeReferenceImage: (index) => {
        set((state) => ({
          params: {
            ...state.params,
            referenceImages: state.params.referenceImages.filter((_, i) => i !== index),
            referenceTags: state.params.referenceTags.filter((_, i) => i !== index)
          }
        }))
      },

      setReferenceTag: (index, tag) => {
        set((state) => ({
          params: {
            ...state.params,
            referenceTags: state.params.referenceTags.map((t, i) => (i === index ? tag : t))
          }
        }))
      },

      setFirstFrame: (image) => {
        set((state) => ({
          params: { ...state.params, firstFrame: image }
        }))
      },

      setLastFrame: (image) => {
        set((state) => ({
          params: { ...state.params, lastFrame: image }
        }))
      },

      generate: async () => {
        const { params, tasks } = get()
        const isJimeng = params.model?.startsWith('jimeng-')

        const canGenerate =
          params.mode === 'text'
            ? params.prompt.trim()
            : params.mode === 'image'
              ? params.referenceImages.length > 0 && params.prompt.trim()
              : params.mode === 'first-last-frame'
                ? params.firstFrame && params.lastFrame && params.prompt.trim()
                : params.referenceImages.length > 0 && params.prompt.trim()

        if (!canGenerate) return

        set({ isGenerating: true })

        try {
          // 构建生成参数
          const generationParams: Record<string, unknown> = {
            providerId: params.providerId,
            prompt: params.prompt,
            negativePrompt: params.negativePrompt,
            duration: params.duration,
            fps: params.fps,
            style: params.style,
            mode: params.mode,
            firstFrame: params.firstFrame,
            lastFrame: params.lastFrame,
            referenceImages: params.referenceImages,
            referenceTags: params.referenceTags,
            motionStrength: params.motionStrength,
            aspectRatio: params.aspectRatio,
            camera: params.camera,
            cameraStrength: params.cameraStrength,
            // 小云雀参数
            productName: params.productName,
            modelImages: params.modelImages,
            videoUrls: params.videoUrls,
            language: params.language,
            enableWatermark: params.enableWatermark
          }

          // Jimeng 视频生成需要特殊处理
          if (isJimeng) {
            generationParams.model = params.model
            // Jimeng 首尾帧模式：将 firstFrame/lastFrame 转换为 referenceImages
            if (params.mode === 'first-last-frame' && params.firstFrame && params.lastFrame) {
              generationParams.referenceImages = [params.firstFrame, params.lastFrame]
            }
          } else {
            generationParams.videoModel = params.model
            generationParams.cameraMotion = params.camera
          }

          const result = await api.generation.create({
            type: isJimeng ? 'jimeng' : 'video',
            // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
            params: generationParams as any
          })

          const newTask: VideoTask = {
            id: result.taskId,
            type: 'video',
            status: 'pending',
            priority: 'normal',
            params: {
              providerId: params.providerId,
              prompt: params.prompt,
              negativePrompt: params.negativePrompt,
              videoModel: params.model,
              duration: typeof params.duration === 'string' ? parseInt(params.duration, 10) : params.duration,
              fps: params.fps,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              cameraMotion: params.camera as any,
              // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
              style: params.style as any,
              mode: params.mode,
              firstFrame: params.firstFrame,
              lastFrame: params.lastFrame,
              referenceImages: params.referenceImages,
              referenceTags: params.referenceTags,
              motionStrength: params.motionStrength
            },
            outputs: [],
            progress: 0,
            stage: 'pending',
            createdAt: Date.now()
          }

          set({
            tasks: [newTask, ...tasks],
            activeTaskId: result.taskId,
            isGenerating: false
          })
        } catch (error) {
          console.error('Failed to generate video:', error)
          set({ isGenerating: false })
        }
      },

      cancelGenerate: async () => {
        const { activeTaskId } = get()
        if (!activeTaskId) return
        try {
          await api.generation.cancel(activeTaskId)
        } catch (error) {
          console.error('Failed to cancel video generation:', error)
        }
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === activeTaskId ? { ...t, status: 'cancelled' as const } : t)),
          isGenerating: false,
          activeTaskId: null
        }))
      },

      updateTask: (progress) => {
        set((state) => {
          const exists = state.tasks.find((t) => t.id === progress.taskId)
          let newTasks: VideoTask[]

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
            isGenerating: isDone ? false : state.isGenerating,
            activeTaskId: isDone ? null : state.activeTaskId
          }
        })
      }
    }),
    {
      name: 'cherrystudio-video-params',
      partialize: (state) => ({ params: state.params })
    }
  )
)

let unsubProgress: (() => void) | null = null
let unsubProgressBatch: (() => void) | null = null

export function initVideoProgressListener() {
  if (unsubProgress) return
  unsubProgress = api.generation.onProgress((_event, data) => {
    const progress = data as GenerationProgress
    useVideoStore.getState().updateTask(progress)
  })
  unsubProgressBatch = api.generation.onProgressBatch((_event, data) => {
    const batch = data as GenerationProgress[]
    const store = useVideoStore.getState()
    for (const progress of batch) {
      store.updateTask(progress)
    }
  })
}

export function cleanupVideoProgressListener() {
  unsubProgress?.()
  unsubProgress = null
  unsubProgressBatch?.()
  unsubProgressBatch = null
}
