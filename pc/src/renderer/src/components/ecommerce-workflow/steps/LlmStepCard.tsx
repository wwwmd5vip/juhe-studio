import type { Language } from '@shared/ecommerce-workflow/enums'
import { getModuleLabel, getModuleTypeById } from '@shared/ecommerce-workflow/module-types'
import type { WorkflowStepConfig, WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { Play, Square } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { useProviderStore } from '@/stores/providers'
import { ModelConfigCard } from '../ModelConfigCard'
import { StepCard } from '../StepCard'

interface LlmStepCardProps {
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

export function LlmStepCard({ step, stepState }: LlmStepCardProps) {
  const { t } = useTranslation()
  const { currentWorkflow, runningStepId, streamText, streamProgress, updateCurrentStepConfig, runStep, cancelStep } =
    useEcommerceWorkflowStore()
  const providers = useProviderStore((s) => s.providers)

  const config = stepState.config ?? DEFAULT_CONFIG
  const isRunning = runningStepId === step.id
  const output = stepState.output ?? streamText[step.id] ?? ''

  // Auto-select server-configured default LLM model on first load
  useEffect(() => {
    if (config.providerId || config.modelId) return

    async function autoSelect() {
      try {
        const defaultModel = await window.api.juhePrompts.getDefaultLLMModel()
        if (!defaultModel) return

        for (const provider of providers) {
          const match = provider.models.find(
            (m) => m.name === defaultModel && m.isEnabled
          )
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
  }, [])

  const canRun =
    config.providerId &&
    currentWorkflow &&
    step.dependencies.every(
      (dep) =>
        currentWorkflow.context.outputs[dep] || currentWorkflow.context[dep as keyof typeof currentWorkflow.context]
    )

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
        capabilities={['chat']}
        disabled={isRunning}
      />

      {isRunning && streamProgress[step.id] !== undefined && (
        <div className='text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceWorkflow.progress')}: {streamProgress[step.id]}%
        </div>
      )}

      {output && step.id === 'module-recommend' && (
        <ModuleRecommendOutput output={output} language={currentWorkflow?.context.language ?? 'en'} />
      )}

      {output && step.id !== 'module-recommend' && (
        <div className='p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm whitespace-pre-wrap max-h-64 overflow-y-auto'>
          {output}
        </div>
      )}
    </StepCard>
  )
}

function ModuleRecommendOutput({ output, language }: { output: string; language: Language }) {
  const { t } = useTranslation()
  let ids: string[] = []
  try {
    const parsed = JSON.parse(output)
    if (Array.isArray(parsed)) {
      ids = parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    // keep ids as []
  }

  if (ids.length === 0) {
    return (
      <div className='text-sm text-[var(--juhe-text-3)]'>{t('ecommerceWorkflow.moduleConfig.noRecommendations')}</div>
    )
  }

  return (
    <div className='flex flex-wrap gap-2'>
      {ids.map((id) => {
        const def = getModuleTypeById(id)
        const label = def ? getModuleLabel(def, language) : { name: id, description: '' }
        return (
          <span key={id} className='px-2 py-1 rounded text-xs bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'>
            {label.name}
          </span>
        )
      })}
    </div>
  )
}
