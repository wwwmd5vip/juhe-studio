import type { WorkflowModule, WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TaskModelSelector, type TaskModelSelectorValue } from '@/components/common/TaskModelSelector'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { StepCard } from '../StepCard'

interface ReviewStepCardProps {
  step: WorkflowTemplateStep
  stepState: WorkflowStepState
  workflowId: string
}

export function ReviewStepCard({ step, stepState }: ReviewStepCardProps) {
  const { t } = useTranslation()
  const { currentWorkflow, updateCurrentModules, updateWorkflow } = useEcommerceWorkflowStore()
  const modules = currentWorkflow?.modules ?? []

  const handleToggle = (moduleId: string) => {
    const updated = modules.map((m) => (m.moduleId === moduleId ? { ...m, enabled: !m.enabled } : m))
    updateCurrentModules(updated)
  }

  const handleModelChange = (moduleId: string, value: TaskModelSelectorValue) => {
    const updated = modules.map((m) =>
      m.moduleId === moduleId ? { ...m, providerId: value.providerId, modelId: value.model } : m
    )
    updateCurrentModules(updated)
  }

  const handleSave = () => {
    if (!currentWorkflow) return
    updateWorkflow(currentWorkflow.id, { modules: currentWorkflow.modules })
  }

  return (
    <StepCard step={step} stepState={stepState}>
      {modules.length === 0 ? (
        <div className='text-sm text-[var(--juhe-text-3)]'>{t('ecommerceWorkflow.noModulesToReview')}</div>
      ) : (
        <div className='space-y-3'>
          {modules.map((m) => (
            <ModuleReviewItem
              key={m.moduleId}
              module={m}
              onToggle={() => handleToggle(m.moduleId)}
              onModelChange={handleModelChange}
            />
          ))}
          <button
            type='button'
            onClick={handleSave}
            className='px-4 py-2 rounded-lg text-sm bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] hover:bg-[var(--juhe-cyan)]/30'
          >
            {t('common.save')}
          </button>
        </div>
      )}
    </StepCard>
  )
}

function ModuleReviewItem({
  module,
  onToggle,
  onModelChange
}: {
  module: WorkflowModule
  onToggle: () => void
  onModelChange: (moduleId: string, value: TaskModelSelectorValue) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={onToggle}
            className={`p-1 rounded-md ${module.enabled ? 'bg-green-500/20 text-green-400' : 'bg-[var(--juhe-text-3)]/20 text-[var(--juhe-text-3)]'}`}
          >
            {module.enabled ? <Check className='w-4 h-4' /> : <X className='w-4 h-4' />}
          </button>
          <span className={`text-sm font-medium ${!module.enabled && 'opacity-50'}`}>{module.moduleName}</span>
        </div>
      </div>

      <TaskModelSelector
        providerId={module.providerId}
        model={module.modelId}
        capabilities={['image']}
        onChange={(value) => onModelChange(module.moduleId, value)}
      />

      <div>
        <span className='block text-xs font-medium mb-1'>{t('ecommerceWorkflow.imagePrompt')}</span>
        <div className='text-xs text-[var(--juhe-text-3)] line-clamp-3'>{module.imagePrompt}</div>
      </div>

      <div>
        <span className='block text-xs font-medium mb-1'>{t('ecommerceWorkflow.copyRequirements')}</span>
        <div className='text-xs text-[var(--juhe-text-3)] line-clamp-3'>{module.copyRequirements}</div>
      </div>
    </div>
  )
}
