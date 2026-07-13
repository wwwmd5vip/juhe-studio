import { estimateShowcaseCost } from '@shared/ecommerce-workflow/cost-estimate'
import { LANGUAGES, MARKETS, PLATFORMS } from '@shared/ecommerce-workflow/enums'
import { getModuleLabel, MODULE_TYPES } from '@shared/ecommerce-workflow/module-types'
import type { PlanResult } from '@shared/ecommerce-workflow/showcase-types'
import { CheckCircle2, ImagePlus, LayoutGrid, Upload, Wand2, X } from 'lucide-react'
import { useId, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { TaskModelSelector } from '@/components/common/TaskModelSelector'
import { useEcommerceShowcaseStore } from '@/stores/ecommerce-showcase'
import { useProviderStore } from '@/stores/providers'
import { findUnsafeImageModules } from './promptSafety'

export function ConfigPanel() {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const config = useEcommerceShowcaseStore((s) => s.config)
  const currentStep = useEcommerceShowcaseStore((s) => s.currentStep)
  const loading = useEcommerceShowcaseStore(useShallow((s) => s.loading))
  const setConfig = useEcommerceShowcaseStore((s) => s.setConfig)
  const generateSellingPoints = useEcommerceShowcaseStore((s) => s.generateSellingPoints)
  const generatePlan = useEcommerceShowcaseStore((s) => s.generatePlan)
  const generateImages = useEcommerceShowcaseStore((s) => s.generateImages)
  const tasks = useEcommerceShowcaseStore(useShallow((s) => s.tasks))
  const providers = useProviderStore((s) => s.providers)
  const unsafeModules = findUnsafeImageModules(tasks.plan?.result as PlanResult | undefined)
  const unsafeModuleTitles = unsafeModules.map((module) => module.title).join('、')

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const path = await window.api.ecommerceWorkflow.saveImage({
          dataUrl: reader.result as string,
          fileName: file.name
        })
        if (path) setConfig({ productImage: path })
      } catch (error) {
        console.error('[ConfigPanel] Upload failed:', error)
        setUploadError(t('ecommerceShowcase.errors.uploadFailed'))
      } finally {
        resetInput()
      }
    }
    reader.onerror = () => {
      console.error('[ConfigPanel] FileReader error:', reader.error)
      setUploadError(t('ecommerceShowcase.errors.uploadFailed'))
      resetInput()
    }
    reader.readAsDataURL(file)
  }

  const toggleModule = (moduleId: string) => {
    const current = config.modules ?? []
    const next = current.includes(moduleId) ? current.filter((m) => m !== moduleId) : [...current, moduleId]
    setConfig({ modules: next })
  }

  const canGenerate =
    currentStep === 'selling_points'
      ? !!config.productImage &&
        !!config.platform &&
        !!config.market &&
        !!config.language &&
        !!config.visionChatProviderId &&
        !!config.visionChatModelId &&
        !loading[currentStep]
      : currentStep === 'plan'
        ? !!tasks.selling_points?.result && (config.modules?.length ?? 0) > 0 && !loading[currentStep]
        : !!tasks.plan?.result &&
          (config.modules?.length ?? 0) > 0 &&
          !!config.imageProviderId &&
          !!config.imageModelId &&
          !loading[currentStep]

  const handleGenerate = () => {
    if (currentStep === 'selling_points') return generateSellingPoints()
    if (currentStep === 'plan') return generatePlan()
    return generateImages()
  }

  const cost = estimateShowcaseCost(currentStep, config.modules?.length ?? 0)
  const language = config.language ?? 'zh'
  const setupDone = !!config.productImage && !!config.platform && !!config.market && !!config.language

  // Auto-select server-configured default vision model for showcase
  useEffect(() => {
    if (config.visionChatProviderId || config.visionChatModelId || !setupDone) return

    async function autoSelect() {
      try {
        const defaultModel = await window.api.juhePrompts.getDefaultVisionModel()
        if (!defaultModel) return

        for (const provider of providers) {
          const match = provider.models.find(
            (m) => m.name === defaultModel && m.isEnabled
          )
          if (match) {
            setConfig({ visionChatProviderId: provider.id, visionChatModelId: match.name })
            return
          }
        }
      } catch {
        // Server not configured or not reachable
      }
    }

    autoSelect()
  }, [setupDone])
  const sellingPointsDone = !!tasks.selling_points?.result
  const planDone = !!tasks.plan?.result
  const imageTaskCount = tasks.images?.result && 'images' in tasks.images.result ? tasks.images.result.images.length : 0

  return (
    <div className='w-80 shrink-0 border-r border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30 p-4 flex flex-col gap-4 overflow-y-auto'>
      <div className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/40 p-3 space-y-2 text-xs'>
        <ProgressRow
          done={setupDone}
          active={currentStep === 'selling_points'}
          label={t('ecommerceShowcase.flow.setup')}
        />
        <ProgressRow
          done={sellingPointsDone}
          active={currentStep === 'selling_points'}
          label={t('ecommerceShowcase.flow.sellingPoints')}
        />
        <ProgressRow done={planDone} active={currentStep === 'plan'} label={t('ecommerceShowcase.flow.plan')} />
        <ProgressRow
          done={!!tasks.images?.result}
          active={currentStep === 'images'}
          label={t('ecommerceShowcase.flow.images')}
        />
      </div>

      <div>
        <label className='text-sm font-medium mb-1.5 flex items-center gap-1.5' htmlFor={id}>
          <ImagePlus className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
          {t('ecommerceShowcase.productImage')}
        </label>
        {uploadError && (
          <div className='mb-2 text-xs text-red-400' role='alert' aria-live='polite'>
            {uploadError}
          </div>
        )}
        <input id={id} ref={inputRef} type='file' accept='image/*' className='hidden' onChange={handleUpload} />
        {config.productImage ? (
          <div
            className='relative group rounded-xl overflow-hidden border border-[var(--juhe-border)]'
            style={{ aspectRatio: '4/3' }}
          >
            <img
              src={config.productImage}
              alt={t('ecommerceShowcase.productImageAlt')}
              className='w-full h-full object-cover'
            />
            <button
              type='button'
              onClick={() => setConfig({ productImage: undefined })}
              aria-label={t('common.remove')}
              className='absolute top-2 right-2 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          </div>
        ) : (
          <button
            type='button'
            onClick={() => inputRef.current?.click()}
            className='w-full rounded-xl border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/40 flex flex-col items-center justify-center gap-2 text-[var(--juhe-text-3)]'
            style={{ aspectRatio: '4/3' }}
          >
            <Upload className='w-8 h-8' />
            <span className='text-xs'>{t('common.upload')}</span>
          </button>
        )}
      </div>

      {config.productImage && (
        <>
          <div className='grid grid-cols-1 gap-2'>
            <select
              aria-label={t('ecommerceShowcase.platform')}
              className='w-full px-2 py-1.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm'
              value={config.platform ?? ''}
              onChange={(e) => setConfig({ platform: e.target.value as (typeof PLATFORMS)[number] })}
            >
              <option value=''>{t('ecommerceShowcase.platform')}</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              aria-label={t('ecommerceShowcase.market')}
              className='w-full px-2 py-1.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm'
              value={config.market ?? ''}
              onChange={(e) => setConfig({ market: e.target.value as (typeof MARKETS)[number] })}
            >
              <option value=''>{t('ecommerceShowcase.market')}</option>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              aria-label={t('ecommerceShowcase.language')}
              className='w-full px-2 py-1.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm'
              value={config.language ?? ''}
              onChange={(e) => setConfig({ language: e.target.value as (typeof LANGUAGES)[number] })}
            >
              <option value=''>{t('ecommerceShowcase.language')}</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={config.productText ?? ''}
            onChange={(e) => setConfig({ productText: e.target.value })}
            placeholder={t('ecommerceShowcase.productText')}
            rows={3}
            className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm resize-none'
          />
        </>
      )}

      {setupDone && currentStep === 'selling_points' && (
        <div className='space-y-2'>
          <div className='text-sm font-medium flex items-center gap-1.5'>
            <Wand2 className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
            {t('ecommerceShowcase.visionModel')}
          </div>
          <TaskModelSelector
            capabilities={['vision', 'chat']}
            capabilityMode='all'
            providerId={config.visionChatProviderId ?? ''}
            model={config.visionChatModelId ?? ''}
            onChange={({ providerId, model }) =>
              setConfig({ visionChatProviderId: providerId, visionChatModelId: model })
            }
          />
        </div>
      )}

      {sellingPointsDone && (currentStep === 'plan' || currentStep === 'images') && (
        <div>
          <div className='text-sm font-medium mb-1.5 flex items-center gap-1.5'>
            <LayoutGrid className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
            {t('ecommerceShowcase.modules')}
          </div>
          <div className='flex flex-wrap gap-2'>
            {MODULE_TYPES.map((m) => {
              const selected = config.modules?.includes(m.id) ?? false
              const label = getModuleLabel(m, language)
              return (
                <button
                  key={m.id}
                  type='button'
                  onClick={() => toggleModule(m.id)}
                  title={label.description}
                  aria-pressed={selected}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                    selected
                      ? 'bg-[var(--juhe-cyan)] text-white'
                      : 'bg-[var(--juhe-void-2)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                  }`}
                >
                  {label.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {planDone && currentStep === 'images' && (
        <div className='space-y-2'>
          <div className='text-sm font-medium flex items-center gap-1.5'>
            <Wand2 className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
            {t('ecommerceShowcase.imageModel')}
          </div>
          <TaskModelSelector
            capabilities={['image']}
            providerId={config.imageProviderId ?? ''}
            model={config.imageModelId ?? ''}
            onChange={({ providerId, model }) => setConfig({ imageProviderId: providerId, imageModelId: model })}
          />
        </div>
      )}

      {!setupDone && currentStep === 'selling_points' && config.productImage && (
        <div className='rounded-xl border border-dashed border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30 px-3 py-3 text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceShowcase.locked.setup')}
        </div>
      )}
      {currentStep === 'plan' && !sellingPointsDone && (
        <div className='rounded-xl border border-dashed border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30 px-3 py-3 text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceShowcase.locked.plan')}
        </div>
      )}
      {currentStep === 'images' && !planDone && (
        <div className='rounded-xl border border-dashed border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30 px-3 py-3 text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceShowcase.locked.images')}
        </div>
      )}

      {currentStep === 'images' && planDone && config.modules && config.modules.length > 0 && (
        <div className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/40 p-3 text-xs text-[var(--juhe-text-3)] space-y-2'>
          <div className='font-medium text-[var(--juhe-text)]'>{t('ecommerceShowcase.placeholderTipTitle')}</div>
          <p>{t('ecommerceShowcase.placeholderTipDesc')}</p>
          <p>{t('ecommerceShowcase.placeholderCount', { count: config.modules.length })}</p>
        </div>
      )}

      {currentStep === 'images' && unsafeModules.length > 0 && (
        <div
          className='rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2'
          role='alert'
          aria-live='polite'
        >
          <div className='font-medium text-amber-100'>{t('ecommerceShowcase.safety.precheckTitle')}</div>
          <p>{t('ecommerceShowcase.safety.precheckDesc')}</p>
          <p>{t('ecommerceShowcase.safety.unsafeModules', { modules: unsafeModuleTitles })}</p>
        </div>
      )}

      {currentStep === 'images' && imageTaskCount > 0 && (
        <div className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/40 p-3 text-xs text-[var(--juhe-text-3)]'>
          {t('ecommerceShowcase.replacingCards', { count: imageTaskCount })}
        </div>
      )}

      {/* Generate */}
      <div className='mt-auto'>
        <div className='text-xs text-[var(--juhe-text-3)] mb-1'>
          {t('ecommerceShowcase.estimatedCost')}: {cost} pt
        </div>
        <button
          type='button'
          onClick={handleGenerate}
          disabled={!canGenerate}
          className='w-full py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white disabled:opacity-50'
        >
          {loading[currentStep] ? t('common.loading') : t(`ecommerceShowcase.actions.generate.${currentStep}`)}
        </button>
      </div>
    </div>
  )
}

function ProgressRow({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'text-[var(--juhe-cyan)]' : 'text-[var(--juhe-text-3)]'}`}>
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center border ${
          done
            ? 'border-[var(--juhe-emerald)] bg-[var(--juhe-emerald)]/10 text-[var(--juhe-emerald)]'
            : active
              ? 'border-[var(--juhe-cyan)]'
              : 'border-[var(--juhe-border)]'
        }`}
      >
        {done && <CheckCircle2 className='w-3 h-3' />}
      </span>
      <span>{label}</span>
    </div>
  )
}
