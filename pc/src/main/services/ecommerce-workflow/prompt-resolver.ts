import { renderModulePool } from '@shared/ecommerce-workflow/module-types'
import { type PromptTemplateKey, resolvePrompt } from '@shared/ecommerce-workflow/prompts'
import { getWorkflowTemplate } from '@shared/ecommerce-workflow/templates'
import type { WorkflowContext } from '@shared/ecommerce-workflow/types'

export interface ResolvedPrompts {
  system: string
  user: string
}

export function resolveStepPrompts(
  templateId: string,
  stepId: string,
  context: WorkflowContext,
  fallbackSystemPrompt: string
): ResolvedPrompts {
  const template = getWorkflowTemplate(templateId)
  const step = template.steps.find((s) => s.id === stepId)
  if (!step?.promptTemplate) {
    return { system: fallbackSystemPrompt, user: '' }
  }

  const language = context.language ?? 'en'
  const previousOutput = step.dependencies.length > 0 ? (context.outputs?.[step.dependencies[0]] ?? '') : ''

  const ctx = {
    productText: context.productText ?? '',
    platform: context.platform ?? '',
    market: context.market ?? 'us',
    language,
    ratio: context.ratio ?? '1:1',
    previousOutput,
    copyOutput: context.outputs?.copy ?? '',
    selectedModuleTypes: (context.selectedModuleTypes ?? []).join(', '),
    modulePool: renderModulePool(language)
  }

  const system = step.promptTemplate.systemI18nKey
    ? resolvePrompt(step.promptTemplate.systemI18nKey as PromptTemplateKey, language, ctx)
    : fallbackSystemPrompt
  const user = step.promptTemplate.userI18nKey
    ? resolvePrompt(step.promptTemplate.userI18nKey as PromptTemplateKey, language, ctx)
    : ''

  return { system, user }
}
