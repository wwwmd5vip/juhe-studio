import type { GenerationTask, QueueState } from '@shared/types/generation'
import { createFileRoute } from '@tanstack/react-router'
import { Filter, Gauge, Layers, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SkeletonRows } from '@/components/Skeleton'
import { error as toastError } from '@/components/ui/toast'
import { TaskRow } from '@/components/queue/TaskRow'
import { ImageZoomModal } from '@/components/queue/ImageZoomModal'
import { QueueStats } from '@/components/queue/QueueStats'
import { statusConfig, FILTER_OPTIONS, CONCURRENT_OPTIONS } from '@/components/queue/utils'
import type { FilterStatus } from '@/components/queue/utils'

export const Route = createFileRoute('/queue')({
  component: QueuePage
})

function QueuePage() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [queueState, setQueueState] = useState<QueueState | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [taskList, state] = await Promise.all([
        window.api.generation.list(),
        window.api.queue.getState()
      ])
      setTasks(taskList as GenerationTask[])
      setQueueState(state as QueueState)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to load queue data:', error)
      toastError({ title: t('queue.title'), description: message })
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
    const removeStateListener = window.api.queue.onStateChange((_event, state) => {
      setQueueState(state as QueueState)
      window.api.generation.list().then((list) => setTasks(list as GenerationTask[]))
    })
    const removeProgressListener = window.api.generation.onProgress((_event, data) => {
      const { taskId, status, progress, stage } = data as { taskId: string; status: string; progress: number; stage: string }
      setTasks((prev) => prev.map((t) =>
        t.id === taskId ? { ...t, status: status as GenerationTask['status'], progress, stage } : t
      ))
    })
    const removeProgressBatchListener = window.api.generation.onProgressBatch((_event, data) => {
      const batch = data as { taskId: string; status: string; progress: number; stage: string }[]
      setTasks((prev) => prev.map((task) => {
        const p = batch.find((b) => b.taskId === task.id)
        return p ? { ...task, status: p.status as GenerationTask['status'], progress: p.progress, stage: p.stage } : task
      }))
    })
    return () => {
      removeStateListener()
      removeProgressListener()
      removeProgressBatchListener()
    }
  }, [loadData])

  const filteredTasks = useMemo(
    () => filter === 'all' ? tasks : tasks.filter((t) => t.status === filter),
    [tasks, filter]
  )

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredTasks.map((t) => t.id)) : new Set())
  }

  const batchAction = async (action: 'cancel' | 'retry' | 'delete') => {
    if (selectedIds.size === 0) return
    await window.api.queue.batchAction({ taskIds: Array.from(selectedIds), action })
    setSelectedIds(new Set())
    loadData()
  }

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId))
  }

  const handleSingleAction = async (taskId: string, action: 'retry' | 'cancel' | 'delete') => {
    switch (action) {
      case 'retry':
        await window.api.queue.retry(taskId)
        break
      case 'cancel':
        await window.api.generation.cancel(taskId)
        break
      case 'delete':
        await window.api.queue.delete(taskId)
        break
    }
    loadData()
  }

  const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id))

  return (
    <div className='h-full flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='px-4 py-2 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Layers className='w-4 h-4 text-[var(--juhe-cyan)]' />
            <h1 className='text-base font-bold'>{t('queue.title')}</h1>
            {queueState && (
              <span className='text-[11px] text-[var(--juhe-text-3)]'>
                {t('queue.taskCount', { count: queueState.totalTasks })}
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {queueState?.isPaused ? (
              <ResumeBtn onClick={async () => { await window.api.queue.resume() }} t={t} />
            ) : (
              <PauseBtn onClick={async () => { await window.api.queue.pause() }} t={t} />
            )}
            <ConcurrentControl state={queueState} onChange={async (v) => { await window.api.queue.setConcurrent(v) }} t={t} />
            <ClearBtn onClick={async () => { await window.api.queue.cleanup(); loadData() }} t={t} />
          </div>
        </div>
        <QueueStats state={queueState} />
      </div>

      {/* Filters & Batch Actions */}
      <div className='px-4 py-1.5 border-b border-[var(--juhe-border)] flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <Filter className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
          {FILTER_OPTIONS.map((s) => (
            <button
              type='button'
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                filter === s
                  ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                  : 'bg-[var(--juhe-void-3)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
              }`}
            >
              {s === 'all' ? t('queue.filters.all') : t(statusConfig[s]?.labelKey || s)}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <BatchActions
            count={selectedIds.size}
            onRetry={() => batchAction('retry')}
            onCancel={() => batchAction('cancel')}
            onDelete={() => batchAction('delete')}
            t={t}
          />
        )}
      </div>

      {/* Task List */}
      <div className='flex-1 overflow-auto'>
        {isLoading ? (
          <div className='px-6 py-4 space-y-2'>
            <SkeletonRows count={8} className='h-8 w-full rounded' />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-[var(--juhe-text-3)]'>
            <Layers className='w-12 h-12 mb-3 opacity-30' />
            <p>{t('queue.empty.noTasks')}</p>
          </div>
        ) : (
          <table className='w-full'>
            <thead className='sticky top-0 bg-[var(--juhe-void-2)] z-10'>
              <tr className='border-b border-[var(--juhe-border)] text-left text-[10px] text-[var(--juhe-text-3)]'>
                <th className='pl-4 pr-1.5 py-1 w-6'>
                  <input
                    type='checkbox'
                    checked={allSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className='rounded border-[var(--juhe-border)] scale-90'
                  />
                </th>
                <th className='px-1.5 py-1'>{t('queue.tableHeaders.task')}</th>
                <th className='px-1.5 py-1 w-[60px]'>{t('queue.tableHeaders.type')}</th>
                <th className='px-1.5 py-1 w-[54px]'>{t('queue.tableHeaders.priority')}</th>
                <th className='px-1.5 py-1 w-[74px]'>{t('queue.tableHeaders.status')}</th>
                <th className='px-1.5 py-1 w-[88px]'>{t('queue.tableHeaders.progress')}</th>
                <th className='px-1.5 py-1 w-[52px]'>{t('queue.tableHeaders.time')}</th>
                <th className='px-1.5 py-1 w-[56px]'>{t('queue.tableHeaders.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedIds.has(task.id)}
                  isExpanded={expandedTaskId === task.id}
                  onToggleExpand={() => toggleTaskExpand(task.id)}
                  onToggleSelect={toggleSelect}
                  onZoomImage={setZoomImage}
                  onRetry={(id) => handleSingleAction(id, 'retry')}
                  onCancel={(id) => handleSingleAction(id, 'cancel')}
                  onDelete={(id) => handleSingleAction(id, 'delete')}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {zoomImage && <ImageZoomModal imageUrl={zoomImage} onClose={() => setZoomImage(null)} />}
    </div>
  )
}

/** Header buttons — small inline components to reduce nesting in QueuePage */
function ResumeBtn({ onClick, t }: { onClick: () => void; t: (k: string) => string }) {
  return (
    <button type='button' onClick={onClick}
      className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'>
      <Play className='w-3.5 h-3.5' />{t('queue.resumeQueue')}
    </button>
  )
}

function PauseBtn({ onClick, t }: { onClick: () => void; t: (k: string) => string }) {
  return (
    <button type='button' onClick={onClick}
      className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80 transition-colors'>
      <Pause className='w-3.5 h-3.5' />{t('queue.pauseQueue')}
    </button>
  )
}

function ConcurrentControl({ state, onChange, t }: { state: QueueState | null; onChange: (v: number) => void; t: (k: string) => string }) {
  return (
    <div className='flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--juhe-void-3)]'>
      <Gauge className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
      <span className='text-xs text-[var(--juhe-text-3)]'>{t('queue.concurrent')}:</span>
      <select
        value={state?.maxConcurrent ?? 2}
        onChange={(e) => onChange(Number(e.target.value))}
        className='text-xs bg-transparent border-none outline-none cursor-pointer'
      >
        {CONCURRENT_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  )
}

function ClearBtn({ onClick, t }: { onClick: () => void; t: (k: string) => string }) {
  return (
    <button type='button' onClick={onClick}
      className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80 transition-colors'>
      <Trash2 className='w-3.5 h-3.5' />{t('queue.clearCompleted')}
    </button>
  )
}

function BatchActions({ count, onRetry, onCancel, onDelete, t }: {
  count: number
  onRetry: () => void
  onCancel: () => void
  onDelete: () => void
  t: (k: string, options?: Record<string, unknown>) => string
}) {
  return (
    <div className='flex items-center gap-2'>
      <span className='text-sm text-[var(--juhe-text-3)]'>{t('common.selectedCount', { count })}</span>
      <button type='button' onClick={onRetry}
        className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'>
        <RotateCcw className='w-3.5 h-3.5' />{t('queue.actions.retry')}
      </button>
      <button type='button' onClick={onCancel}
        className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80 transition-colors'>
        <X className='w-3.5 h-3.5' />{t('queue.actions.cancel')}
      </button>
      <button type='button' onClick={onDelete}
        className='flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[var(--juhe-magenta)] text-white hover:bg-[var(--juhe-magenta)]/90 transition-colors'>
        <Trash2 className='w-3.5 h-3.5' />{t('common.delete')}
      </button>
    </div>
  )
}
