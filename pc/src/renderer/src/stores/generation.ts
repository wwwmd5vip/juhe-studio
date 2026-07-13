/**
 * 生成任务状态管理 (Zustand)
 */

import type { GenerationParams, GenerationProgress, GenerationTask, GenerationType } from '@shared/types/generation'
import { isNetworkError } from '@shared/utils/error-classifier'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { success, error as toastError } from '@/components/ui/toast'
import { createApiProxy } from '@/utils/api-proxy'
import { getFallbackProviderId, resolveProviderId } from './loadbalance'
import { useNetworkStore } from './network'
import { useUsageStore } from './usage'

// 防御性代理 — preload 失败时给出清晰错误而非 "can't access property 'X', api is undefined"
const api = createApiProxy()

// Rough cost estimation per generation type
function estimateCost(type: GenerationType, _params: GenerationParams): number {
  switch (type) {
    case 'image':
    case 'aliyun-image':
    case 'jimeng':
      return 0.04
    case 'video':
    case 'aliyun-video':
      return 0.5
    case 'text':
      return 0.002
    default:
      return 0.01
  }
}

function mapGenerationTypeToUsageType(type: GenerationType): 'image' | 'video' | 'audio' | 'text' {
  if (type === 'aliyun-image' || type === 'jimeng') return 'image'
  if (type === 'aliyun-video') return 'video'
  return type
}

function getProviderName(providerId?: string): string {
  if (!providerId) return 'Unknown'
  // Try to get from provider store if available
  try {
    const require_ = (globalThis as unknown as { require?: (id: string) => unknown }).require
    if (!require_) return providerId
    const { useProviderStore } = require_('./providers') as {
      useProviderStore: { getState: () => { providers: Array<{ id: string; name: string }> } }
    }
    const provider = useProviderStore.getState().providers.find((p) => p.id === providerId)
    if (provider) return provider.name
  } catch {
    // ignore
  }
  return providerId
}

interface DefaultModelConfig {
  providerId: string
  model: string
}

// Maximum tasks to keep in memory to prevent OOM from base64 image data
const MAX_TASKS_IN_MEMORY = 30
// Hard limit on total tasks to prevent unbounded array growth
const MAX_TOTAL_TASKS = 100

interface GenerationState {
  // 任务列表
  tasks: GenerationTask[]
  // 当前活跃任务
  activeTaskId: string | null
  // 是否正在生成
  isGenerating: boolean
  // 生成参数
  params: GenerationParams
  // 批量生成
  batchTaskIds: string[]
  isBatchGenerating: boolean
  // 重试状态
  retryCount: number
  isRetrying: boolean
  retryError: string | null
  // 历史记录是否已加载
  historyLoaded: boolean
  // 各模式默认模型配置
  defaultModels: Record<string, DefaultModelConfig | undefined>
  // 操作
  createTask: (type: GenerationType, params: GenerationParams) => Promise<string>
  createBatch: (type: GenerationType, params: GenerationParams, prompts: string[]) => Promise<string[]>
  cancelTask: (taskId: string) => Promise<void>
  updateTask: (progress: GenerationProgress) => void
  setParams: (params: Partial<GenerationParams>) => void
  resetParams: () => void
  getActiveTask: () => GenerationTask | null
  clearRetryError: () => void
  loadHistory: (limit?: number) => Promise<void>
  setDefaultModel: (mode: string, config: DefaultModelConfig) => void
  getDefaultModel: (mode: string) => DefaultModelConfig | undefined
  reset: () => void
}

/** Trim base64 data from old tasks to free memory, keeping only URLs
 *
 * IMPORTANT: tasks are sorted newest-first (index 0 = most recent).
 * We keep full data for the newest MAX_TASKS_IN_MEMORY tasks.
 * For older tasks, we strip base64/reference images to save memory.
 */
function trimTaskMemory(tasks: GenerationTask[]): GenerationTask[] {
  // Hard cap: drop oldest tasks beyond MAX_TOTAL_TASKS
  const trimmed = tasks.length > MAX_TOTAL_TASKS ? tasks.slice(0, MAX_TOTAL_TASKS) : tasks
  if (trimmed.length <= MAX_TASKS_IN_MEMORY) return trimmed
  return trimmed.map((task, index) => {
    // Keep full data for NEWEST tasks (index 0 is newest)
    // index 0 to MAX_TASKS_IN_MEMORY-1 are kept intact
    if (index < MAX_TASKS_IN_MEMORY) return task
    // For older tasks, remove base64 to save memory (keep URLs)
    return {
      ...task,
      params: {
        ...task.params,
        referenceImages: undefined,
        referenceWeights: undefined,
        firstFrame: undefined,
        lastFrame: undefined
      },
      outputs: task.outputs.map((output) => ({
        ...output,
        base64: undefined // Free the base64 memory
      }))
    }
  })
}

