import type { WorkflowStepConfig, WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { Play, Square } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { useProviderStore } from '@/stores/providers'
import { ModelConfigCard } from '../ModelConfigCard'
import { StepCard } from '../StepCard'

interface ModuleGenerateStepCardProps {
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

export function ModuleGenerateStepCard({ step, stepState }: ModuleGenerateStepCardProps) {
  const { t } = useTranslation()
  const {
    currentWorkflow,
    runningStepId,
    streamText,
    streamModules,
    streamProgress,
    updateCurrentStepConfig,
    runStep,
    cancelStep
  } = useEcommerceWorkflowStore()
  const providers = useProviderStore((s) => s.providers)

  const config = stepState.config ?? DEFAULT_CONFIG
  const isRunning = runningStepId === step.id
  const output = stepState.output ?? streamText[step.id] ?? ''
  const modules = streamModules[step.id] ?? currentWorkflow?.modules ?? []
  const configModuleState = currentWorkflow?.steps.find((s) => s.id === 'module-config')
  const selectedModuleTypes = currentWorkflow?.context.selectedModuleTypes ?? []
  const hasModuleConfigDep = step.dependencies.includes('module-config')

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
    step.dependencies.every((dep) => {
      if (dep === 'module-config') {
        return selectedModuleTypes.length > 0 && configModuleState?.status === 'success'
      }
      return currentWorkflow.context.outputs[dep]
    })

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
          <>
            <button
              type='button'
              onClick={handleRun}
              disabled={!canRun}
              className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] hover:bg-[var(--juhe-cyan)]/30 disabled:opacity-50'
            >
              <Play className='w-3.5 h-3.5' />
              {t('ecommerceWorkflow.run')}
            </button>
            {hasModuleConfigDep && selectedModuleTypes.length === 0 && (
              <div className='text-xs text-[var(--juhe-text-3)]'>{t('ecommerceWorkflow.noSelectedModules')}</div>
            )}
          </>
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

      {output && (
        <div className='p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm whitespace-pre-wrap max-h-48 overflow-y-auto'>
          {output}
        </div>
      )}

      {modules.length > 0 && (
        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>{t('ecommerceWorkflow.generatedModules')}</h4>
          <div className='grid grid-cols-1 gap-2'>
            {modules.map((m) => (
              <div
                key={m.moduleId}
                className='p-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm'
              >
                <div className='font-medium'>{m.moduleName}</div>
                <div className='text-xs text-[var(--juhe-text-3)] line-clamp-2'>{m.imagePrompt}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </StepCard>
  )
}
