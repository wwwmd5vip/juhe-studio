// src/main/services/ecommerce-workflow/agent-vision-executor.ts
import { generateText } from '@cherrystudio/ai-core'
import {
  AGENT_VISION_COUNT_INSTRUCTION_TEMPLATE,
  AGENT_VISION_PREVIEW_LENGTH,
  DEFAULT_AGENT_IMAGE_COUNT,
  DEFAULT_AGENT_PROMPT_ID
} from '@shared/ecommerce-workflow/constants'
import { AGENT_PROMPTS } from '@shared/ecommerce-workflow/prompts/agent-prompts'
import type { StepExecutionResult, WorkflowContext, WorkflowStepConfig } from '@shared/ecommerce-workflow/types'
import { errorMessage } from '@shared/utils/error-classifier'

import { parsePosterPrompts } from './agent-prompt-parser'
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

export async function runAgentVisionStep(
  config: WorkflowStepConfig,
  context: WorkflowContext,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  const promptId = context.agentPromptId ?? DEFAULT_AGENT_PROMPT_ID
  const imageCount = context.imageCount ?? DEFAULT_AGENT_IMAGE_COUNT

  const agent = AGENT_PROMPTS[promptId]
  if (!agent) {
    console.warn('[AgentVisionExecutor] Agent prompt not found', { promptId })
    throw new Error(`Agent prompt "${promptId}" not found`)
  }

  checkCapability(config.modelId, 'vision')

  let systemPrompt = agent.prompt
  if (systemPrompt.includes('{{imageCount}}')) {
    systemPrompt = systemPrompt.replace(/{{imageCount}}/g, String(imageCount))
  } else {
    systemPrompt += `\n\n重要：忽略前文中的具体数量描述，${AGENT_VISION_COUNT_INSTRUCTION_TEMPLATE.replace(
      /{{imageCount}}/g,
      String(imageCount)
    )}`
  }

  const providerConfig = await resolveProviderConfig(config.providerId)
  const settings = buildAiCoreSettings(providerConfig)
  const providerId = mapProviderType(providerConfig.providerType)

  const contentParts: ContentPart[] = []
  if (context.productText) {
    contentParts.push({ type: 'text', text: context.productText })
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
    console.warn('[AgentVisionExecutor] Cannot call vision model with empty content', {
      promptId,
      hasProductText: !!context.productText,
      hasProductImage: !!context.productImage
    })
    throw new Error('[AgentVisionExecutor] Cannot call vision model with empty content')
  }

  console.log('[AgentVisionExecutor] Starting vision step', {
    providerId: config.providerId,
    modelId: config.modelId,
    promptId,
    imageCount,
    hasProductText: !!context.productText,
    hasProductImage: !!context.productImage,
    systemPreview: systemPrompt.slice(0, AGENT_VISION_PREVIEW_LENGTH)
  })

  try {
    const result = await generateText(providerId as Parameters<typeof generateText>[0], settings as never, {
      model: config.modelId,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentParts as never }],
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: DEFAULT_MAX_RETRIES,
      abortSignal: signal
    })

    const text = result.text?.trim() || ''
    const prompts = parsePosterPrompts(text)

    console.log(`[AgentVisionExecutor] Completed in ${Date.now() - startTime}ms`, {
      providerId: config.providerId,
      modelId: config.modelId,
      promptCount: prompts.length
    })

    return {
      output: JSON.stringify({
        promptCount: prompts.length,
        rawPreview: text.slice(0, AGENT_VISION_PREVIEW_LENGTH)
      }),
      context: { agentVisionPrompts: prompts }
    }
  } catch (error) {
    const message = errorMessage(error)
    console.error('[AgentVisionExecutor] Vision step failed', {
      providerId: config.providerId,
      modelId: config.modelId,
      promptId,
      error: message
    })
    throw new Error(`Agent vision step failed: ${message}`, { cause: error })
  }
}
