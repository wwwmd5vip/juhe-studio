import type { WorkflowModule } from '@shared/ecommerce-workflow/types'
import type { GenerationParams, TaskPriority } from '@shared/types/generation'
import { errorMessage } from '@shared/utils/error-classifier'

import { createRoutedGenerationTask } from '../generation-router'

export interface ModuleSubmission {
  moduleId: string
  taskId: string
}

export interface SubmitModulesOptions {
  workflowId: string
  modules: WorkflowModule[]
  referenceImage?: string
  referenceMode?: 'fusion' | 'controlnet' | 'ipadapter'
  priority?: TaskPriority
}

export async function submitEcommerceModules(options: SubmitModulesOptions): Promise<ModuleSubmission[]> {
  const startTime = Date.now()
  const { workflowId, modules, referenceImage, referenceMode = 'fusion', priority = 'normal' } = options

  console.log('[SubmitExecutor] Submitting ecommerce modules', {
    workflowId,
    totalModules: modules.length,
    enabledModules: modules.filter((m) => m.enabled).length
  })

  const submissions: ModuleSubmission[] = []

  for (const module of modules) {
    if (!module.enabled) {
      console.log('[SubmitExecutor] Skipping disabled module', { moduleId: module.moduleId })
      continue
    }

    if (!module.providerId || !module.modelId) {
      console.warn('[SubmitExecutor] Module missing provider or model, skipping', {
        moduleId: module.moduleId,
        providerId: module.providerId,
        modelId: module.modelId
      })
      continue
    }

    const params: GenerationParams = {
      prompt: module.imagePrompt,
      providerId: module.providerId,
      model: module.modelId,
      size: module.size,
      style: module.style,
      n: 1,
      seed: module.seed,
      ...(referenceImage ? { referenceImages: [referenceImage], referenceMode } : {})
    }

    try {
      const task = await createRoutedGenerationTask(params, priority)
      submissions.push({ moduleId: module.moduleId, taskId: task.id })
      console.log('[SubmitExecutor] Enqueued module', {
        workflowId,
        moduleId: module.moduleId,
        taskId: task.id,
        type: task.type
      })
    } catch (error) {
      const message = errorMessage(error)
      console.error('[SubmitExecutor] Failed to enqueue module', {
        workflowId,
        moduleId: module.moduleId,
        error: message
      })
      throw new Error(`Failed to submit module ${module.moduleId}: ${message}`, { cause: error })
    }
  }

  console.log(`[SubmitExecutor] Completed in ${Date.now() - startTime}ms`, {
    workflowId,
    submittedCount: submissions.length
  })

  return submissions
}
