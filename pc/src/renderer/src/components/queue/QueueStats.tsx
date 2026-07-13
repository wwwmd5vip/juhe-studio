import type { QueueState } from '@shared/types/generation'
import { useTranslation } from 'react-i18next'

const STAT_KEYS = [
  { key: 'runningCount', labelKey: 'queue.stats.running', color: 'text-[var(--juhe-cyan)]' },
  { key: 'pendingCount', labelKey: 'queue.stats.waiting', color: 'text-[var(--juhe-text-3)]' },
  { key: 'completedCount', labelKey: 'queue.stats.completed', color: 'text-[var(--juhe-emerald)]' },
  { key: 'failedCount', labelKey: 'queue.stats.failed', color: 'text-[var(--juhe-magenta)]' },
  { key: 'cancelledCount', labelKey: 'queue.stats.cancelled', color: 'text-[var(--juhe-amber)]' }
] as const

export function QueueStats({ state }: { state: QueueState | null }) {
  const { t } = useTranslation()
  if (!state) return null

  return (
    <div className='flex gap-3 mt-2'>
      {STAT_KEYS.map(({ key, labelKey, color }) => (
        <div key={labelKey} className='flex items-center gap-1 text-xs'>
          <span className='text-[var(--juhe-text-3)]'>{t(labelKey)}:</span>
          <span className={`font-medium ${color}`}>{state[key]}</span>
        </div>
      ))}
    </div>
  )
}
