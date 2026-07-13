import type { Language } from '@shared/ecommerce-workflow/enums'
import { LANGUAGES } from '@shared/ecommerce-workflow/enums'
import type { ModuleTypeCategory } from '@shared/ecommerce-workflow/module-types'
import {
  getModuleLabel,
  getModuleTypeById,
  getModuleTypesByCategory,
  normalizeModuleId
} from '@shared/ecommerce-workflow/module-types'
import type { WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { StepCard } from '../StepCard'

interface ModuleConfigStepCardProps {
  step: WorkflowTemplateStep
  stepState: WorkflowStepState
  workflowId: string
}

const CATEGORIES: ModuleTypeCategory[] = ['core', 'white', 'usage', 'conversion']

function resolveLanguage(workflowLanguage: Language | undefined, i18nLanguage: string): Language {
  if (workflowLanguage && LANGUAGES.includes(workflowLanguage)) {
    return workflowLanguage
  }
  if (i18nLanguage.startsWith('zh')) {
    return 'zh'
  }
  const base = i18nLanguage.split('-')[0]
  if (LANGUAGES.includes(base as Language)) {
    return base as Language
  }
  return 'en'
}

function parseRecommendedIds(output: string | undefined): string[] {
  if (!output) return []
  try {
    const parsed = JSON.parse(output)
    const raw = Array.isArray(parsed) ? parsed : parsed?.recommendedModules
    if (!Array.isArray(raw)) return []
    return raw
      .map((id) => (typeof id === 'string' ? normalizeModuleId(id) : ''))
      .filter((id): id is string => id.length > 0)
  } catch {
    return []
  }
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

export function ModuleConfigStepCard({ step, stepState }: ModuleConfigStepCardProps) {
  const { t, i18n } = useTranslation()
  const { currentWorkflow, runningStepId, confirmModuleConfig } = useEcommerceWorkflowStore()

  const language = resolveLanguage(currentWorkflow?.context.language, i18n.language)

  const recommendStep = useMemo(
    () => currentWorkflow?.steps.find((s) => s.id === 'module-recommend'),
    [currentWorkflow?.steps]
  )

  const recommendedIds = useMemo(() => parseRecommendedIds(recommendStep?.output), [recommendStep?.output])

  const savedIds = useMemo(
    () => (currentWorkflow?.context.selectedModuleTypes ?? []).map(normalizeModuleId),
    [currentWorkflow?.context.selectedModuleTypes]
  )

  const initialIds = useMemo(() => (savedIds.length > 0 ? savedIds : recommendedIds), [savedIds, recommendedIds])

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds))
  const appliedInitialRef = useRef(initialIds.join(','))

  useEffect(() => {
    const key = initialIds.join(',')
    if (appliedInitialRef.current === key) return
    appliedInitialRef.current = key
    setSelected(new Set(initialIds))
  }, [initialIds])

  if (!currentWorkflow) return null

  const isRecommendRunning = runningStepId === 'module-recommend'
  const baselineIds = savedIds.length > 0 ? savedIds : recommendedIds
  const isDirty = stepState.status !== 'success' || !setsEqual(selected, new Set(baselineIds))

  const toggleModule = (id: string) => {
    const normalized = normalizeModuleId(id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(normalized)) {
        next.delete(normalized)
      } else {
        next.add(normalized)
      }
      return next
    })
  }

  const handleConfirm = async () => {
    if (selected.size === 0) return
    await confirmModuleConfig(step.id, Array.from(selected))
  }

  const confirmButton = (
    <button
      type='button'
      onClick={handleConfirm}
      disabled={selected.size === 0 || isRecommendRunning}
      className='px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] hover:bg-[var(--juhe-cyan)]/30 disabled:opacity-50'
    >
      {t('common.confirm')}
    </button>
  )

  return (
    <StepCard step={step} stepState={stepState} actions={confirmButton}>
      <div className='space-y-4'>
        {isDirty && <div className='text-xs text-amber-400'>{t('ecommerceWorkflow.moduleConfig.dirty')}</div>}

        <div className='space-y-2'>
          <h4 className='text-sm font-semibold'>{t('ecommerceWorkflow.moduleConfig.recommendedTitle')}</h4>
          {isRecommendRunning ? (
            <div className='text-sm text-[var(--juhe-text-3)]'>{t('common.loading')}</div>
          ) : recommendedIds.length > 0 ? (
            <div className='flex flex-wrap gap-2'>
              {recommendedIds.map((id) => {
                const def = getModuleTypeById(id)
                const label = def ? getModuleLabel(def, language) : { name: id, description: '' }
                return (
                  <div
                    key={id}
                    title={label.description}
                    className='px-2 py-1 rounded-md text-xs border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-[var(--juhe-text-3)]'
                  >
                    {label.name}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className='text-sm text-[var(--juhe-text-3)]'>
              {t('ecommerceWorkflow.moduleConfig.noRecommendations')}
            </div>
          )}
        </div>

        <div className='space-y-6'>
          {CATEGORIES.map((category) => {
            const types = getModuleTypesByCategory(category)
            if (types.length === 0) return null
            return (
              <div key={category} className='space-y-2'>
                <h4 className='text-sm font-semibold'>{t(`ecommerceWorkflow.moduleConfig.categories.${category}`)}</h4>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {types.map((def) => {
                    const label = getModuleLabel(def, language)
                    const isSelected = selected.has(def.id)
                    const ratioLabel = t(`generate.aspectRatios.${def.defaultAspectRatio}`)
                    return (
                      <label
                        key={def.id}
                        className='flex items-start gap-2 p-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] cursor-pointer'
                      >
                        <input
                          type='checkbox'
                          checked={isSelected}
                          disabled={isRecommendRunning}
                          onChange={() => toggleModule(def.id)}
                          className='mt-1'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium'>{label.name}</div>
                          <div className='text-xs text-[var(--juhe-text-3)] line-clamp-2'>{label.description}</div>
                          <div className='text-xs text-[var(--juhe-text-3)] mt-1'>
                            {t('ecommerceWorkflow.moduleConfig.suggestedRatio', {
                              ratio: ratioLabel
                            })}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {selected.size === 0 && (
          <div className='text-sm text-red-400'>{t('ecommerceWorkflow.moduleConfig.emptySelection')}</div>
        )}
      </div>
    </StepCard>
  )
}
