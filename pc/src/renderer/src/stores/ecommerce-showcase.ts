import type {
  GenerateImagesInput,
  GeneratePlanInput,
  GenerateSellingPointsInput,
  PlanResult,
  SellingPointsResult,
  ShowcaseTask
} from '@shared/ecommerce-workflow/showcase-types'
import { create } from 'zustand'
import { findUnsafeImageModules } from '@/components/ecommerce-showcase/promptSafety'
import i18n from '@/i18n'

export type ShowcaseStep = 'selling_points' | 'plan' | 'images'

interface DraftState {
  selling_points?: string[]
  plan?: PlanResult
}

interface EcommerceShowcaseState {
  config: Partial<GenerateSellingPointsInput>
  draft: DraftState
  tasks: Record<ShowcaseStep, ShowcaseTask | null>
  currentStep: ShowcaseStep
  loading: Record<ShowcaseStep, boolean>
  error: Record<ShowcaseStep, string | null>
  setConfig: (config: Partial<GenerateSellingPointsInput>) => void
  setDraft: <S extends keyof DraftState>(step: S, value: DraftState[S]) => void
  setCurrentStep: (step: ShowcaseStep) => void
  generateSellingPoints: () => Promise<void>
  generatePlan: () => Promise<void>
  generateImages: () => Promise<void>
  pollTask: (step: ShowcaseStep, taskId: string) => void
  cancelCurrent: () => Promise<void>
  cleanup: () => void
}

const POLL_INTERVAL = 2000
const POLL_TIMEOUT = 5 * 60 * 1000
const REQUEST_TIMEOUT = 15000
const MAX_REQUEST_TIMEOUTS = 3

