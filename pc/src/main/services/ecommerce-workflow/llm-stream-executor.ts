import { streamText } from '@cherrystudio/ai-core'

import { consumeStream } from '../../services/ai-stream'
import type {
  StepExecutionResult,
  StepPrompt,
  WorkflowContext,
  WorkflowStepConfig
} from '@shared/ecommerce-workflow/types'
import { errorMessage } from '@shared/utils/error-classifier'

import { pushWorkflowStreamEvent } from './stream-events'
import {
  buildAiCoreSettings,
  checkCapability,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TEMPERATURE,
  mapProviderType,
  resolveProviderConfig
} from './utils'

export async function runLlmStreamStep(
  config: WorkflowStepConfig,
  _context: WorkflowContext,
  _previousOutput: string | undefined,
  prompt: StepPrompt,
  workflowId: string,
  stepId: string,
  requestId: string,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  console.log('[LlmStreamExecutor] Starting LLM stream step', {
    providerId: config.providerId,
    modelId: config.modelId,
    workflowId,
    stepId,
    requestId
  })

  checkCapability(config.modelId, 'chat')

  const providerConfig = await resolveProviderConfig(config.providerId)
  const settings = buildAiCoreSettings(providerConfig)
  const providerId = mapProviderType(providerConfig.providerType)

  const systemPrompt = config.systemPrompt || prompt.system

  try {
    console.log('[LlmStreamExecutor] Prompt', {
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

    await consumeStream(result as unknown as Parameters<typeof consumeStream>[0], {
      onText: (delta) => {
        textChunks.push(delta)
        pushWorkflowStreamEvent({
          workflowId,
          stepId,
          requestId,
          type: 'text-delta',
          textDelta: delta
        })
      },
      onError: (error) => {
        throw error
      }
    })

    const fullText = textChunks.join('')

    pushWorkflowStreamEvent({
      workflowId,
      stepId,
      requestId,
      type: 'done',
      output: fullText.trim()
    })

    console.log(`[LlmStreamExecutor] Completed in ${Date.now() - startTime}ms`, {
      providerId: config.providerId,
      modelId: config.modelId,
      outputLength: fullText.length,
      outputPreview: fullText.trim().slice(0, 500)
    })

    return { output: fullText.trim() }
  } catch (error) {
    const message = errorMessage(error)
    console.error('[LlmStreamExecutor] LLM stream step failed', {
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
    throw new Error(`LLM stream step failed: ${message}`, { cause: error })
  }
}
