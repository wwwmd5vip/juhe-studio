import { randomUUID } from 'node:crypto'

import { streamText } from '@cherrystudio/ai-core'
import { normalizeModuleId } from '@shared/ecommerce-workflow/module-types'
import type {
  StepExecutionResult,
  StepPrompt,
  WorkflowContext,
  WorkflowModule,
  WorkflowStepConfig
} from '@shared/ecommerce-workflow/types'
import type { ImageStyle } from '@shared/types/generation'
import { errorMessage } from '@shared/utils/error-classifier'
import { z } from 'zod'

import { pushWorkflowStreamEvent } from './stream-events'
import {
  aspectRatioToImageSize,
  buildAiCoreSettings,
  checkCapability,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TEMPERATURE,
  mapProviderType,
  resolveProviderConfig
} from './utils'

const RawModuleSchema = z.object({
  module_id: z.string().min(1),
  module_name: z.string().min(1),
  image_prompt: z.string(),
  copy_requirements: z.string()
})

function extractJsonArray(raw: string): string {
  const cleaned = raw
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .trim()

  const match = cleaned.match(/\[[\s\S]*\]/)
  if (match) return match[0]
  return cleaned
}

export function parseModules(raw: string, config: WorkflowStepConfig, ratio?: string): WorkflowModule[] {
  const jsonText = extractJsonArray(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    const message = errorMessage(err)
    throw new Error(`Failed to parse module JSON: ${message}`, { cause: err })
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Module generate output is not a JSON array')
  }

  const size = aspectRatioToImageSize(ratio)
  const style: ImageStyle = 'photographic'

  return parsed.map((item, index) => {
    const validated = RawModuleSchema.safeParse(item)
    if (!validated.success) {
      throw new Error(`Module item ${index} is invalid: ${validated.error.message}`)
    }
    const data = validated.data
    return {
      id: randomUUID(),
      moduleId: data.module_id || `module_${index + 1}`,
      moduleName: data.module_name || `Module ${index + 1}`,
      imagePrompt: data.image_prompt,
      copyRequirements: data.copy_requirements,
      providerId: config.providerId,
      modelId: config.modelId,
      size,
      style,
      enabled: true,
      status: 'draft' as const
    }
  })
}

export async function runModuleGenerateStep(
  config: WorkflowStepConfig,
  context: WorkflowContext,
  _previousOutput: string | undefined,
  prompt: StepPrompt,
  workflowId: string,
  stepId: string,
  requestId: string,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  console.log('[ModuleGenerateExecutor] Starting module generate step', {
    providerId: config.providerId,
    modelId: config.modelId,
    workflowId,
    stepId,
    requestId,
    selectedModuleTypes: context.selectedModuleTypes
  })

  if (!context.selectedModuleTypes || context.selectedModuleTypes.length === 0) {
    pushWorkflowStreamEvent({
      workflowId,
      stepId,
      requestId,
      type: 'done',
      output: '',
      progress: 100,
      modules: []
    })
    return { output: '', modules: [] }
  }

  checkCapability(config.modelId, 'chat')

  const providerConfig = await resolveProviderConfig(config.providerId)
  const settings = buildAiCoreSettings(providerConfig)
  const providerId = mapProviderType(providerConfig.providerType)

  const systemPrompt = config.systemPrompt || prompt.system

  pushWorkflowStreamEvent({
    workflowId,
    stepId,
    requestId,
    type: 'progress',
    progress: 0
  })

  try {
    console.log('[ModuleGenerateExecutor] Prompt', {
      system: systemPrompt.slice(0, 300),
      user: prompt.user?.slice(0, 500) ?? ''
    })

    const result = await streamText(providerId as Parameters<typeof streamText>[0], settings as never, {
      model: config.modelId,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt.user }],
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal
    })

    const textChunks: string[] = []

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        textChunks.push(chunk.text)
        pushWorkflowStreamEvent({
          workflowId,
          stepId,
          requestId,
          type: 'text-delta',
          textDelta: chunk.text
        })
      } else if (chunk.type === 'error') {
        const errorChunk = chunk as unknown as { error: Error }
        throw errorChunk.error
      } else {
        console.log('[ModuleGenerateExecutor] Ignoring non-text stream chunk', {
          workflowId,
          stepId,
          requestId,
          chunkType: chunk.type
        })
      }
    }

    // Consume stream to catch delayed errors (e.g. RetryError)
    try {
      await result.consumeStream()
    } catch (consumeError) {
      console.error('[ModuleGenerateExecutor] Delayed stream error:', consumeError)
      throw consumeError
    }

    const raw = textChunks.join('').trim()

    pushWorkflowStreamEvent({
      workflowId,
      stepId,
      requestId,
      type: 'progress',
      progress: 80
    })

    const parsedModules = parseModules(raw, config, context.ratio)

    const selectedSet = new Set(context.selectedModuleTypes.map(normalizeModuleId))
    const seen = new Set<string>()
    const modules = parsedModules
      .filter((module) => selectedSet.has(normalizeModuleId(module.moduleId)))
      .filter((module) => {
        const normalized = normalizeModuleId(module.moduleId)
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })

    for (const module of modules) {
      pushWorkflowStreamEvent({
        workflowId,
        stepId,
        requestId,
        type: 'module-delta',
        moduleDelta: module
      })
    }

    const output = JSON.stringify(modules)

    pushWorkflowStreamEvent({
      workflowId,
      stepId,
      requestId,
      type: 'done',
      output,
      progress: 100,
      modules
    })

    console.log(`[ModuleGenerateExecutor] Completed in ${Date.now() - startTime}ms`, {
      providerId: config.providerId,
      modelId: config.modelId,
      moduleCount: modules.length,
      outputPreview: output.slice(0, 500),
      modules: modules.map((m) => ({ moduleId: m.moduleId, moduleName: m.moduleName }))
    })

    return { output, modules }
  } catch (error) {
    const message = errorMessage(error)
    console.error('[ModuleGenerateExecutor] Module generate step failed', {
      workflowId,
      stepId,
      requestId,
      providerId: config.providerId,
      modelId: config.modelId,
      error: message
    })
    pushWorkflowStreamEvent({
      workflowId,
      stepId,
      requestId,
      type: 'error',
      error: message
    })
    throw new Error(`Module generate step failed: ${message}`, { cause: error })
  }
}
