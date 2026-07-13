import { DEFAULT_AGENT_PROMPT_ID } from '@shared/ecommerce-workflow/constants'
import { ASPECT_RATIOS, LANGUAGES, MARKETS, PLATFORMS } from '@shared/ecommerce-workflow/enums'
import { AGENT_PROMPTS } from '@shared/ecommerce-workflow/prompts/agent-prompts'
import type { WorkflowStepState, WorkflowTemplateStep } from '@shared/ecommerce-workflow/types'
import { Upload, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { StepCard } from '../StepCard'

interface InputStepCardProps {
  step: WorkflowTemplateStep
  stepState: WorkflowStepState
  workflowId: string
}

export function InputStepCard({ step, stepState }: InputStepCardProps) {
  const { t } = useTranslation()
  const { currentWorkflow, updateCurrentContext, saveProductImage, updateWorkflow, updatePlatformRatio } =
    useEcommerceWorkflowStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const imageId = useId()
  const textId = useId()
  const agentPromptId = useId()
  const imageCountId = useId()

  const context = currentWorkflow?.context
  const isAgentPoster = currentWorkflow?.templateId === 'agent-poster'

  const affectedBackendSteps = ['copy', 'module-recommend', 'module-generate']
  const isAffectedStepRunning =
    currentWorkflow?.templateId === 'product-detail-page' &&
    affectedBackendSteps.some((id) => currentWorkflow.steps.find((s) => s.id === id)?.status === 'running')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target.value) {
      e.target.value = ''
    }
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      setIsUploading(true)
      try {
        const path = await saveProductImage(reader.result as string, file.name)
        if (!path) return
        updateCurrentContext({ productImage: path })
        const workflow = useEcommerceWorkflowStore.getState().currentWorkflow
        if (workflow) {
          updateWorkflow(workflow.id, { context: { ...workflow.context, productImage: path } })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        useEcommerceWorkflowStore.setState({ error: message })
      } finally {
        setIsUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveContext = () => {
    if (!currentWorkflow) return
    updateWorkflow(currentWorkflow.id, { context: currentWorkflow.context })
  }

  if (!context) return null

  return (
    <StepCard step={step} stepState={stepState}>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <span className='text-sm font-medium'>{t('ecommerceWorkflow.productImage')}</span>
          <div
            className='relative group w-full rounded-xl border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/40 transition-colors overflow-hidden'
            style={{ aspectRatio: '4/3' }}
          >
            <input
              ref={inputRef}
              id={imageId}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={handleUpload}
            />
            {context.productImage ? (
              <>
                <button
                  type='button'
                  aria-label={t('ecommerceWorkflow.productImage')}
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading}
                  className='w-full h-full'
                >
                  <img
                    src={context.productImage}
                    alt={t('ecommerceWorkflow.productImage')}
                    className='w-full h-full object-cover'
                  />
                </button>
                <button
                  type='button'
                  aria-label={t('common.remove')}
                  onClick={() => {
                    if (inputRef.current) {
                      inputRef.current.value = ''
                    }
                    updateCurrentContext({ productImage: undefined })
                    const workflow = useEcommerceWorkflowStore.getState().currentWorkflow
                    if (workflow) {
                      const { productImage: _, ...context } = workflow.context
                      updateWorkflow(workflow.id, { context })
                    }
                  }}
                  className='absolute top-2 right-2 z-10 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              </>
            ) : (
              <button
                type='button'
                aria-label={t('common.upload')}
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className='absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--juhe-text-3)]'
              >
                <Upload className='w-8 h-8' />
                <span className='text-xs'>{isUploading ? t('common.loading') : t('common.upload')}</span>
              </button>
            )}
          </div>
        </div>

        <div className='space-y-3'>
          <div>
            <label htmlFor={textId} className='text-sm font-medium'>
              {t('ecommerceWorkflow.productText')}
            </label>
            <textarea
              id={textId}
              value={context.productText ?? ''}
              onChange={(e) => updateCurrentContext({ productText: e.target.value })}
              onBlur={handleSaveContext}
              rows={4}
              className='w-full mt-1 px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
            />
          </div>

          {isAgentPoster && (
            <>
              <div>
                <label htmlFor={agentPromptId} className='block text-xs font-medium mb-1'>
                  {t('ecommerceWorkflow.agent.agentPrompt')}
                </label>
                <select
                  id={agentPromptId}
                  value={context.agentPromptId ?? DEFAULT_AGENT_PROMPT_ID}
                  onChange={(e) => updateCurrentContext({ agentPromptId: e.target.value })}
                  onBlur={handleSaveContext}
                  className='w-full px-2 py-1.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
                >
                  {Object.keys(AGENT_PROMPTS).map((id) => (
                    <option key={id} value={id}>
                      {AGENT_PROMPTS[id].name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={imageCountId} className='block text-xs font-medium mb-1'>
                  {t('ecommerceWorkflow.agent.imageCount')}: {context.imageCount ?? 3}
                </label>
                <input
                  id={imageCountId}
                  type='range'
                  min={1}
                  max={6}
                  value={context.imageCount ?? 3}
                  onChange={(e) => updateCurrentContext({ imageCount: parseInt(e.target.value, 10) })}
                  onBlur={handleSaveContext}
                  className='w-full'
                />
              </div>
            </>
          )}

          {!isAgentPoster && (
            <div className='grid grid-cols-2 gap-3'>
              <SelectField
                label={t('ecommerceWorkflow.platform')}
                value={context.platform ?? PLATFORMS[0]}
                options={PLATFORMS}
                disabled={isAffectedStepRunning}
                onChange={(platform) => {
                  if (currentWorkflow?.templateId === 'product-detail-page') {
                    updatePlatformRatio(platform)
                  } else {
                    updateCurrentContext({ platform })
                    const workflow = useEcommerceWorkflowStore.getState().currentWorkflow
                    if (workflow) {
                      updateWorkflow(workflow.id, { context: { ...workflow.context, platform } })
                    }
                  }
                }}
                onBlur={handleSaveContext}
              />
              <SelectField
                label={t('ecommerceWorkflow.market')}
                value={context.market ?? 'us'}
                options={MARKETS}
                onChange={(market) => updateCurrentContext({ market })}
                onBlur={handleSaveContext}
              />
              <SelectField
                label={t('ecommerceWorkflow.language')}
                value={context.language ?? 'en'}
                options={LANGUAGES}
                onChange={(language) => updateCurrentContext({ language })}
                onBlur={handleSaveContext}
              />
              <SelectField
                label={t('ecommerceWorkflow.ratio')}
                value={context.ratio ?? '1:1'}
                options={ASPECT_RATIOS}
                onChange={(ratio) => {
                  updateCurrentContext({ ratio, ratioManuallySet: true })
                  const workflow = useEcommerceWorkflowStore.getState().currentWorkflow
                  if (workflow) {
                    updateWorkflow(workflow.id, {
                      context: { ...workflow.context, ratio, ratioManuallySet: true }
                    })
                  }
                }}
                onBlur={handleSaveContext}
              />
            </div>
          )}
        </div>
      </div>
    </StepCard>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  onBlur,
  disabled
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  onBlur?: () => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className='block text-xs font-medium mb-1'>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        onBlur={onBlur}
        disabled={disabled}
        className='w-full px-2 py-1.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)] disabled:opacity-50'
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}
