import type { WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'

import { StepCard } from '../StepCard'

interface AgentResultStepCardProps {
  step: WorkflowTemplateStep
  stepState: WorkflowStepState
  workflowId: string
}

export function AgentResultStepCard({ step, stepState, workflowId: _workflowId }: AgentResultStepCardProps) {
  const { t } = useTranslation()
  const { currentWorkflow } = useEcommerceWorkflowStore()
  const images = currentWorkflow?.context.agentGeneratedImages ?? []
  const successCount = images.filter((img) => img.status === 'success').length
  const errorCount = images.filter((img) => img.status === 'error').length

  return (
    <StepCard step={step} stepState={stepState}>
      <div className='text-sm' aria-live='polite'>
        {t('ecommerceWorkflow.agent.resultSummary', {
          success: t('ecommerceWorkflow.agent.successCount', { count: successCount }),
          error: t('ecommerceWorkflow.agent.errorCount', { count: errorCount })
        })}
      </div>
      {images.length === 0 ? (
        <div className='text-sm text-[var(--juhe-text-3)]'>{t('ecommerceWorkflow.agent.noImages')}</div>
      ) : (
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          {images.map((img, index) =>
            img.status === 'success' ? (
              <div
                key={img.id}
                className='relative aspect-video rounded-lg overflow-hidden border border-[var(--juhe-border)]'
              >
                <img
                  src={img.url}
                  alt={t('ecommerceWorkflow.agent.generatedImageAlt', { index: index + 1 })}
                  className='w-full h-full object-cover'
                />
              </div>
            ) : (
              <div
                key={img.id}
                className='p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400 aspect-video flex items-center justify-center text-center break-words'
              >
                {img.error || t('ecommerceWorkflow.agent.imageGenerationFailed')}
              </div>
            )
          )}
        </div>
      )}
    </StepCard>
  )
}
