import { useProviderStore } from '@renderer/stores/providers'
import { ProviderDetail } from './ProviderDetail'
import { ProviderForm } from './ProviderForm'
import { ProviderList } from './ProviderList'
import ProviderSettingsPage from './ProviderSettingsPage'

export function ProviderManager({ isOnboarding = false }: { isOnboarding?: boolean }) {
  const error = useProviderStore((s) => s.error)
  const clearError = useProviderStore((s) => s.clearError)

  return (
    <div className='relative flex h-full w-full overflow-hidden rounded-xl border border-[var(--juhe-border)]'>
      {error && (
        <div className='absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-[var(--juhe-magenta)]/10 px-4 py-2 text-sm text-[var(--juhe-magenta)] shadow'>
          {error}
          <button type='button' onClick={clearError} className='hover:opacity-70' aria-label='Dismiss'>
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>
      )}
      <ProviderSettingsPage isOnboarding={isOnboarding} />
    </div>
  )
}

export { ProviderList, ProviderForm, ProviderDetail }
export { LoadBalancePanel } from './LoadBalancePanel'
