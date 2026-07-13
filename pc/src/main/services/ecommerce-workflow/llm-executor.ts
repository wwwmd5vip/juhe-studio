import { generateText } from '@cherrystudio/ai-core'

import type {
  StepExecutionResult,
  StepPrompt,
  WorkflowContext,
  WorkflowStepConfig
} from '@shared/ecommerce-workflow/types'
import { errorMessage } from '@shared/utils/error-classifier'

import {
  buildAiCoreSettings,
  checkCapability,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TEMPERATURE,
  mapProviderType,
  resolveProviderConfig
} from './utils'

export async function runLlmStep(
  config: WorkflowStepConfig,
  _context: WorkflowContext,
  _previousOutput: string | undefined,
  prompt: StepPrompt,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  console.log('[LlmExecutor] Starting LLM step', {
    providerId: config.providerId,
    modelId: config.modelId
  })

  checkCapability(config.modelId, 'chat')

  const providerConfig = await resolveProviderConfig(config.providerId)
  const settings = buildAiCoreSettings(providerConfig)
  const providerId = mapProviderType(providerConfig.providerType)

  const systemPrompt = config.systemPrompt || prompt.system

  try {
    console.log('[LlmExecutor] Prompt', {
      system: systemPrompt.slice(0, 300),
      user: prompt.user?.slice(0, 500) ?? ''
    })

    const result = await generateText(providerId as Parameters<typeof generateText>[0], settings as never, {
      model: config.modelId,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt.user }],
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal
    })

    const text = result.text?.trim() || ''
    console.log(`[LlmExecutor] Completed in ${Date.now() - startTime}ms`, {
      providerId: config.providerId,
      modelId: config.modelId,
      outputLength: text.length,
      outputPreview: text.slice(0, 500)
    })
    return { output: text }
  } catch (error) {
    const message = errorMessage(error)
    console.error('[LlmExecutor] LLM step failed', {
      providerId: config.providerId,
      modelId: config.modelId,
      error: message
    })
    throw new Error(`LLM step failed: ${message}`, { cause: error })
  }
}
