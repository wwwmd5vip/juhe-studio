import type { WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { useTranslation } from 'react-i18next'

interface StepCardProps {
  step: WorkflowTemplateStep
  stepState: WorkflowStepState
  children: React.ReactNode
  actions?: React.ReactNode
}

export function StepCard({ step, stepState, children, actions }: StepCardProps) {
  const { t } = useTranslation()

  const statusColor = {
    idle: 'bg-[var(--juhe-text-3)]/20 text-[var(--juhe-text-3)]',
    running: 'bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)]',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400'
  }[stepState.status]

  return (
    <div className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)] overflow-hidden'>
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold'>{t(step.titleI18nKey)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{stepState.status}</span>
        </div>
        {actions && <div className='flex items-center gap-2'>{actions}</div>}
      </div>
      <div className='p-4 space-y-4'>{children}</div>
    </div>
  )
}
