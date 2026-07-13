import type {
  ImagesResult,
  PlanResult,
  SellingPointsResult,
  ShowcaseImageItem
} from '@shared/ecommerce-workflow/showcase-types'
import { ArrowRight, Download } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useToasts } from '@/components/ui/toast'
import { type ShowcaseStep, useEcommerceShowcaseStore } from '@/stores/ecommerce-showcase'
import { TaskStatusCard } from './TaskStatusCard'

export function PreviewPanel() {
  const { t } = useTranslation()
  const toast = useToasts()
  const currentStep = useEcommerceShowcaseStore((s) => s.currentStep)
  const draft = useEcommerceShowcaseStore(useShallow((s) => s.draft))
  const tasks = useEcommerceShowcaseStore(useShallow((s) => s.tasks))
  const loading = useEcommerceShowcaseStore(useShallow((s) => s.loading))
  const error = useEcommerceShowcaseStore(useShallow((s) => s.error))
  const setDraft = useEcommerceShowcaseStore((s) => s.setDraft)
  const generateSellingPoints = useEcommerceShowcaseStore((s) => s.generateSellingPoints)
  const generatePlan = useEcommerceShowcaseStore((s) => s.generatePlan)
  const generateImages = useEcommerceShowcaseStore((s) => s.generateImages)
  const cancelCurrent = useEcommerceShowcaseStore((s) => s.cancelCurrent)
  const setCurrentStep = useEcommerceShowcaseStore((s) => s.setCurrentStep)
  const lastErrorRef = useRef<string | null>(null)

  const task = tasks[currentStep]

  const sellingPoints =
    currentStep === 'selling_points'
      ? (draft.selling_points ?? (task?.result as SellingPointsResult | undefined)?.sellingPoints ?? [])
      : []
  const planModules =
    currentStep === 'plan' ? ((draft.plan ?? (task?.result as PlanResult | undefined))?.modules ?? []) : []
  const images = currentStep === 'images' ? ((task?.result as ImagesResult | undefined)?.images ?? []) : []
  const hasResult =
    (currentStep === 'selling_points' && sellingPoints.length > 0) ||
    (currentStep === 'plan' && planModules.length > 0) ||
    (currentStep === 'images' && images.length > 0)

  const handleRetry = () => {
    if (currentStep === 'selling_points') generateSellingPoints()
    if (currentStep === 'plan') generatePlan()
    if (currentStep === 'images') generateImages()
  }

  useEffect(() => {
    const currentError = error[currentStep]
    if (!currentError || currentError === lastErrorRef.current) return

    lastErrorRef.current = currentError
    toast.error({
      title: t('common.error'),
      description: currentError
    })
  }, [currentStep, error, t, toast])

  useEffect(() => {
    if (!error[currentStep]) {
      lastErrorRef.current = null
    }
  }, [currentStep, error])

  return (
    <div className='flex-1 p-6 overflow-y-auto'>
      <TaskStatusCard
        isLoading={loading[currentStep]}
        error={error[currentStep]}
        onRetry={handleRetry}
        onCancel={cancelCurrent}
        title={t(`ecommerceShowcase.steps.${currentStep}`)}
      />

      {!hasResult && !loading[currentStep] && !error[currentStep] && (
        <div className='h-full flex flex-col items-center justify-center text-[var(--juhe-text-3)]'>
          <span className='text-4xl mb-3' aria-hidden='true'>
            🖼️
          </span>
          <p>
            {currentStep === 'images'
              ? t('ecommerceShowcase.placeholderGenerating')
              : t('ecommerceShowcase.emptyState')}
          </p>
        </div>
      )}

      {currentStep === 'selling_points' && sellingPoints.length > 0 && (
        <SellingPointsView
          points={sellingPoints}
          onChange={(points) => setDraft('selling_points', points)}
          onNext={() => setCurrentStep('plan')}
        />
      )}

      {currentStep === 'plan' && planModules.length > 0 && (
        <PlanView
          modules={planModules}
          onChange={(modules) => setDraft('plan', { modules })}
          onNext={() => setCurrentStep('images')}
        />
      )}

      {currentStep === 'images' && <ImagesView images={images} />}
    </div>
  )
}

