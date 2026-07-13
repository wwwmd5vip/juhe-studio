/**
 * 电商固定工作流状态管理 (Zustand)
 */

import type { Platform } from '@shared/ecommerce-workflow/enums'
import { getDefaultAspectRatio } from '@shared/ecommerce-workflow/platform-ratio'
import { getWorkflowTemplate } from '@shared/ecommerce-workflow/templates'
import type {
  EcommerceWorkflow,
  WorkflowContext,
  WorkflowModule,
  WorkflowStepConfig,
  WorkflowTemplate
} from '@shared/ecommerce-workflow/types'
import { create } from 'zustand'
import i18n from '@/i18n'

const api = window.api

interface TemplateSummary {
  id: string
  category: string
  nameI18nKey: string
  descriptionI18nKey: string
  defaultContext: Partial<EcommerceWorkflow['context']>
}

interface EcommerceWorkflowState {
  // === 数据 ===
  templates: TemplateSummary[]
  workflows: EcommerceWorkflow[]
  currentWorkflow: EcommerceWorkflow | null

  // === UI/运行状态 ===
  isLoading: boolean
  error: string | null
  runningStepId: string | null
  runningRequestId: string | null
  streamText: Record<string, string>
  streamModules: Record<string, WorkflowModule[]>
  streamProgress: Record<string, number>

  // === Actions ===
  loadTemplates: () => Promise<void>
  loadWorkflows: () => Promise<void>
  createWorkflow: (templateId: string, name?: string) => Promise<EcommerceWorkflow | null>
  loadWorkflow: (id: string) => Promise<EcommerceWorkflow | null>
  updateWorkflow: (id: string, data: Partial<EcommerceWorkflow>) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  setCurrentWorkflow: (workflow: EcommerceWorkflow | null) => void
  updateCurrentContext: (context: Partial<EcommerceWorkflow['context']>) => void
  updateCurrentStepConfig: (stepId: string, config: WorkflowStepConfig) => void
  updateCurrentModules: (modules: WorkflowModule[]) => void
  saveProductImage: (dataUrl: string, fileName?: string) => Promise<string | null>
  runStep: (stepId: string, config: WorkflowStepConfig) => Promise<void>
  runAgent: () => Promise<void>
  cancelStep: () => Promise<void>
  submitModules: (referenceImage?: string, referenceMode?: 'fusion' | 'controlnet' | 'ipadapter') => Promise<void>
  clearStream: (stepId: string) => void
  clearError: () => void
  confirmModuleConfig: (stepId: string, selectedModuleTypes: string[]) => Promise<void>
  updatePlatformRatio: (platform: Platform) => Promise<void>
}

function getDownstreamStepIds(template: WorkflowTemplate, stepId: string): string[] {
  const graph = new Map<string, string[]>()
  for (const step of template.steps) {
    for (const dep of step.dependencies) {
      if (!graph.has(dep)) graph.set(dep, [])
      graph.get(dep)?.push(step.id)
    }
  }

  const result = new Set<string>()
  const queue = [stepId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    for (const child of graph.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child)
        queue.push(child)
      }
    }
  }
  return Array.from(result)
}

