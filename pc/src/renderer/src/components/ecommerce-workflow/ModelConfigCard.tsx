import type { WorkflowStepConfig } from '@shared/ecommerce-workflow/types'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { TaskModelSelector, type TaskModelSelectorValue } from '@/components/common/TaskModelSelector'

interface ModelConfigCardProps {
  config: WorkflowStepConfig
  onChange: (config: WorkflowStepConfig) => void
  capabilities: string[]
  disabled?: boolean
  hideSystemPrompt?: boolean
}

export function ModelConfigCard({ config, onChange, capabilities, disabled, hideSystemPrompt }: ModelConfigCardProps) {
  const { t } = useTranslation()
  const systemPromptId = useId()
  const temperatureId = useId()

  const handleModelChange = (value: TaskModelSelectorValue) => {
    onChange({ ...config, providerId: value.providerId, modelId: value.model })
  }

  return (
    <div className='space-y-3 p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)]'>
      <TaskModelSelector
        providerId={config.providerId}
        model={config.modelId}
        capabilities={capabilities}
        onChange={handleModelChange}
        disabled={disabled}
      />
      {!hideSystemPrompt && (
        <div>
          <label htmlFor={systemPromptId} className='block text-xs font-medium mb-1'>
            {t('ecommerceWorkflow.systemPrompt')}
          </label>
          <textarea
            id={systemPromptId}
            value={config.systemPrompt}
            onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
            disabled={disabled}
            rows={3}
            className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)] disabled:opacity-50'
          />
        </div>
      )}
      <div className='flex items-center gap-3'>
        <label htmlFor={temperatureId} className='text-xs font-medium'>
          {t('ecommerceWorkflow.temperature')}
        </label>
        <input
          id={temperatureId}
          type='number'
          min={0}
          max={2}
          step={0.1}
          value={config.temperature ?? 0.7}
          onChange={(e) => {
            const value = parseFloat(e.target.value)
            onChange({ ...config, temperature: Number.isNaN(value) ? config.temperature : value })
          }}
          disabled={disabled}
          className='w-20 px-2 py-1 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-sm disabled:opacity-50'
        />
      </div>
    </div>
  )
}
