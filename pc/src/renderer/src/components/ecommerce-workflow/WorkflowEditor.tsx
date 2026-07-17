import { getWorkflowTemplate } from '@shared/ecommerce-workflow/templates'
import { Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { AgentGenerateStepCard } from './steps/AgentGenerateStepCard'
import { AgentResultStepCard } from './steps/AgentResultStepCard'
import { AgentVisionStepCard } from './steps/AgentVisionStepCard'
import { InputStepCard } from './steps/InputStepCard'
import { LlmStepCard } from './steps/LlmStepCard'
import { ModuleConfigStepCard } from './steps/ModuleConfigStepCard'
import { ModuleGenerateStepCard } from './steps/ModuleGenerateStepCard'
import { ResultStepCard } from './steps/ResultStepCard'
import { ReviewStepCard } from './steps/ReviewStepCard'
import { VisionStepCard } from './steps/VisionStepCard'

export function WorkflowEditor() {
  const { t } = useTranslation()
  const { currentWorkflow, runningStepId, runAgent, cancelStep } = useEcommerceWorkflowStore()

  if (!currentWorkflow) return null

  const template = getWorkflowTemplate(currentWorkflow.templateId)
  const isAgent = currentWorkflow.templateId === 'agent-poster'
  const isRunning = runningStepId !== null
  const visionStep = currentWorkflow.steps.find((s) => s.id === 'agent-vision')
  const generateStep = currentWorkflow.steps.find((s) => s.id === 'agent-generate')
  const canRunAgent =
    !!currentWorkflow.context.productImage &&
    !!visionStep?.config?.providerId &&
    !!visionStep?.config?.modelId &&
    !!generateStep?.config?.providerId &&
    !!generateStep?.config?.modelId

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-bold'>{currentWorkflow.name}</h2>
          <p className='text-xs text-[var(--juhe-text-3)]'>
            {t('ecommerceWorkflow.status')}: {t(`ecommerceWorkflow.statusValues.${currentWorkflow.status}`)}
          </p>
        </div>
        {isAgent && (
          <button
            type='button'
            onClick={isRunning ? cancelStep : runAgent}
            disabled={!canRunAgent}
            className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] hover:bg-[var(--juhe-cyan)]/30 disabled:opacity-50'
          >
            {isRunning ? <Square className='w-3.5 h-3.5' /> : <Play className='w-3.5 h-3.5' />}
            {isRunning ? t('common.cancel') : t('ecommerceWorkflow.agent.runAgent')}
          </button>
        )}
      </div>

      <div className='space-y-4'>
        {template.steps.map((step) => {
          const stepState = currentWorkflow.steps.find((s) => s.id === step.id)
          if (!stepState) return null

          const common = {
            step,
            stepState,
            workflowId: currentWorkflow.id
          }

          switch (step.type) {
            case 'input':
              return <InputStepCard key={step.id} {...common} />
            case 'vision':
              return <VisionStepCard key={step.id} {...common} />
            case 'llm':
            case 'llm-stream':
              return <LlmStepCard key={step.id} {...common} />
            case 'module-config':
              return <ModuleConfigStepCard key={step.id} {...common} />
            case 'module-generate':
              return <ModuleGenerateStepCard key={step.id} {...common} />
            case 'review':
              return <ReviewStepCard key={step.id} {...common} />
            case 'result':
              return <ResultStepCard key={step.id} {...common} />
            case 'agent-vision':
              return <AgentVisionStepCard key={step.id} {...common} />
            case 'agent-generate':
              return <AgentGenerateStepCard key={step.id} {...common} />
            case 'agent-result':
              return <AgentResultStepCard key={step.id} {...common} />
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}
