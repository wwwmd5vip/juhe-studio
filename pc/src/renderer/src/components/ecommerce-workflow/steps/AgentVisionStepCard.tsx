import type { WorkflowStepConfig, WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { Check, Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { useProviderStore } from '@/stores/providers'

import { ModelConfigCard } from '../ModelConfigCard'
import { StepCard } from '../StepCard'

interface AgentVisionStepCardProps {
  step: WorkflowTemplateStep
  stepState: WorkflowStepState
  workflowId: string
}

const DEFAULT_CONFIG: WorkflowStepConfig = {
  providerId: '',
  modelId: '',
  systemPrompt: '',
  temperature: 0.7
}

export function AgentVisionStepCard({ step, stepState, workflowId }: AgentVisionStepCardProps) {
  const { t } = useTranslation()
  const {
    currentWorkflow,
    runningStepId,
    streamText,
    streamProgress,
    runStep,
    cancelStep,
    updateCurrentStepConfig,
    updateCurrentContext,
    updateWorkflow
  } = useEcommerceWorkflowStore()
  const providers = useProviderStore((s) => s.providers)

  const config = stepState.config ?? DEFAULT_CONFIG
  const isRunning = runningStepId === step.id
  const output = stepState.output ?? streamText[step.id] ?? ''
  const prompts = currentWorkflow?.context.agentVisionPrompts ?? []
  const isConfirmed = currentWorkflow?.context.agentVisionPromptsConfirmed ?? false

  // Auto-select server-configured default vision model on first load
  useEffect(() => {
    if (config.providerId || config.modelId) return

    async function autoSelect() {
      try {
        const defaultModel = await window.api.juhePrompts.getDefaultVisionModel()
        if (!defaultModel) return

        for (const provider of providers) {
          const match = provider.models.find((m) => m.name === defaultModel && m.isEnabled)
          if (match) {
            updateCurrentStepConfig(step.id, {
              ...DEFAULT_CONFIG,
              providerId: provider.id,
              modelId: match.name
            })
            return
          }
        }
      } catch {
        // Server not configured or not reachable
      }
    }

    autoSelect()
  }, [config.modelId, config.providerId, providers, step.id, updateCurrentStepConfig])

  const savePrompts = (nextPrompts: string[], confirmed: boolean) => {
    if (!currentWorkflow) return
    const context = {
      ...currentWorkflow.context,
      agentVisionPrompts: nextPrompts,
      agentVisionPromptsConfirmed: confirmed
    }
    updateCurrentContext(context)
    updateWorkflow(workflowId, { context })
  }

  const handleRun = async () => {
    if (!currentWorkflow) return
    // Re-generating invalidates any previous confirmation
    savePrompts([], false)
    await runStep(step.id, config)
  }

  const handlePromptChange = (index: number, value: string) => {
    const next = [...prompts]
    next[index] = value
    savePrompts(next, false)
  }

  const handleDeletePrompt = (index: number) => {
    const next = prompts.filter((_, i) => i !== index)
    savePrompts(next, false)
  }

  const handleAddPrompt = () => {
    savePrompts([...prompts, ''], false)
  }

  const handleConfirm = () => {
    if (prompts.length === 0) return
    savePrompts(prompts, true)
  }

  const canRun = !!currentWorkflow?.context.productImage && !!config.providerId && !!config.modelId

  return (
    <StepCard
      step={step}
      stepState={stepState}
      actions={
        isRunning ? (
          <button
            type='button'
            onClick={cancelStep}
            className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30'
          >
            <Square className='w-3.5 h-3.5' />
            {t('common.cancel')}
          </button>
        ) : (
          <button
            type='button'
            onClick={handleRun}
            disabled={!canRun}
            className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] hover:bg-[var(--juhe-cyan)]/30 disabled:opacity-50'
          >
            {prompts.length > 0 ? (
              <RotateCcw className='w-3.5 h-3.5' />
            ) : (
              <Play className='w-3.5 h-3.5' />
            )}
            {prompts.length > 0 ? t('ecommerceWorkflow.agent.regeneratePrompts') : t('ecommerceWorkflow.run')}
          </button>
        )
      }
    >
      <ModelConfigCard
        config={config}
        onChange={(c) => updateCurrentStepConfig(step.id, c)}
        capabilities={['vision']}
        disabled={isRunning}
        hideSystemPrompt
      />

      {isRunning && streamProgress[step.id] !== undefined && (
        <div className='text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceWorkflow.progress')}: {streamProgress[step.id]}%
        </div>
      )}

      {output && prompts.length === 0 && (
        <div className='p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm whitespace-pre-wrap max-h-64 overflow-y-auto'>
          {output}
        </div>
      )}

      {prompts.length > 0 && (
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>
              {t('ecommerceWorkflow.agent.generatedPrompts', { count: prompts.length })}
            </span>
            {isConfirmed && (
              <span className='text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1'>
                <Check className='w-3 h-3' />
                {t('ecommerceWorkflow.agent.promptsConfirmed')}
              </span>
            )}
          </div>

          <div className='space-y-2'>
            {prompts.map((prompt, index) => (
              <div key={`${workflowId}-${index}`} className='flex gap-2'>
                <textarea
                  value={prompt}
                  onChange={(e) => handlePromptChange(index, e.target.value)}
                  rows={3}
                  disabled={isRunning}
                  className='flex-1 min-w-0 px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)] disabled:opacity-50'
                  placeholder={t('ecommerceWorkflow.agent.promptPlaceholder')}
                />
                <button
                  type='button'
                  onClick={() => handleDeletePrompt(index)}
                  disabled={isRunning || prompts.length <= 1}
                  className='shrink-0 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30'
                  aria-label={t('common.delete')}
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            ))}
          </div>

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={handleAddPrompt}
              disabled={isRunning}
              className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:bg-[var(--juhe-void-2)] disabled:opacity-50'
            >
              <Plus className='w-3.5 h-3.5' />
              {t('ecommerceWorkflow.agent.addPrompt')}
            </button>

            <button
              type='button'
              onClick={handleConfirm}
              disabled={isRunning || prompts.length === 0 || isConfirmed}
              className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50'
            >
              <Check className='w-3.5 h-3.5' />
              {isConfirmed ? t('ecommerceWorkflow.agent.confirmed') : t('ecommerceWorkflow.agent.confirmPrompts')}
            </button>
          </div>
        </div>
      )}
    </StepCard>
  )
}
