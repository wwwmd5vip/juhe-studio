import type { PromptOptimizeResult } from '@shared/types/prompt-system'
import type { LucideIcon } from 'lucide-react'
import { Check, Languages, Loader2, Minimize2, Pin, Sparkles, Wand2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { error as toastError } from '@/components/ui/toast'
import { useGenerationStore } from '@/stores/generation'
import { useProviderStore } from '@/stores/providers'
import DiffView from './DiffView'

interface PromptOptimizerProps {
  prompt: string
  onOptimized: (optimized: string) => void
  onQuickOptimize?: () => void
  quickOptimizing?: boolean
}

type OptimizeMode = 'enhance' | 'translate' | 'simplify' | 'creative' | 'expand'

const MODES: { id: OptimizeMode; icon: LucideIcon; labelKey: string }[] = [
  { id: 'enhance', icon: Wand2, labelKey: 'generate.promptOptimizer.modes.enhance' },
  { id: 'translate', icon: Languages, labelKey: 'generate.promptOptimizer.modes.translate' },
  { id: 'simplify', icon: Minimize2, labelKey: 'generate.promptOptimizer.modes.simplify' },
  { id: 'creative', icon: Sparkles, labelKey: 'generate.promptOptimizer.modes.creative' },
  { id: 'expand', icon: Sparkles, labelKey: 'generate.promptOptimizer.modes.expand' }
]

export default function PromptOptimizer({
  prompt,
  onOptimized,
  onQuickOptimize,
  quickOptimizing
}: PromptOptimizerProps) {
  const { t } = useTranslation()
  const { providers, loadProviders } = useProviderStore()
  const { params, setParams } = useGenerationStore()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<OptimizeMode>('enhance')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PromptOptimizeResult | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  // 加载供应商列表 (deferred to avoid blocking initial render)
  useEffect(() => {
    const start = performance.now()
    console.log(`[PromptOptimizer] ⏱️ loadProviders() scheduled at ${start.toFixed(1)}ms`)
    const timer = setTimeout(() => {
      loadProviders()
        .then(() => {
          const end = performance.now()
          console.log(
            `[PromptOptimizer] ⏱️ loadProviders() completed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms)`
          )
        })
        .catch((err) => {
          const end = performance.now()
          console.error(
            `[PromptOptimizer] ⏱️ loadProviders() failed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms):`,
            err
          )
        })
    }, 50)
    return () => clearTimeout(timer)
  }, [loadProviders])

  // 只显示已启用的文本对话供应商
  const availableProviders = useMemo(() => {
    return providers
      .filter((p) => p.isEnabled)
      .filter((p) => {
        const chatTypes = [
          'openai-chat-completions',
          'openai-responses',
          'anthropic-messages',
          'google-generate-content',
          'ollama-chat'
        ]
        return chatTypes.includes(p.type)
      })
      .map((p) => ({
        ...p,
        models: p.models.filter((m) => m.isEnabled)
      }))
      .filter((p) => p.models.length > 0)
  }, [providers])

  // 从全局参数中读取已保存的优化器配置
  const savedProviderId = params.optimizerProviderId
  const savedModel = params.optimizerModel

  // 当前选中的供应商
  const selectedProvider = useMemo(
    () => availableProviders.find((p) => p.id === savedProviderId),
    [availableProviders, savedProviderId]
  )

  // 当前供应商的模型列表
  const availableModels = useMemo(() => selectedProvider?.models || [], [selectedProvider])

  // 当前选择是否已保存为默认
  const isPinned = !!(savedProviderId && savedModel)

  const handleProviderChange = (providerId: string) => {
    const provider = availableProviders.find((p) => p.id === providerId)
    const firstModel = provider?.models[0]?.name
    setParams({
      optimizerProviderId: providerId || undefined,
      optimizerModel: firstModel || undefined
    })
  }

  const handleModelChange = (modelName: string) => {
    setParams({ optimizerModel: modelName || undefined })
  }

  const handlePinToggle = () => {
    if (isPinned) {
      // 取消保存：清空配置
      setParams({
        optimizerProviderId: undefined,
        optimizerModel: undefined
      })
    }
    // "设为默认" 在切换 provider/model 时自动保存，无需额外操作
  }

  const handleOptimize = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setShowDiff(false)
    try {
      const res = await window.api.prompt.optimize({
        prompt,
        mode,
        providerId: savedProviderId || undefined,
        modelId: savedModel || undefined
      })
      setResult(res)
    } catch (err) {
      console.error('Prompt optimization failed:', err)
      toastError({ description: '提示词优化失败，请重试' })
    } finally {
      setLoading(false)
    }
  }

  const handleApply = useCallback(() => {
    if (result?.optimized) {
      onOptimized(result.optimized)
      setResult(null)
      setIsOpen(false)
      setShowDiff(false)
    }
  }, [result, onOptimized])

  const handleDiscard = useCallback(() => {
    setResult(null)
    setShowDiff(false)
  }, [])

  const handleQuickOptimizeClick = () => {
    if (onQuickOptimize) {
      onQuickOptimize()
    }
  }

  // Inline result panel when optimization is done
  if (result && !isOpen) {
    return (
      <div className='space-y-2'>
        {/* Mode tabs */}
        <div className='flex items-center gap-1 flex-wrap'>
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <button
                type='button'
                key={m.id}
                onClick={() => {
                  setMode(m.id)
                  setResult(null)
                  setShowDiff(false)
                }}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                  mode === m.id
                    ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                    : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-3)]'
                }`}
              >
                <Icon className='w-3 h-3' />
                {t(m.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Result card */}
        <div className='rounded-lg border border-[var(--juhe-cyan)]/20 bg-[var(--juhe-cyan)]/5 p-3 space-y-2'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5'>
              <Sparkles className='w-3.5 h-3.5 text-[var(--juhe-cyan)]' />
              <span className='text-xs font-medium text-[var(--juhe-cyan)]'>
                {mode === 'expand' ? t('generate.promptOptimizer.expanded') : t('generate.promptOptimizer.result')}
              </span>
            </div>
            <div className='flex items-center gap-1'>
              <button
                type='button'
                onClick={() => setShowDiff(!showDiff)}
                className='text-[10px] text-[var(--juhe-cyan)] hover:underline px-1.5 py-0.5'
              >
                {showDiff ? t('generate.promptOptimizer.result') : t('generate.promptOptimizer.diff')}
              </button>
              <button
                type='button'
                onClick={handleDiscard}
                className='text-[10px] text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] px-1.5 py-0.5'
              >
                <X className='w-3 h-3' />
              </button>
            </div>
          </div>

          {showDiff ? (
            <DiffView original={prompt} modified={result.optimized} />
          ) : (
            <div className='text-xs max-h-24 overflow-y-auto leading-relaxed'>{result.optimized}</div>
          )}

          <div className='flex gap-2 pt-1'>
            <button
              type='button'
              onClick={handleApply}
              className='flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white rounded-md hover:opacity-90 transition-colors'
            >
              <Check className='w-3 h-3' />
              {t('generate.promptOptimizer.applyResult')}
            </button>
            <button
              type='button'
              onClick={handleDiscard}
              className='px-3 py-1.5 text-xs bg-[var(--juhe-surface-2)] text-[var(--juhe-text-2)] rounded-md hover:bg-[var(--juhe-surface-3)] transition-colors'
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='relative flex items-center gap-1.5'>
      {/* Quick optimize button */}
      {onQuickOptimize && (
        <button
          type='button'
          onClick={handleQuickOptimizeClick}
          disabled={!prompt.trim() || quickOptimizing}
          className='flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)] rounded-md hover:bg-[var(--juhe-cyan)]/20 disabled:opacity-50 transition-colors'
          title={t('generate.promptOptimizer.quickOptimize')}
        >
          {quickOptimizing ? <Loader2 className='w-3 h-3 animate-spin' /> : <Zap className='w-3 h-3' />}
          {t('generate.promptOptimizer.quickOptimize')}
        </button>
      )}

      {/* Main dropdown button */}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[var(--juhe-surface-2)] text-[var(--juhe-text-2)] rounded-md hover:bg-[var(--juhe-surface-3)] transition-colors'
      >
        <Wand2 className='w-3.5 h-3.5' />
        {t('generate.promptOptimizer.optimize')}
      </button>

      {isOpen && (
        <>
          <button type='button' className='fixed inset-0 z-40 bg-transparent' onClick={() => setIsOpen(false)} />
          <div className='absolute left-0 top-full mt-2 w-80 bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg shadow-lg z-50 p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='text-sm font-medium text-[var(--juhe-text)]'>{t('generate.promptOptimizer.title')}</div>
              {isPinned && (
                <button
                  type='button'
                  onClick={handlePinToggle}
                  className='flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  title={t('generate.modelSelector.unpinDefault')}
                >
                  <Pin className='w-3 h-3' />
                  {t('generate.modelSelector.pinned')}
                </button>
              )}
            </div>

            {/* Mode selector */}
            <div className='flex gap-1 flex-wrap'>
              {MODES.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    type='button'
                    key={m.id}
                    onClick={() => {
                      setMode(m.id)
                      setResult(null)
                      setShowDiff(false)
                    }}
                    className={`flex-1 min-w-[60px] flex items-center justify-center gap-1 py-1.5 text-xs rounded-md transition-colors ${
                      mode === m.id
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)]'
                    }`}
                  >
                    <Icon className='w-3 h-3' />
                    {t(m.labelKey)}
                  </button>
                )
              })}
            </div>

            {/* Provider & Model selector */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <label htmlFor='optimizer-provider' className='text-xs text-[var(--juhe-text-3)]'>{t('generate.modelSelector.provider')}</label>
                {!isPinned && savedProviderId && savedModel && (
                  <span className='text-[10px] text-[var(--juhe-text-3)]'>{t('generate.modelSelector.autoSaved')}</span>
                )}
              </div>
              <select
                id='optimizer-provider'
                value={savedProviderId || ''}
                onChange={(e) => handleProviderChange(e.target.value)}
                className='w-full px-2 py-1.5 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-[var(--juhe-text)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              >
                <option value=''>{t('generate.modelSelector.selectProvider')}</option>
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {savedProviderId && (
                <>
                  <label htmlFor='optimizer-model' className='text-xs text-[var(--juhe-text-3)]'>{t('generate.modelSelector.model')}</label>
                  <select
                    id='optimizer-model'
                    value={savedModel || ''}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className='w-full px-2 py-1.5 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-[var(--juhe-text)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                  >
                    <option value=''>{t('generate.modelSelector.selectModel')}</option>
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.displayName || m.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Original preview */}
            <div className='text-xs text-[var(--juhe-text-3)] line-clamp-2 bg-[var(--juhe-surface-2)] rounded-md px-2 py-1.5'>
              {prompt || t('generate.promptOptimizer.placeholder')}
            </div>

            {/* Optimize button */}
            <button
              type='button'
              onClick={handleOptimize}
              disabled={!prompt.trim() || loading}
              className='w-full flex items-center justify-center gap-2 py-2 text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-colors'
            >
              {loading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <Wand2 className='w-3.5 h-3.5' />}
              {loading ? t('generate.promptOptimizer.optimizing') : t('generate.promptOptimizer.startOptimize')}
            </button>

            {/* Result */}
            {result && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='text-xs font-medium text-[var(--juhe-text-3)]'>
                    {mode === 'expand' ? t('generate.promptOptimizer.expanded') : t('generate.promptOptimizer.result')}
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowDiff(!showDiff)}
                    className='text-xs text-[var(--juhe-cyan)] hover:underline'
                  >
                    {showDiff ? t('generate.promptOptimizer.result') : t('generate.promptOptimizer.diff')}
                  </button>
                </div>

                {showDiff ? (
                  <DiffView original={prompt} modified={result.optimized} />
                ) : (
                  <div className='text-xs bg-[var(--juhe-cyan)]/5 border border-[var(--juhe-cyan)]/20 rounded-md px-2 py-1.5 max-h-24 overflow-y-auto text-[var(--juhe-text)]'>
                    {result.optimized}
                  </div>
                )}

                <button
                  type='button'
                  onClick={handleApply}
                  className='w-full flex items-center justify-center gap-1 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors'
                >
                  <Check className='w-3 h-3' />
                  {t('generate.promptOptimizer.applyResult')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
