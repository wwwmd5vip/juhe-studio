/**
 * 可复用的任务类型模型选择器
 * 根据指定的 capability 过滤可用的 Provider 和模型
 */

import { Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProviderStore } from '@/stores/providers'
import { type CapabilityMode, filterAvailableProviders, isImageCapableModel } from './task-model-selector.utils'

export interface TaskModelSelectorValue {
  providerId: string
  model: string
}

interface TaskModelSelectorProps {
  /** 当前选中的 providerId */
  providerId: string
  /** 当前选中的 model name */
  model: string
  /** 需要模型具备的能力 */
  capabilities: string[]
  /** 能力匹配模式：any 满足任意一个，all 必须全部满足 */
  capabilityMode?: CapabilityMode
  /** 选择变更回调 */
  onChange: (value: TaskModelSelectorValue) => void
  /** 标签类名 */
  className?: string
  /** 是否禁用 */
  disabled?: boolean
}

export function TaskModelSelector({
  providerId,
  model,
  capabilities,
  capabilityMode = 'any',
  onChange,
  className = '',
  disabled = false
}: TaskModelSelectorProps) {
  const { t } = useTranslation()
  const { providers, loadProviders, isLoading } = useProviderStore()

  useEffect(() => {
    const start = performance.now()
    console.log(`[TaskModelSelector] ⏱️ loadProviders() scheduled at ${start.toFixed(1)}ms`)
    const timer = setTimeout(() => {
      loadProviders()
        .then(() => {
          const end = performance.now()
          console.log(
            `[TaskModelSelector] ⏱️ loadProviders() completed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms)`
          )
        })
        .catch((err) => {
          const end = performance.now()
          console.error(
            `[TaskModelSelector] ⏱️ loadProviders() failed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms):`,
            err
          )
        })
    }, 50)
    return () => clearTimeout(timer)
  }, [loadProviders])

  // 过滤出具备指定 capability 的已启用模型
  const availableProviders = useMemo(
    () => filterAvailableProviders(providers, capabilities, capabilityMode),
    [providers, capabilities, capabilityMode]
  )

  // 当前选中的 provider
  const selectedProvider = useMemo(
    () => availableProviders.find((p) => p.id === providerId),
    [availableProviders, providerId]
  )

  const imageCapableProviders = useMemo(
    () => providers.filter((provider) => provider.models.some((model) => isImageCapableModel(model))),
    [providers]
  )

  // 如果当前选择无效，自动选择第一个可用选项
  useEffect(() => {
    if (availableProviders.length === 0) return
    const isValid = selectedProvider?.models.some((m) => m.name === model)
    if (!isValid) {
      const fallbackProvider = availableProviders[0]
      const fallbackModel = fallbackProvider.models[0]
      if (fallbackProvider && fallbackModel) {
        onChange({ providerId: fallbackProvider.id, model: fallbackModel.name })
      }
    }
  }, [availableProviders, selectedProvider, model, onChange])

  const handleProviderChange = (newProviderId: string) => {
    const provider = availableProviders.find((p) => p.id === newProviderId)
    const firstModel = provider?.models[0]
    onChange({
      providerId: newProviderId,
      model: firstModel?.name || ''
    })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className='block text-sm font-medium mb-1.5'>{t('generate.modelSelector.provider')}</label>
        <div className='relative'>
          <select
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={disabled || isLoading}
            className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                       focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)] disabled:opacity-50'
          >
            <option value=''>{isLoading ? t('common.loading') : t('generate.modelSelector.selectProvider')}</option>
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.models.length} models)
              </option>
            ))}
          </select>
          {isLoading && (
            <Loader2 className='absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--juhe-text-3)]' />
          )}
        </div>
        {availableProviders.length === 0 && !isLoading && (
          <div className='mt-2 p-3 rounded-lg bg-[var(--juhe-surface-2)]/50 border border-[var(--juhe-border)]'>
            <p className='text-xs text-[var(--juhe-text-3)]'>{t('generate.modelSelector.noProviders')}</p>
            <p className='text-[10px] text-[var(--juhe-text-3)]/70 mt-1'>
              {capabilities.includes('image')
                ? t('generate.modelSelector.noImageProviders')
                : capabilities.includes('video')
                  ? t('generate.modelSelector.noVideoProviders')
                  : capabilities.includes('tts')
                    ? t('generate.modelSelector.noTtsProviders')
                    : t('generate.modelSelector.noChatProviders')}
            </p>
            {capabilities.includes('image') && imageCapableProviders.length > 0 && (
              <p className='mt-2 text-[10px] text-amber-300/90'>
                {t('generate.modelSelector.imageCapabilityHint', {
                  defaultValue:
                    'These providers can generate images, but are filtered out by the current capability tags: {{count}}',
                  count: imageCapableProviders.length
                })}
              </p>
            )}
          </div>
        )}
      </div>

      {providerId && selectedProvider && (
        <div>
          <label className='block text-sm font-medium mb-1.5'>{t('generate.modelSelector.model')}</label>
          <select
            value={model}
            onChange={(e) => onChange({ providerId, model: e.target.value })}
            disabled={disabled}
            className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                       focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)] disabled:opacity-50'
          >
            <option value=''>{t('generate.modelSelector.selectModel')}</option>
            {selectedProvider.models.map((m) => (
              <option key={m.id} value={m.name}>
                {m.displayName || m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