export const useEcommerceShowcaseStore = create<EcommerceShowcaseState>((set, get) => {
  const pollIntervals = new Map<ShowcaseStep, ReturnType<typeof setTimeout>>()
  const activeTaskIds = new Map<ShowcaseStep, string>()
  const requestTimeoutCounts = new Map<ShowcaseStep, number>()

  const clearPoll = (step: ShowcaseStep) => {
    const timeout = pollIntervals.get(step)
    if (timeout) {
      clearTimeout(timeout)
      pollIntervals.delete(step)
    }
  }

  const cleanup = () => {
    ;[...pollIntervals.keys()].forEach(clearPoll)
    activeTaskIds.clear()
    requestTimeoutCounts.clear()
  }

  const runStep = async <S extends ShowcaseStep>(
    step: S,
    buildInput: () => S extends 'selling_points'
      ? GenerateSellingPointsInput
      : S extends 'plan'
        ? GeneratePlanInput
        : GenerateImagesInput
  ) => {
    const previous = get().tasks[step]
    if (previous && (previous.status === 'pending' || previous.status === 'running')) {
      clearPoll(step)
      activeTaskIds.delete(step)
      try {
        await window.api.showcase.cancelTask(previous.id)
      } catch (error) {
        console.warn('[ShowcaseStore] Failed to cancel previous task:', error)
      }
    }

    set((state) => ({
      tasks: { ...state.tasks, [step]: null },
      loading: { ...state.loading, [step]: true },
      error: { ...state.error, [step]: null }
    }))

    try {
      const input = buildInput()
      const taskId = await (step === 'selling_points'
        ? window.api.showcase.generateSellingPoints(input as GenerateSellingPointsInput)
        : step === 'plan'
          ? window.api.showcase.generatePlan(input as GeneratePlanInput)
          : window.api.showcase.generateImages(input as GenerateImagesInput))
      pollTask(step, taskId)
    } catch (error) {
      set((state) => ({
        loading: { ...state.loading, [step]: false },
        error: { ...state.error, [step]: error instanceof Error ? error.message : String(error) }
      }))
    }
  }

  const pollTask = (step: ShowcaseStep, taskId: string) => {
    clearPoll(step)
    activeTaskIds.set(step, taskId)
    requestTimeoutCounts.set(step, 0)

    const start = Date.now()

    const tick = async () => {
      if (activeTaskIds.get(step) !== taskId) return

      if (Date.now() - start > POLL_TIMEOUT) {
        activeTaskIds.delete(step)
        pollIntervals.delete(step)
        set((state) => ({
          tasks: {
            ...state.tasks,
            [step]: state.tasks[step]
              ? {
                  ...state.tasks[step],
                  status: 'cancelled',
                  errorMsg: i18n.t('ecommerceShowcase.errors.pollingTimeout')
                }
              : null
          },
          loading: { ...state.loading, [step]: false },
          error: { ...state.error, [step]: i18n.t('ecommerceShowcase.errors.pollingTimeout') }
        }))
        try {
          await window.api.showcase.cancelTask(taskId)
        } catch {
          // Intentionally ignore cancellation errors
        }
        return
      }

      try {
        let requestTimeoutId: ReturnType<typeof setTimeout> | undefined
        const task = await Promise.race([
          window.api.showcase.getTask(taskId).finally(() => clearTimeout(requestTimeoutId)),
          new Promise<never>((_, reject) => {
            requestTimeoutId = setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
          })
        ])

        if (activeTaskIds.get(step) !== taskId) return

        requestTimeoutCounts.set(step, 0)

        if (!task) {
          activeTaskIds.delete(step)
          pollIntervals.delete(step)
          requestTimeoutCounts.delete(step)
          set((state) => ({
            loading: { ...state.loading, [step]: false },
            error: { ...state.error, [step]: i18n.t('ecommerceShowcase.errors.taskNotFound') }
          }))
          return
        }

        set((state) => ({
          tasks: { ...state.tasks, [step]: task },
          draft:
            task.result && step !== 'images'
              ? {
                  ...state.draft,
                  [step]: step === 'selling_points' ? (task.result as SellingPointsResult).sellingPoints : task.result
                }
              : state.draft
        }))

        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          activeTaskIds.delete(step)
          pollIntervals.delete(step)
          requestTimeoutCounts.delete(step)
          set((state) => ({
            loading: { ...state.loading, [step]: false }
          }))
          if (task.status === 'failed' || task.status === 'cancelled') {
            const fallbackError = task.errorMsg ?? 'Cancelled'
            set((state) => ({ error: { ...state.error, [step]: fallbackError } }))
            console.error('[ShowcaseStore] Task finished with error:', {
              step,
              taskId,
              status: task.status,
              errorMsg: fallbackError,
              result: task.result
            })
          }
          return
        }

        if (activeTaskIds.get(step) === taskId) {
          const timeoutId = setTimeout(tick, POLL_INTERVAL)
          pollIntervals.set(step, timeoutId)
        }
      } catch (error) {
        if (activeTaskIds.get(step) !== taskId) return
        const message = error instanceof Error ? error.message : String(error)
        if (message === 'Request timeout') {
          const count = (requestTimeoutCounts.get(step) ?? 0) + 1
          requestTimeoutCounts.set(step, count)
          if (count > MAX_REQUEST_TIMEOUTS) {
            activeTaskIds.delete(step)
            pollIntervals.delete(step)
            requestTimeoutCounts.delete(step)
            set((state) => ({
              loading: { ...state.loading, [step]: false },
              error: { ...state.error, [step]: i18n.t('ecommerceShowcase.errors.pollingRequestTimeout') }
            }))
            return
          }
          if (activeTaskIds.get(step) === taskId) {
            const timeoutId = setTimeout(tick, POLL_INTERVAL)
            pollIntervals.set(step, timeoutId)
          }
          return
        }
        activeTaskIds.delete(step)
        pollIntervals.delete(step)
        requestTimeoutCounts.delete(step)
        set((state) => ({
          loading: { ...state.loading, [step]: false },
          error: { ...state.error, [step]: message }
        }))
      }
    }

    tick()
  }

  return {
    config: {},
    draft: {},
    tasks: { selling_points: null, plan: null, images: null },
    currentStep: 'selling_points',
    loading: { selling_points: false, plan: false, images: false },
    error: { selling_points: null, plan: null, images: null },

    setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),

    setDraft: <S extends keyof DraftState>(step: S, value: DraftState[S]) =>
      set((state) => ({
        draft: { ...state.draft, [step]: value }
      })),

    setCurrentStep: (step) => set({ currentStep: step }),

    generateSellingPoints: async () => runStep('selling_points', () => buildSellingPointsInput(get().config)),
    generatePlan: async () => runStep('plan', () => buildPlanInput(get().config, get().draft.selling_points)),
    generateImages: async () => runStep('images', () => buildImagesInput(get().config, get().draft.plan)),

    pollTask,

    cancelCurrent: async () => {
      const { currentStep, tasks } = get()
      const task = tasks[currentStep]
      if (!task || (task.status !== 'pending' && task.status !== 'running')) return

      clearPoll(currentStep)
      activeTaskIds.delete(currentStep)

      const cancelledMessage = i18n.t('ecommerceShowcase.errors.cancelled')
      set((state) => ({
        tasks: {
          ...state.tasks,
          [currentStep]: { ...task, status: 'cancelled', errorMsg: cancelledMessage }
        },
        loading: { ...state.loading, [currentStep]: false },
        error: { ...state.error, [currentStep]: cancelledMessage }
      }))

      try {
        await window.api.showcase.cancelTask(task.id)
        const updated = await window.api.showcase.getTask(task.id)
        if (updated) {
          set((state) => ({
            tasks: { ...state.tasks, [currentStep]: updated },
            loading: { ...state.loading, [currentStep]: false },
            error:
              updated.status === 'failed' || updated.status === 'cancelled'
                ? { ...state.error, [currentStep]: updated.errorMsg ?? i18n.t('ecommerceShowcase.errors.cancelled') }
                : { ...state.error, [currentStep]: null }
          }))
        }
      } catch (error) {
        set((state) => ({
          error: {
            ...state.error,
            [currentStep]: error instanceof Error ? error.message : String(error)
          }
        }))
      }
    },

    cleanup
  }
})

