import { useTranslation } from 'react-i18next'
import type { ShowcaseStep } from '@/stores/ecommerce-showcase'

const STEPS: ShowcaseStep[] = ['selling_points', 'plan', 'images']

interface StepPanelProps {
  currentStep: ShowcaseStep
  onStepClick: (step: ShowcaseStep) => void
  completed: Record<ShowcaseStep, boolean>
  available: Record<ShowcaseStep, boolean>
}

export function StepPanel({ currentStep, onStepClick, completed, available }: StepPanelProps) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center justify-center gap-2 py-4'>
      {STEPS.map((step, index) => (
        <button
          key={step}
          type='button'
          aria-current={step === currentStep ? 'step' : undefined}
          aria-disabled={!available[step]}
          onClick={() => available[step] && onStepClick(step)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            step === currentStep
              ? 'bg-[var(--juhe-cyan)] text-white'
              : completed[step]
                ? 'bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                : available[step]
                  ? 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text)] hover:text-[var(--juhe-cyan)]'
                  : 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)]'
          }`}
        >
          {index + 1}. {t(`ecommerceShowcase.steps.${step}`)}
        </button>
      ))}
    </div>
  )
}
