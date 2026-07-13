import { Loader2, RotateCcw, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TaskStatusCardProps {
  isLoading: boolean
  error: string | null
  onRetry?: () => void
  onCancel?: () => void
  title?: string
}

export function TaskStatusCard({ isLoading, error, onRetry, onCancel, title }: TaskStatusCardProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 text-sm text-[var(--juhe-text-3)]'>
        <Loader2 className='w-4 h-4 animate-spin' />
        {t('common.loading')}
        {onCancel && (
          <button
            type='button'
            onClick={onCancel}
            className='ml-2 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400'
          >
            <Square className='w-3 h-3 inline mr-1' />
            {t('common.cancel')}
          </button>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className='p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400'
        role='alert'
        aria-live='polite'
        aria-atomic='true'
      >
        {title && <div className='mb-1 text-xs uppercase tracking-wide text-red-300/80'>{title}</div>}
        <div className='mb-2'>{error}</div>
        {onRetry && (
          <button
            type='button'
            onClick={onRetry}
            className='px-2 py-1 rounded text-xs bg-red-500/20 hover:bg-red-500/30'
          >
            <RotateCcw className='w-3 h-3 inline mr-1' />
            {t('common.retry')}
          </button>
        )}
      </div>
    )
  }

  return null
}
