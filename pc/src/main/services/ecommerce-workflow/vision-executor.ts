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
  type ContentPart,
  checkCapability,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TEMPERATURE,
  filePathToBase64DataUrl,
  mapProviderType,
  resolveProviderConfig
} from './utils'

export async function runVisionStep(
  config: WorkflowStepConfig,
  context: WorkflowContext,
  prompt: StepPrompt,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  console.log('[VisionExecutor] Starting vision step', {
    providerId: config.providerId,
    modelId: config.modelId,
    hasProductImage: !!context.productImage
  })

  checkCapability(config.modelId, 'vision')

  const providerConfig = await resolveProviderConfig(config.providerId)
  const settings = buildAiCoreSettings(providerConfig)
  const providerId = mapProviderType(providerConfig.providerType)

  const contentParts: ContentPart[] = []

  if (prompt.user) {
    contentParts.push({ type: 'text', text: prompt.user })
  }

  if (context.productImage) {
    const dataUrl = await filePathToBase64DataUrl(context.productImage)
    const mimeTypeMatch = dataUrl.match(/data:([^;]+);/)
    contentParts.push({
      type: 'image',
      image: dataUrl,
      ...(mimeTypeMatch ? { mimeType: mimeTypeMatch[1] } : {})
    })
  }

  if (contentParts.length === 0) {
    throw new Error('[VisionExecutor] Cannot call vision model with empty user content')
  }

  try {
    const systemPrompt = config.systemPrompt || prompt.system
    console.log('[VisionExecutor] Prompt', {
      system: systemPrompt.slice(0, 300),
      user: prompt.user?.slice(0, 500) ?? ''
    })

    const result = await generateText(providerId as Parameters<typeof generateText>[0], settings as never, {
      model: config.modelId,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentParts as never }],
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal
    })

    const text = result.text?.trim() || ''
    console.log(`[VisionExecutor] Completed in ${Date.now() - startTime}ms`, {
      providerId: config.providerId,
      modelId: config.modelId,
      outputLength: text.length,
      outputPreview: text.slice(0, 500)
    })
    return { output: text }
  } catch (error) {
    const message = errorMessage(error)
    console.error('[VisionExecutor] Vision step failed', {
      providerId: config.providerId,
      modelId: config.modelId,
      error: message
    })
    throw new Error(`Vision step failed: ${message}`, { cause: error })
  }
}
