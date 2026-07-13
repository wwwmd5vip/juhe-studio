// src/main/services/ecommerce-workflow/index.ts
import type {
  StepExecutionResult,
  StepPrompt,
  WorkflowContext,
  WorkflowStepConfig,
  WorkflowTemplateStep
} from '@shared/ecommerce-workflow/types'
import { runAgentGenerateStep } from './agent-generate-executor'
import { runAgentVisionStep } from './agent-vision-executor'
import { runLlmStep } from './llm-executor'
import { runLlmStreamStep } from './llm-stream-executor'
import { runModuleGenerateStep } from './module-generate-executor'
import { parseRecommendedModules } from './module-recommend-parser'
import { runVisionStep } from './vision-executor'

export type RunnableStepType = Extract<
  WorkflowTemplateStep['type'],
  'vision' | 'llm' | 'llm-stream' | 'module-generate' | 'agent-vision' | 'agent-generate'
>

export interface RunStepOptions {
  requestId: string
  workflowId: string
  stepId: string
  stepType: RunnableStepType
  context: WorkflowContext
  config: WorkflowStepConfig
  previousOutput?: string
  prompt?: StepPrompt
  signal?: AbortSignal
}

export async function runWorkflowStep(opts: RunStepOptions): Promise<StepExecutionResult> {
  const stepPrompt = opts.prompt ?? { system: '', user: '' }
  switch (opts.stepType) {
    case 'vision':
      return await runVisionStep(opts.config, opts.context, stepPrompt, opts.signal)
    case 'llm': {
      const result = await runLlmStep(opts.config, opts.context, opts.previousOutput, stepPrompt, opts.signal)
      if (opts.stepId === 'module-recommend') {
        const recommendations = parseRecommendedModules(result.output)
        return { ...result, output: JSON.stringify(recommendations) }
      }
      return result
    }
    case 'llm-stream':
      return await runLlmStreamStep(
        opts.config,
        opts.context,
        opts.previousOutput,
        stepPrompt,
        opts.workflowId,
        opts.stepId,
        opts.requestId,
        opts.signal
      )
    case 'module-generate':
      return await runModuleGenerateStep(
        opts.config,
        opts.context,
        opts.previousOutput,
        stepPrompt,
        opts.workflowId,
        opts.stepId,
        opts.requestId,
        opts.signal
      )
    case 'agent-vision':
      return await runAgentVisionStep(opts.config, opts.context, opts.signal)
    case 'agent-generate':
      return await runAgentGenerateStep(opts.config, opts.context, opts.signal)
    default:
      console.warn('[EcommerceWorkflow] Unsupported step type', {
        stepType: opts.stepType,
        workflowId: opts.workflowId,
        stepId: opts.stepId
      })
      throw new Error(`Unsupported step type: ${opts.stepType}`)
  }
}