export const useEcommerceWorkflowStore = create<EcommerceWorkflowState>()((set, get) => {
  // 注册流式事件监听
  api.ecommerceWorkflow.onStream((_, event) => {
    const { stepId } = event
    set((state) => {
      const next: Partial<EcommerceWorkflowState> = {}

      if (event.type === 'text-delta') {
        next.streamText = {
          ...state.streamText,
          [stepId]: (state.streamText[stepId] ?? '') + (event.textDelta ?? '')
        }
      }

      if (event.type === 'module-delta' && event.moduleDelta) {
        const existing = state.streamModules[stepId] ?? []
        const foundIndex = existing.findIndex((m) => m.moduleId === event.moduleDelta?.moduleId)
        const updated =
          foundIndex >= 0
            ? existing.map((m, i) => (i === foundIndex ? { ...m, ...event.moduleDelta } : m))
            : [...existing, event.moduleDelta as WorkflowModule]
        next.streamModules = { ...state.streamModules, [stepId]: updated }
      }

      if (event.type === 'progress' && event.progress !== undefined) {
        next.streamProgress = { ...state.streamProgress, [stepId]: event.progress }
      }

      if (event.type === 'done') {
        next.streamProgress = { ...state.streamProgress, [stepId]: 100 }
        next.runningStepId = null
        next.runningRequestId = null
      }

      if (event.type === 'error') {
        next.error = event.error ?? i18n.t('ecommerceWorkflow.errors.streamError')
        next.runningStepId = null
        next.runningRequestId = null
      }

      return next
    })
  })

  return {
    templates: [],
    workflows: [],
    currentWorkflow: null,
    isLoading: false,
    error: null,
    runningStepId: null,
    runningRequestId: null,
    streamText: {},
    streamModules: {},
    streamProgress: {},

    loadTemplates: async () => {
      set({ isLoading: true, error: null })
      try {
        const templates = await api.ecommerceWorkflow.templates.list()
        set({ templates, isLoading: false })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message, isLoading: false })
      }
    },

    loadWorkflows: async () => {
      set({ isLoading: true, error: null })
      try {
        const workflows = await api.ecommerceWorkflow.list()
        set({ workflows, isLoading: false })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message, isLoading: false })
      }
    },

    createWorkflow: async (templateId, name) => {
      set({ isLoading: true, error: null })
      try {
        const workflow = await api.ecommerceWorkflow.create({ templateId, name })
        set((state) => ({
          workflows: [workflow, ...state.workflows],
          currentWorkflow: workflow,
          isLoading: false
        }))
        return workflow
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message, isLoading: false })
        return null
      }
    },

    loadWorkflow: async (id) => {
      set({ isLoading: true, error: null })
      try {
        const workflow = await api.ecommerceWorkflow.get(id)
        set({ currentWorkflow: workflow, isLoading: false })
        return workflow
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message, isLoading: false })
        return null
      }
    },

    updateWorkflow: async (id, data) => {
      try {
        await api.ecommerceWorkflow.update(id, data)
        set((state) => {
          const workflows = state.workflows.map((w) => (w.id === id ? { ...w, ...data } : w))
          const currentWorkflow =
            state.currentWorkflow?.id === id ? { ...state.currentWorkflow, ...data } : state.currentWorkflow
          return { workflows, currentWorkflow }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message })
      }
    },

    deleteWorkflow: async (id) => {
      try {
        await api.ecommerceWorkflow.delete(id)
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message })
      }
    },

    setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),

    updateCurrentContext: (context) => {
      set((state) => {
        if (!state.currentWorkflow) return state
        const updated = {
          ...state.currentWorkflow,
          context: { ...state.currentWorkflow.context, ...context }
        }
        return { currentWorkflow: updated }
      })
    },

    updateCurrentStepConfig: (stepId, config) => {
      set((state) => {
        if (!state.currentWorkflow) return state
        const steps = state.currentWorkflow.steps.map((s) => (s.id === stepId ? { ...s, config } : s))
        return { currentWorkflow: { ...state.currentWorkflow, steps } }
      })
    },

    updateCurrentModules: (modules) => {
      set((state) => {
        if (!state.currentWorkflow) return state
        return { currentWorkflow: { ...state.currentWorkflow, modules } }
      })
    },

    saveProductImage: async (dataUrl, fileName) => {
      try {
        return await api.ecommerceWorkflow.saveImage({ dataUrl, fileName })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message })
        return null
      }
    },

    runStep: async (stepId, config) => {
      if (get().runningStepId) {
        set({ error: i18n.t('ecommerceWorkflow.errors.stepAlreadyRunning') })
        return
      }

      const workflow = get().currentWorkflow
      if (!workflow) return

      const template = getWorkflowTemplate(workflow.templateId)
      const downstreamIds = getDownstreamStepIds(template, stepId)
      const resetStepIds = new Set([stepId, ...downstreamIds])

      const nextStreamText = { ...get().streamText }
      const nextStreamModules = { ...get().streamModules }
      const nextStreamProgress = { ...get().streamProgress }
      const streamIdsToClear = [stepId, ...downstreamIds]
      for (const id of streamIdsToClear) {
        delete nextStreamText[id]
        delete nextStreamModules[id]
        delete nextStreamProgress[id]
      }

      const resetSteps = workflow.steps.map((s) =>
        resetStepIds.has(s.id)
          ? { ...s, status: 'idle' as const, output: undefined, error: undefined, streamOutput: undefined }
          : s
      )
      const resetOutputs = { ...workflow.context.outputs }
      for (const id of resetStepIds) {
        delete resetOutputs[id]
      }
      const resetContext: WorkflowContext = {
        ...workflow.context,
        outputs: resetOutputs,
        selectedModuleTypes: ['module-recommend', 'vision', 'copy'].includes(stepId)
          ? []
          : workflow.context.selectedModuleTypes
      }

      try {
        await api.ecommerceWorkflow.update(workflow.id, {
          context: resetContext,
          steps: resetSteps,
          modules: []
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message })
        return
      }

      set((state) => ({
        currentWorkflow: state.currentWorkflow
          ? { ...state.currentWorkflow, context: resetContext, steps: resetSteps, modules: [] }
          : state.currentWorkflow,
        streamText: { ...nextStreamText, [stepId]: '' },
        streamModules: { ...nextStreamModules, [stepId]: [] },
        streamProgress: { ...nextStreamProgress, [stepId]: 0 },
        error: null
      }))

      const requestId = crypto.randomUUID()
      set({
        runningStepId: stepId,
        runningRequestId: requestId,
        streamText: { ...nextStreamText, [stepId]: '' },
        streamModules: { ...nextStreamModules, [stepId]: [] },
        streamProgress: { ...nextStreamProgress, [stepId]: 0 }
      })

      try {
        const result = await api.ecommerceWorkflow.runStep({
          workflowId: workflow.id,
          stepId,
          config,
          requestId
        })

        set((state) => {
          if (!state.currentWorkflow) return state
          const steps = state.currentWorkflow.steps.map((s) =>
            s.id === stepId ? { ...s, output: result.output, status: 'success' as const, error: undefined } : s
          )
          const context = result.context
            ? { ...state.currentWorkflow.context, ...result.context }
            : state.currentWorkflow.context
          return {
            currentWorkflow: {
              ...state.currentWorkflow,
              steps,
              modules: result.modules ?? state.currentWorkflow.modules,
              context,
              status: state.currentWorkflow.status === 'draft' ? 'running' : state.currentWorkflow.status
            },
            runningStepId: null,
            runningRequestId: null
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set((state) => {
          if (!state.currentWorkflow) return { error: message, runningStepId: null, runningRequestId: null }
          const steps = state.currentWorkflow.steps.map((s) =>
            s.id === stepId ? { ...s, status: 'error' as const, error: message } : s
          )
          return {
            currentWorkflow: { ...state.currentWorkflow, steps, status: 'error' as const },
            error: message,
            runningStepId: null,
            runningRequestId: null
          }
        })
      }
    },

    runAgent: async () => {
      const workflow = get().currentWorkflow
      if (!workflow) return

      const visionStep = workflow.steps.find((s) => s.id === 'agent-vision')
      const generateStep = workflow.steps.find((s) => s.id === 'agent-generate')
      if (!visionStep?.config?.providerId || !generateStep?.config?.providerId) {
        set({ error: i18n.t('ecommerceWorkflow.errors.selectModels') })
        return
      }
      if (!workflow.context.productImage) {
        set({ error: i18n.t('ecommerceWorkflow.errors.uploadProductImage') })
        return
      }

      // 清空旧结果
      await get().updateCurrentContext({
        agentVisionPrompts: undefined,
        agentGeneratedImages: undefined
      })

      try {
        set({ error: null })
        await get().runStep('agent-vision', visionStep.config)

        const afterVision = get().currentWorkflow
        const prompts = afterVision?.context.agentVisionPrompts
        if (!prompts || prompts.length === 0) {
          set({ error: i18n.t('ecommerceWorkflow.errors.noPrompts') })
          return
        }

        await get().runStep('agent-generate', generateStep.config)

        const afterGenerate = get().currentWorkflow
        if (afterGenerate) {
          await get().updateWorkflow(afterGenerate.id, { status: 'completed' })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message })
        const currentWorkflow = get().currentWorkflow
        if (currentWorkflow) {
          await get().updateWorkflow(currentWorkflow.id, { status: 'error' })
        }
      }
    },

    cancelStep: async () => {
      const requestId = get().runningRequestId
      if (!requestId) return
      await api.ecommerceWorkflow.cancelStep(requestId)
      set({ runningStepId: null, runningRequestId: null })
    },

    confirmModuleConfig: async (stepId, selectedModuleTypes) => {
      const workflow = get().currentWorkflow
      if (!workflow) return

      const template = getWorkflowTemplate(workflow.templateId)
      const downstreamIds = getDownstreamStepIds(template, stepId)
      const resetStepIds = new Set(downstreamIds)

      const previousContext = workflow.context
      const previousSteps = workflow.steps
      const previousModules = workflow.modules
      const previousStreamText = { ...get().streamText }
      const previousStreamModules = { ...get().streamModules }
      const previousStreamProgress = { ...get().streamProgress }

      const runningStepId = get().runningStepId
      const runningRequestId = get().runningRequestId
      const shouldCancelRunning =
        runningRequestId !== null && runningStepId !== null && downstreamIds.includes(runningStepId)
      if (shouldCancelRunning) {
        try {
          await api.ecommerceWorkflow.cancelStep(runningRequestId)
        } catch (cancelError) {
          console.warn('[confirmModuleConfig] failed to cancel running downstream step:', cancelError)
        }
      }

      const updatedSteps = workflow.steps.map((s) => {
        if (s.id === stepId) {
          return {
            ...s,
            status: 'success' as const,
            output: JSON.stringify(selectedModuleTypes),
            error: undefined,
            streamOutput: undefined
          }
        }
        if (resetStepIds.has(s.id)) {
          return { ...s, status: 'idle' as const, output: undefined, error: undefined, streamOutput: undefined }
        }
        return s
      })
      const outputs = { ...workflow.context.outputs, [stepId]: JSON.stringify(selectedModuleTypes) }
      for (const id of downstreamIds) {
        delete outputs[id]
      }
      const context: WorkflowContext = { ...workflow.context, selectedModuleTypes, outputs }

      const nextStreamText = { ...previousStreamText }
      const nextStreamModules = { ...previousStreamModules }
      const nextStreamProgress = { ...previousStreamProgress }
      for (const id of downstreamIds) {
        delete nextStreamText[id]
        delete nextStreamModules[id]
        delete nextStreamProgress[id]
      }

      try {
        await api.ecommerceWorkflow.update(workflow.id, { context, steps: updatedSteps, modules: [] })
        set((state) => ({
          currentWorkflow: state.currentWorkflow
            ? { ...state.currentWorkflow, context, steps: updatedSteps, modules: [] }
            : state.currentWorkflow,
          error: null,
          streamText: nextStreamText,
          streamModules: nextStreamModules,
          streamProgress: nextStreamProgress,
          ...(shouldCancelRunning ? { runningStepId: null, runningRequestId: null } : {})
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set((state) => ({
          currentWorkflow: state.currentWorkflow
            ? { ...state.currentWorkflow, context: previousContext, steps: previousSteps, modules: previousModules }
            : state.currentWorkflow,
          error: message,
          streamText: previousStreamText,
          streamModules: previousStreamModules,
          streamProgress: previousStreamProgress,
          ...(shouldCancelRunning ? { runningStepId: null, runningRequestId: null } : {})
        }))
      }
    },

    updatePlatformRatio: async (platform) => {
      const workflow = get().currentWorkflow
      if (!workflow || workflow.templateId !== 'product-detail-page') return

      const affectedStepIds = ['copy', 'module-recommend', 'module-config', 'module-generate', 'review', 'result']
      const previousContext = workflow.context
      const previousSteps = workflow.steps
      const previousModules = workflow.modules
      const previousStreamText = { ...get().streamText }
      const previousStreamModules = { ...get().streamModules }
      const previousStreamProgress = { ...get().streamProgress }

      const runningStepId = get().runningStepId
      const runningRequestId = get().runningRequestId
      const shouldCancelRunning =
        runningRequestId !== null && ['copy', 'module-recommend', 'module-generate'].includes(runningStepId ?? '')
      if (shouldCancelRunning) {
        try {
          await api.ecommerceWorkflow.cancelStep(runningRequestId)
        } catch (cancelError) {
          console.warn('[updatePlatformRatio] failed to cancel running step:', cancelError)
        }
      }

      const resetSteps = workflow.steps.map((s) =>
        affectedStepIds.includes(s.id)
          ? { ...s, status: 'idle' as const, output: undefined, error: undefined, streamOutput: undefined }
          : s
      )
      const outputs = { ...workflow.context.outputs }
      for (const id of affectedStepIds) {
        delete outputs[id]
      }

      const ratio = workflow.context.ratioManuallySet ? workflow.context.ratio : getDefaultAspectRatio(platform)
      const context: WorkflowContext = {
        ...workflow.context,
        platform,
        ratio,
        selectedModuleTypes: [],
        outputs
      }

      const nextStreamText = { ...previousStreamText }
      const nextStreamModules = { ...previousStreamModules }
      const nextStreamProgress = { ...previousStreamProgress }
      for (const id of affectedStepIds) {
        delete nextStreamText[id]
        delete nextStreamModules[id]
        delete nextStreamProgress[id]
      }

      try {
        await api.ecommerceWorkflow.update(workflow.id, { context, steps: resetSteps, modules: [] })
        set((state) => ({
          currentWorkflow: state.currentWorkflow
            ? { ...state.currentWorkflow, context, steps: resetSteps, modules: [] }
            : state.currentWorkflow,
          error: null,
          streamText: nextStreamText,
          streamModules: nextStreamModules,
          streamProgress: nextStreamProgress,
          ...(shouldCancelRunning ? { runningStepId: null, runningRequestId: null } : {})
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set((state) => ({
          currentWorkflow: state.currentWorkflow
            ? { ...state.currentWorkflow, context: previousContext, steps: previousSteps, modules: previousModules }
            : state.currentWorkflow,
          error: message,
          streamText: previousStreamText,
          streamModules: previousStreamModules,
          streamProgress: previousStreamProgress,
          ...(shouldCancelRunning ? { runningStepId: null, runningRequestId: null } : {})
        }))
      }
    },

    submitModules: async (referenceImage, referenceMode) => {
      const workflow = get().currentWorkflow
      if (!workflow) return

      set({ isLoading: true, error: null })
      try {
        const result = await api.ecommerceWorkflow.submitModules({
          workflowId: workflow.id,
          modules: workflow.modules,
          referenceImage,
          referenceMode
        })
        set((state) => {
          if (!state.currentWorkflow) return state
          return {
            currentWorkflow: { ...state.currentWorkflow, modules: result.modules },
            isLoading: false
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        set({ error: message, isLoading: false })
      }
    },

    clearStream: (stepId) => {
      set((state) => {
        const streamText = { ...state.streamText }
        const streamModules = { ...state.streamModules }
        const streamProgress = { ...state.streamProgress }
        delete streamText[stepId]
        delete streamModules[stepId]
        delete streamProgress[stepId]
        return { streamText, streamModules, streamProgress }
      })
    },

    clearError: () => set({ error: null })
  }
})