function NextStepButton({ nextStep, onNext }: { nextStep: ShowcaseStep; onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type='button'
      onClick={onNext}
      className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--juhe-cyan)] text-white hover:opacity-90 transition-opacity'
    >
      {t('ecommerceShowcase.nextStep', { step: t(`ecommerceShowcase.steps.${nextStep}`) })}
      <ArrowRight className='w-4 h-4' />
    </button>
  )
}

function SellingPointsView({
  points,
  onChange,
  onNext
}: {
  points: string[]
  onChange: (points: string[]) => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-sm font-semibold'>{t('ecommerceShowcase.sellingPoints')}</h3>
        <NextStepButton nextStep='plan' onNext={onNext} />
      </div>
      <textarea
        value={points.join('\n')}
        onChange={(e) =>
          onChange(
            e.target.value
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
        rows={10}
        aria-label={t('ecommerceShowcase.sellingPoints')}
        className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm resize-none'
      />
    </div>
  )
}

function PlanView({
  modules,
  onChange,
  onNext
}: {
  modules: PlanResult['modules']
  onChange: (modules: PlanResult['modules']) => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const update = (index: number, field: keyof PlanResult['modules'][number], value: string) => {
    const next = modules.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    onChange(next)
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-sm font-semibold'>{t('ecommerceShowcase.plan')}</h3>
        <NextStepButton nextStep='images' onNext={onNext} />
      </div>
      {modules.map((m, index) => (
        <div key={m.id} className='p-4 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] space-y-2'>
          <input
            value={m.title}
            onChange={(e) => update(index, 'title', e.target.value)}
            aria-label={t('ecommerceShowcase.moduleTitle')}
            className='w-full px-2 py-1 rounded border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-sm font-medium'
          />
          <textarea
            value={m.imagePrompt}
            onChange={(e) => update(index, 'imagePrompt', e.target.value)}
            rows={3}
            aria-label={t('ecommerceShowcase.moduleImagePrompt')}
            className='w-full px-2 py-1 rounded border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-xs resize-none'
          />
          <textarea
            value={m.copyRequirements}
            onChange={(e) => update(index, 'copyRequirements', e.target.value)}
            rows={2}
            aria-label={t('ecommerceShowcase.moduleCopyRequirements')}
            className='w-full px-2 py-1 rounded border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-xs resize-none'
          />
        </div>
      ))}
    </div>
  )
}

function ImagesView({ images }: { images: ShowcaseImageItem[] }) {
  const { t } = useTranslation()
  const displayImages = [...images].sort((a, b) => a.order - b.order)

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold'>{t('ecommerceShowcase.results')}</h3>
      <div className='grid grid-cols-2 gap-3'>
        {displayImages.map((img) => {
          if (img.status === 'pending') {
            return (
              <div
                key={img.id}
                className='relative aspect-square rounded-lg border border-dashed border-[var(--juhe-border)] bg-[var(--juhe-void-2)] flex flex-col items-center justify-center gap-2 text-[var(--juhe-text-3)]'
              >
                <div className='absolute top-2 left-2 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white/90'>
                  #{img.order + 1}
                </div>
                <div className='text-3xl animate-pulse'>◌</div>
                <div className='text-xs px-3 text-center'>
                  {t('ecommerceShowcase.pendingImage', { title: img.title })}
                </div>
              </div>
            )
          }

          if (img.status === 'success') {
            return (
              <div
                key={img.id}
                className='relative group rounded-lg border border-[var(--juhe-border)] overflow-hidden'
              >
                <div className='absolute top-2 left-2 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white/90'>
                  #{img.order + 1}
                </div>
                <img
                  src={img.url}
                  alt={t('ecommerceShowcase.generatedImageAlt')}
                  className='w-full aspect-square object-cover'
                />
                <a
                  href={img.url}
                  download
                  aria-label={t('ecommerceShowcase.downloadImage')}
                  className='absolute bottom-2 right-2 p-1.5 rounded-md bg-white/90 text-[var(--juhe-text)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity'
                >
                  <Download className='w-3.5 h-3.5' />
                </a>
              </div>
            )
          }

          return (
            <div
              key={img.id}
              className='relative p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400 aspect-square flex items-center justify-center text-center break-words'
            >
              <div className='absolute top-2 left-2 z-10 rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white/90'>
                #{img.order + 1}
              </div>
              {img.error}
            </div>
          )
        })}
      </div>
    </div>
  )
}