/** Derive global queue UI state from the task list so multi-task status stays consistent. */
function deriveQueueState(tasks: GenerationTask[]): { isGenerating: boolean; activeTaskId: string | null } {
  const running = tasks.filter((t) => t.status === 'processing' || t.status === 'pending')
  return {
    isGenerating: running.length > 0,
    activeTaskId: running.length > 0 ? running[0].id : null
  }
}

const defaultParams: GenerationParams = {
  prompt: '',
  negativePrompt: '',
  n: 1,
  size: '1024x1024',
  quality: 'standard',
  style: 'vivid',
  seed: undefined,
  autoOptimize: false,
  optimizerProviderId: undefined,
  optimizerModel: undefined,
  // 视频参数
  duration: 5,
  resolution: '1080p',
  fps: 30,
  aspectRatio: '16:9',
  cameraMotion: 'static',
  cameraStrength: 'medium',
  camera: 'static',
  mode: 'text',
  firstFrame: null,
  lastFrame: null,
  referenceImages: [],
  referenceTags: [],
  motionStrength: 50,
  // 小云雀参数
  productName: '',
  modelImages: [],
  videoUrls: [],
  language: 'Chinese',
  enableWatermark: true
}

const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const useGenerationStore = create<GenerationState>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,
      isGenerating: false,
      params: { ...defaultParams },
      batchTaskIds: [],
      isBatchGenerating: false,
      retryCount: 0,
      isRetrying: false,
      retryError: null,
      historyLoaded: false,
      defaultModels: {},

      createTask: async (type, params) => {
        // 离线检查
        if (!useNetworkStore.getState().isOnline) {
          set({ retryError: 'offline' })
          throw new Error('offline')
        }

        set({ isGenerating: true, retryCount: 0, retryError: null, isRetrying: false })
        const startTime = Date.now()

        // Resolve provider via load balance group if applicable
        const resolvedProviderId = resolveProviderId(params.providerId)
        const taskParams = { ...params, providerId: resolvedProviderId }

        const tryCreate = async (providerId: string | undefined, attempt: number): Promise<string> => {
          const currentParams = { ...taskParams, providerId }
          try {
            const result = await api.generation.create({ type, params: currentParams })
            // 立即将新任务添加到 tasks 列表前端，确保进度推送能正确更新
            const newTask: GenerationTask = {
              id: result.taskId,
              type,
              status: result.status as GenerationTask['status'],
              priority: 'normal',
              params: currentParams,
              outputs: [],
              progress: 0,
              stage: 'queued',
              createdAt: Date.now()
            }
            set((state) => {
              const merged = [newTask, ...state.tasks]
              const trimmed = trimTaskMemory(merged)
              const queueState = deriveQueueState(trimmed)
              return {
                activeTaskId: queueState.activeTaskId,
                isGenerating: queueState.isGenerating,
                retryCount: 0,
                isRetrying: false,
                tasks: trimmed
              }
            })
            useUsageStore.getState().addRecord({
              providerId: providerId || 'unknown',
              providerName: getProviderName(providerId),
              modelId: currentParams.model || 'unknown',
              modelName: currentParams.model || 'unknown',
              type: mapGenerationTypeToUsageType(type),
              cost: estimateCost(type, currentParams),
              duration: Date.now() - startTime,
              status: 'success'
            })
            success({
              title: '生成任务已创建',
              description: `任务 #${result.taskId.slice(0, 8)} 已进入队列`
            })
            return result.taskId
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('Failed to create generation task:', message)

            // 网络错误自动重试
            if (isNetworkError(error) && attempt < MAX_RETRIES) {
              const nextAttempt = attempt + 1
              set({ retryCount: nextAttempt, isRetrying: true })
              await sleep(RETRY_DELAY_BASE * 2 ** (nextAttempt - 1))
              return tryCreate(providerId, nextAttempt)
            }

            // Try fallback provider if available
            const fallback = getFallbackProviderId(providerId)
            if (fallback && fallback !== providerId) {
              console.log(`Retrying with fallback provider: ${fallback}`)
              return tryCreate(fallback, attempt)
            }

            useUsageStore.getState().addRecord({
              providerId: providerId || 'unknown',
              providerName: getProviderName(providerId),
              modelId: currentParams.model || 'unknown',
              modelName: currentParams.model || 'unknown',
              type: mapGenerationTypeToUsageType(type),
              cost: 0,
              duration: Date.now() - startTime,
              status: 'failed'
            })
            set({ isGenerating: false, isRetrying: false, retryError: message })
            toastError({
              title: '生成任务失败',
              description: message.length > 60 ? `${message.slice(0, 60)}...` : message,
              timeout: 5000
            })
            throw error
          }
        }

        return tryCreate(resolvedProviderId, 0)
      },

      createBatch: async (type, params, prompts) => {
        if (!useNetworkStore.getState().isOnline) {
          set({ retryError: 'offline' })
          throw new Error('offline')
        }

        set({ isBatchGenerating: true, batchTaskIds: [], retryCount: 0, retryError: null, isRetrying: false })
        try {
          const result = await api.generation.createBatch({ type, params, prompts })
          set({ batchTaskIds: result.taskIds })
          return result.taskIds
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error('Failed to create batch tasks:', message)
          set({ isBatchGenerating: false, retryError: message })
          throw error
        }
      },

      cancelTask: async (taskId) => {
        try {
          await api.generation.cancel(taskId)
        } catch (error) {
          console.error('Failed to cancel task:', error)
        }
        set((state) => {
          const newTasks = state.tasks.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' as const } : t))
          const queueState = deriveQueueState(newTasks)
          return {
            tasks: newTasks,
            isGenerating: queueState.isGenerating,
            activeTaskId: queueState.activeTaskId
          }
        })
      },

      updateTask: (progress) => {
        const prevTask = useGenerationStore.getState().tasks.find((t) => t.id === progress.taskId)
        const wasProcessing = prevTask?.status === 'processing'
        const isNowCompleted = progress.status === 'completed'
        const isNowFailed = progress.status === 'failed'

        // Toast notifications for state transitions
        if (wasProcessing && isNowCompleted) {
          success({
            title: '生成完成',
            description: `任务 #${progress.taskId.slice(0, 8)} 已成功生成`
          })
        } else if (wasProcessing && isNowFailed) {
          toastError({
            title: '生成失败',
            description: progress.message || `任务 #${progress.taskId.slice(0, 8)} 生成失败`,
            timeout: 5000
          })
        }

        set((state) => {
          const exists = state.tasks.find((t) => t.id === progress.taskId)
          let newTasks: GenerationTask[]

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
            // 新任务尚未在列表中，用 progress 数据构造最小任务对象并添加
            const newTask: GenerationTask = {
              id: progress.taskId,
              type: 'image',
              status: progress.status,
              priority: 'normal',
              params: { prompt: '' },
              outputs: progress.outputs || [],
              progress: progress.progress,
              stage: progress.stage,
              error: progress.message,
              createdAt: Date.now()
            }
            newTasks = [newTask, ...state.tasks]
          }

          // Trim memory for old tasks to prevent OOM from base64 accumulation
          const trimmed = trimTaskMemory(newTasks)
          const queueState = deriveQueueState(trimmed)

          return {
            tasks: trimmed,
            isGenerating: queueState.isGenerating,
            activeTaskId: queueState.activeTaskId
          }
        })
      },

      setParams: (partial) => {
        set((state) => ({
          params: { ...state.params, ...partial }
        }))
      },

      resetParams: () => {
        set({ params: { ...defaultParams } })
      },

      getActiveTask: () => {
        const { activeTaskId, tasks } = get()
        return tasks.find((t) => t.id === activeTaskId) || null
      },

      clearRetryError: () => {
        set({ retryError: null, retryCount: 0, isRetrying: false })
      },

      loadHistory: async (limit = 50) => {
        const start = performance.now()
        try {
          const results = await api.db.generations.list({ limit })
          const queryElapsed = performance.now()
          console.log(
            `[GenerationStore] ⏱️ generations.list took ${(queryElapsed - start).toFixed(1)}ms, got ${results.length} results`
          )
          const historyTasks: GenerationTask[] = results.map((result) => {
            let resultUrls: string[]
            try {
              const parsed = typeof result.resultUrls === 'string' ? JSON.parse(result.resultUrls) : result.resultUrls
              resultUrls = Array.isArray(parsed) ? parsed : []
            } catch {
              resultUrls = []
            }
            // Defensive: filter out any data URLs to prevent base64 memory bloat
            const safeUrls = resultUrls.filter((url: string) => typeof url === 'string' && !url.startsWith('data:'))

            return {
              id: result.id,
              type: result.type as GenerationType,
              status: result.status as GenerationTask['status'],
              priority: 'normal',
              params: {
                prompt: result.prompt || '',
                negativePrompt: result.negativePrompt,
                model: result.modelId,
                providerId: result.providerId,
                seed: result.seed,
                width: result.width,
                height: result.height,
                // Strip reference images from history to prevent memory bloat
                referenceImages: undefined,
                referenceWeights: undefined,
                firstFrame: undefined,
                lastFrame: undefined
              } as GenerationParams,
              outputs: safeUrls.map((url: string, i: number) => ({
                id: `${result.id}-${i}`,
                type: result.type as GenerationType,
                base64: undefined, // History tasks never load base64
                url,
                mediaType: 'image/png'
              })),
              error: result.errorMessage,
              progress: result.status === 'completed' ? 100 : 0,
              stage: result.status === 'completed' ? 'completed' : result.status,
              createdAt: new Date(result.createdAt).getTime()
            }
          })
          set((state) => {
            const existingIds = new Set(state.tasks.map((t) => t.id))
            const newTasks = historyTasks.filter((t) => !existingIds.has(t.id))
            const merged = [...state.tasks, ...newTasks]
            // Trim memory for old tasks to prevent OOM
            const trimmed = trimTaskMemory(merged)
            const totalElapsed = performance.now()
            console.log(
              `[GenerationStore] ⏱️ loadHistory total: ${(totalElapsed - start).toFixed(1)}ms (${newTasks.length} new tasks, ${trimmed.length} total, ${merged.length - trimmed.length} trimmed)`
            )
            const queueState = deriveQueueState(trimmed)
            return {
              tasks: trimmed,
              historyLoaded: true,
              isGenerating: queueState.isGenerating,
              activeTaskId: queueState.activeTaskId
            }
          })
        } catch (error) {
          const elapsed = performance.now()
          console.error(`[GenerationStore] ⏱️ loadHistory failed after ${(elapsed - start).toFixed(1)}ms:`, error)
        }
      },

      setDefaultModel: (mode, config) => {
        set((state) => ({
          defaultModels: { ...state.defaultModels, [mode]: config }
        }))
      },

      getDefaultModel: (mode) => {
        return get().defaultModels[mode]
      },

      reset: () => {
        set({ tasks: [] })
      }
    }),
    {
      name: 'cherrystudio-generation-params',
      partialize: (state) => ({
        // Strip referenceImages from persisted params to prevent localStorage bloat
        params: {
          ...state.params,
          referenceImages: undefined,
          referenceWeights: undefined,
          firstFrame: undefined,
          lastFrame: undefined
        },
        defaultModels: state.defaultModels
      })
    }
  )
)

