/**
 * Web Search Toggle Button for ChatInput toolbar
 */

import { Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWebSearchStore } from '@/stores/websearch'

interface WebSearchButtonProps {
  disabled?: boolean
}

export function WebSearchButton({ disabled }: WebSearchButtonProps) {
  const { t } = useTranslation()
  const { isEnabled, isSearching, providers, toggleSearch } = useWebSearchStore()

  const enabledProvider = providers.find((p) => p.isEnabled !== false)
  const hasProviders = providers.length > 0

  const handleClick = () => {
    if (!hasProviders) return
    toggleSearch(!isEnabled)
  }

  const tooltipText = !hasProviders
    ? t('websearch.configureProvider')
    : isEnabled
      ? `${t('websearch.disable')} (${enabledProvider?.name || ''})`
      : `${t('websearch.enable')} (${enabledProvider?.name || ''})`

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={disabled || isSearching}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        isEnabled && hasProviders
          ? 'text-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 hover:bg-[var(--juhe-cyan)]/20'
          : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]'
      }`}
      title={tooltipText}
    >
      {isSearching ? <Loader2 className='w-4 h-4 animate-spin' /> : <Search className='w-4 h-4' />}
    </button>
  )
}
