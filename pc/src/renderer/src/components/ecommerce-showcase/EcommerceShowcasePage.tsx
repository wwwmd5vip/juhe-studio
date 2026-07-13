import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useEcommerceShowcaseStore } from '@/stores/ecommerce-showcase'
import { ConfigPanel } from './ConfigPanel'
import { PreviewPanel } from './PreviewPanel'
import { StepPanel } from './StepPanel'

export function EcommerceShowcasePage() {
  const { t } = useTranslation()
  const currentStep = useEcommerceShowcaseStore((s) => s.currentStep)
  const setCurrentStep = useEcommerceShowcaseStore((s) => s.setCurrentStep)
  const tasks = useEcommerceShowcaseStore(useShallow((s) => s.tasks))
  const config = useEcommerceShowcaseStore((s) => s.config)
  const cleanup = useEcommerceShowcaseStore((s) => s.cleanup)

  // Clean up all polling timers and maps on unmount to prevent memory leaks
  useEffect(() => {
    return () => { cleanup() }
  }, [cleanup])

  const completed = {
    selling_points: !!tasks.selling_points?.result,
    plan: !!tasks.plan?.result,
    images: !!tasks.images?.result
  }

  const available = {
    selling_points:
      !!config.productImage &&
      !!config.platform &&
      !!config.market &&
      !!config.language &&
      !!config.visionChatProviderId &&
      !!config.visionChatModelId,
    plan: completed.selling_points,
    images: completed.plan
  }

  return (
    <div className='h-[calc(100vh-3rem)] flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      <div className='px-6 pt-4'>
        <h1 className='text-lg font-bold'>{t('ecommerceShowcase.title')}</h1>
      </div>
      <StepPanel currentStep={currentStep} onStepClick={setCurrentStep} completed={completed} available={available} />
      <div className='flex-1 flex overflow-hidden'>
        <ConfigPanel />
        <PreviewPanel />
      </div>
    </div>
  )
}