// 注册进度监听
let unsubProgress: (() => void) | null = null
let unsubProgressBatch: (() => void) | null = null

export function initGenerationProgressListener() {
  // Clean up previous listeners to support React strict mode re-mounts
  if (unsubProgress) { unsubProgress(); unsubProgress = null }
  if (unsubProgressBatch) { unsubProgressBatch(); unsubProgressBatch = null }
  // 监听单个进度更新 (兼容旧版)
  unsubProgress = api.generation.onProgress((_event, data) => {
    const progress = data as GenerationProgress
    useGenerationStore.getState().updateTask(progress)
  })
  // 监听批量进度更新 (新版后端使用)
  unsubProgressBatch = api.generation.onProgressBatch((_event, data) => {
    const batch = data as GenerationProgress[]
    const store = useGenerationStore.getState()
    let hasCompleted = false
    for (const progress of batch) {
      store.updateTask(progress)
      if (progress.status === 'completed' || progress.status === 'failed') {
        hasCompleted = true
      }
    }
    // 任务完成后刷新用户额度
    if (hasCompleted) {
      import('@/stores/auth').then(({ useAuthStore }) => {
        useAuthStore.getState().refreshProfile()
      })
    }
  })
}

export function cleanupGenerationProgressListener() {
  unsubProgress?.()
  unsubProgress = null
  unsubProgressBatch?.()
  unsubProgressBatch = null
}