function buildSellingPointsInput(config: Partial<GenerateSellingPointsInput>): GenerateSellingPointsInput {
  if (!config.productImage) throw new Error(i18n.t('ecommerceShowcase.errors.noProductImage'))
  if (!config.platform || !config.market || !config.language) {
    throw new Error(i18n.t('ecommerceShowcase.errors.noPlatformMarketLanguage'))
  }
  if (!config.visionChatProviderId || !config.visionChatModelId) {
    throw new Error(i18n.t('ecommerceShowcase.errors.noVisionModel'))
  }
  return config as GenerateSellingPointsInput
}

function buildPlanInput(config: Partial<GenerateSellingPointsInput>, sellingPoints?: string[]): GeneratePlanInput {
  if (!sellingPoints || sellingPoints.length === 0) {
    throw new Error(i18n.t('ecommerceShowcase.errors.noSellingPoints'))
  }
  return { ...buildSellingPointsInput(config), sellingPoints }
}

function buildImagesInput(config: Partial<GenerateSellingPointsInput>, plan?: PlanResult): GenerateImagesInput {
  if (!plan) throw new Error(i18n.t('ecommerceShowcase.errors.noPlan'))
  const unsafeModules = findUnsafeImageModules(plan)
  if (unsafeModules.length > 0) {
    throw new Error(
      i18n.t('ecommerceShowcase.errors.unsafeImageModules', {
        modules: unsafeModules.map((module) => module.title).join('、')
      })
    )
  }
  if (!config.imageProviderId || !config.imageModelId) {
    throw new Error(i18n.t('ecommerceShowcase.errors.noImageModel'))
  }
  return {
    ...buildSellingPointsInput(config),
    plan,
    imageProviderId: config.imageProviderId,
    imageModelId: config.imageModelId
  }
}
