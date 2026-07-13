// src/main/services/ecommerce-workflow/agent-generate-executor.ts
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_AGENT_ASPECT_RATIO,
  DEFAULT_AGENT_IMAGE_COUNT,
  DEFAULT_AGENT_QUALITY,
  DEFAULT_AGENT_STYLE,
  MAX_IMAGE_SEED
} from '@shared/ecommerce-workflow/constants'
import type {
  AgentGeneratedImage,
  StepExecutionResult,
  WorkflowContext,
  WorkflowStepConfig
} from '@shared/ecommerce-workflow/types'
import type { GenerationTask } from '@shared/types/generation'
import { errorMessage } from '@shared/utils/error-classifier'

import { executeImageGeneration } from '../generation'
import { aspectRatioToImageSize, checkCapability } from './utils'

// Provider-specific optional-parameter rejection keywords.
// When an error message contains one of these, we retry once with a minimal parameter set.
const PARAM_ERROR_KEYWORDS = [
  'aspect_ratio',
  'size',
  'style',
  'quality',
  'seed',
  '比例',
  '尺寸',
  '风格',
  '质量',
  '种子'
]

function buildImageTask(params: GenerationTask['params']): GenerationTask {
  return {
    id: randomUUID(),
    type: 'image',
    status: 'processing',
    priority: 'normal',
    progress: 0,
    stage: 'generating',
    createdAt: Date.now(),
    params,
    outputs: []
  }
}

export async function runAgentGenerateStep(
  config: WorkflowStepConfig,
  context: WorkflowContext,
  signal?: AbortSignal
): Promise<StepExecutionResult> {
  const startTime = Date.now()
  checkCapability(config.modelId, 'image')
  const prompts = (context.agentVisionPrompts ?? []).slice(0, context.imageCount ?? DEFAULT_AGENT_IMAGE_COUNT)
  const ratio = context.ratio ?? DEFAULT_AGENT_ASPECT_RATIO
  const size = aspectRatioToImageSize(ratio)
  const images: AgentGeneratedImage[] = []

  if (prompts.length === 0) {
    return {
      output: JSON.stringify({ success: 0, errors: 0, total: 0 }),
      context: { agentGeneratedImages: images }
    }
  }

  for (let i = 0; i < prompts.length; i++) {
    if (signal?.aborted) {
      console.log('[AgentGenerateExecutor] Aborted', { completedCount: i })
      break
    }

    const prompt = prompts[i]
    const imageRecord: AgentGeneratedImage = {
      id: randomUUID(),
      url: '',
      prompt,
      status: 'error',
      createdAt: Date.now()
    }

    try {
      const task = buildImageTask({
        prompt,
        n: 1,
        model: config.modelId,
        providerId: config.providerId,
        aspectRatio: ratio,
        size,
        style: DEFAULT_AGENT_STYLE,
        quality: DEFAULT_AGENT_QUALITY,
        seed: Math.floor(Math.random() * MAX_IMAGE_SEED)
      })

      await executeImageGeneration(task)

      const url = task.outputs[0]?.url
      if (!url) {
        throw new Error('No image URL in task outputs')
      }

      imageRecord.url = url
      imageRecord.status = 'success'
    } catch (error) {
      const message = errorMessage(error)
      console.warn(`[AgentGenerateExecutor] Image ${i + 1} failed:`, {
        index: i,
        prompt,
        modelId: config.modelId,
        providerId: config.providerId,
        error: message
      })
      imageRecord.error = message

      // Retry once without extra parameters when the provider rejects optional parameters
      if (PARAM_ERROR_KEYWORDS.some((keyword) => message.includes(keyword))) {
        if (signal?.aborted) break
        try {
          const retryTask = buildImageTask({
            prompt,
            n: 1,
            model: config.modelId,
            providerId: config.providerId
          })
          await executeImageGeneration(retryTask)
          const url = retryTask.outputs[0]?.url
          if (url) {
            imageRecord.url = url
            imageRecord.status = 'success'
            delete imageRecord.error
          }
        } catch (retryErr) {
          const retryMessage = errorMessage(retryErr)
          console.warn(`[AgentGenerateExecutor] Image ${i + 1} retry failed:`, {
            index: i,
            prompt,
            modelId: config.modelId,
            providerId: config.providerId,
            error: retryMessage
          })
        }
      }
    } finally {
      images.push(imageRecord)
    }
  }

  const success = images.filter((img) => img.status === 'success').length
  const errors = images.filter((img) => img.status === 'error').length

  console.log(`[AgentGenerateExecutor] Completed in ${Date.now() - startTime}ms`, {
    success,
    errors,
    total: images.length
  })

  return {
    output: JSON.stringify({ success, errors, total: images.length }),
    context: { agentGeneratedImages: images }
  }
}
