import type { GenerationTask } from '@shared/types/generation'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, X, RotateCcw, Trash2 } from 'lucide-react'
import { statusConfig, priorityConfig, getTaskTypeLabel, formatDuration, formatTime } from './utils'
import { TaskDetailPanel } from './TaskDetailPanel'

interface TaskRowProps {
  task: GenerationTask
  isSelected: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleSelect: (id: string, checked: boolean) => void
  onZoomImage: (url: string) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}

export function TaskRow({ task, isSelected, isExpanded, onToggleExpand, onToggleSelect, onZoomImage, onRetry, onCancel, onDelete }: TaskRowProps) {
  const { t } = useTranslation()
  const status = statusConfig[task.status] || statusConfig.pending
  const priority = priorityConfig[task.priority] || priorityConfig.normal
  const modelLabel = task.params.model || t('queue.taskInfo.defaultModel')

  return (
    <>
      <tr
        className='border-b border-[var(--juhe-border)]/50 hover:bg-white/[0.03]/50 transition-colors cursor-pointer'
        onClick={onToggleExpand}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
        <td className='pl-4 pr-1.5 py-1 w-6' onClick={(e) => e.stopPropagation()}>
          <input
            type='checkbox'
            checked={isSelected}
            onChange={(e) => onToggleSelect(task.id, e.target.checked)}
            className='rounded border-[var(--juhe-border)] scale-90'
          />
        </td>
        <td className='px-1.5 py-1'>
          <div className='flex items-center gap-1 min-w-0 max-w-[240px]'>
            {isExpanded
              ? <ChevronDown className='w-2.5 h-2.5 text-[var(--juhe-text-3)] shrink-0' />
              : <ChevronRight className='w-2.5 h-2.5 text-[var(--juhe-text-3)] shrink-0' />}
            <span className='text-[11px] truncate' title={task.params.prompt}>
              {task.params.prompt || t('queue.taskInfo.noPrompt')}
            </span>
            <span className='text-[9px] text-[var(--juhe-text-3)]/60 shrink-0 hidden sm:inline' title={modelLabel}>
              {modelLabel}
            </span>
          </div>
        </td>
        <td className='px-1.5 py-1 w-[60px]'>
          <span className='text-[10px] text-[var(--juhe-text-3)]'>{getTaskTypeLabel(task, t)}</span>
        </td>
        <td className='px-1.5 py-1 w-[54px]'>
          <span className={`inline-flex px-1 py-0 rounded text-[9px] font-medium ${priority.color}`}>
            {t(priority.labelKey)}
          </span>
        </td>
        <td className='px-1.5 py-1 w-[74px]'>
          <span className={`flex items-center gap-0.5 text-[10px] ${status.color}`}>
            {status.icon}
            {t(status.labelKey)}
          </span>
        </td>
        <td className='px-1.5 py-1 w-[88px]'>
          <TaskProgressCompact task={task} onZoomImage={onZoomImage} t={t} />
        </td>
        <td className='px-1.5 py-1 w-[52px] text-[10px] text-[var(--juhe-text-3)]'>
          {task.startedAt
            ? <span>{formatDuration(task.startedAt, task.completedAt)}</span>
            : <span>{formatTime(task.createdAt)}</span>}
        </td>
        <td className='px-1.5 py-1 w-[56px]'>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          <div className='flex items-center gap-0' onClick={(e) => e.stopPropagation()}>
            {(task.status === 'failed' || task.status === 'cancelled') && (
              <ActionBtn icon={<RotateCcw className='w-3 h-3' />} title={t('queue.actions.retry')} onClick={() => onRetry(task.id)} />
            )}
            {(task.status === 'pending' || task.status === 'paused') && (
              <ActionBtn icon={<X className='w-3 h-3' />} title={t('queue.actions.cancel')} onClick={() => onCancel(task.id)} />
            )}
            {task.status !== 'processing' && (
              <ActionBtn icon={<Trash2 className='w-3 h-3' />} title={t('common.delete')} onClick={() => onDelete(task.id)} danger />
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className='border-b border-[var(--juhe-border)]/50 bg-white/[0.02]/30'>
          <td colSpan={8} className='px-4 py-2.5'>
            <TaskDetailPanel task={task} onZoomImage={onZoomImage} />
          </td>
        </tr>
      )}
    </>
  )
}

function ActionBtn({ icon, title, onClick, danger }: { icon: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type='button' onClick={onClick}
      className={`p-0.5 rounded hover:bg-white/[0.03] transition-colors ${danger ? 'text-[var(--juhe-magenta)]' : ''}`}
      title={title}>
      {icon}
    </button>
  )
}

function TaskProgressCompact({ task, onZoomImage, t }: { task: GenerationTask; onZoomImage: (url: string) => void; t: (key: string) => string }) {
  if (task.status === 'processing' || task.status === 'pending') {
    return (
      <div className='h-1 bg-[var(--juhe-void-3)] rounded-full overflow-hidden'>
        <div
          className='h-full bg-gradient-to-r from-[var(--juhe-cyan)] to-[var(--juhe-violet)] transition-all duration-300'
          style={{ width: `${task.progress}%` }}
        />
      </div>
    )
  }

  if (task.status === 'completed' && task.outputs.length > 0) {
    return (
      <div className='flex items-center gap-0.5'>
        {task.outputs.slice(0, 3).map((output, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
            key={i}
            className='w-5 h-5 rounded overflow-hidden bg-[var(--juhe-void-3)] shrink-0'
          >
            {getOutputThumb(output, () => onZoomImage(getOutputUrl(output)))}
          </div>
        ))}
        {task.outputs.length > 3 && (
          <span className='text-[9px] text-[var(--juhe-text-3)]'>+{task.outputs.length - 3}</span>
        )}
      </div>
    )
  }

  if (task.status === 'failed') {
    return (
      <span className='flex items-center gap-0.5 text-[var(--juhe-magenta)]' title={task.error}>
        <AlertCircle className='w-3 h-3 shrink-0' />
        <span className='text-[10px] truncate'>{t('queue.status.failed')}</span>
      </span>
    )
  }

  return <span className='text-[10px] text-[var(--juhe-text-3)]'>-</span>
}

function getOutputUrl(output: { url?: string; base64?: string; mediaType?: string }): string {
  if (output.url) return output.url
  return `data:${output.mediaType || 'image/png'};base64,${output.base64}`
}

function getOutputThumb(output: { url?: string; base64?: string; mediaType?: string }, onClick: () => void) {
  const src = getOutputUrl(output)
  if (!output.url && !output.base64) {
    return <CheckCircle2 className='w-3.5 h-3.5 text-[var(--juhe-emerald)] m-auto' />
  }
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
    <img
      src={src}
      alt=''
      className='w-full h-full object-cover cursor-pointer'
      loading='lazy'
      onClick={onClick}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}
