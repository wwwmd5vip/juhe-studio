import type { WorkflowStepConfig, WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { filterAvailableProviders } from '@/components/common/task-model-selector.utils'
import { Play, Square } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { useProviderStore } from '@/stores/providers'

import { ModelConfigCard } from '../ModelConfigCard'
import { StepCard } from '../StepCard'

interface AgentGenerateStepCardProps {
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

export function AgentGenerateStepCard({ step, stepState, workflowId: _workflowId }: AgentGenerateStepCardProps) {
  const { t } = useTranslation()
  const { currentWorkflow, runningStepId, streamText, streamProgress, runStep, cancelStep, updateCurrentStepConfig } =
    useEcommerceWorkflowStore()
  const providers = useProviderStore((s) => s.providers)

  const config = stepState.config ?? DEFAULT_CONFIG
  const isRunning = runningStepId === step.id
  const output = stepState.output ?? streamText[step.id] ?? ''
  const prompts = currentWorkflow?.context.agentVisionPrompts ?? []
  const hasPrompts = prompts.length > 0
  const isConfirmed = currentWorkflow?.context.agentVisionPromptsConfirmed ?? false
  const canRun = hasPrompts && isConfirmed && !!config.providerId && !!config.modelId

  // Auto-select the first available image-capable model on first load
  useEffect(() => {
    if (config.providerId || config.modelId) return

    const available = filterAvailableProviders(providers, ['image'])
    const firstProvider = available[0]
    const firstModel = firstProvider?.models[0]
    if (!firstProvider || !firstModel) return

    updateCurrentStepConfig(step.id, {
      ...DEFAULT_CONFIG,
      providerId: firstProvider.id,
      modelId: firstModel.name
    })
  }, [config.modelId, config.providerId, providers, step.id, updateCurrentStepConfig])

  const handleRun = async () => {
    await runStep(step.id, config)
  }

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
            <Play className='w-3.5 h-3.5' />
            {t('ecommerceWorkflow.run')}
          </button>
        )
      }
    >
      <ModelConfigCard
        config={config}
        onChange={(c) => updateCurrentStepConfig(step.id, c)}
        capabilities={['image']}
        disabled={isRunning}
        hideSystemPrompt
      />

      {hasPrompts && !isConfirmed && (
        <div className='p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-400'>
          {t('ecommerceWorkflow.agent.confirmBeforeGenerate')}
        </div>
      )}

      {isRunning && streamProgress[step.id] !== undefined && (
        <div className='text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceWorkflow.progress')}: {streamProgress[step.id]}%
        </div>
      )}
      {output && (
        <div className='p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm whitespace-pre-wrap max-h-64 overflow-y-auto'>
          {output}
        </div>
      )}
    </StepCard>
  )
}
