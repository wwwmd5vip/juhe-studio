/**
 * BatchPanel — 批量队列生产面板
 * 来源灵感：YunQiao 批量队列、Mirror Studio 任务监控
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, Pause, Play, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { useBatchQueueStore, type BatchItem } from '@/stores/batch-store'
import { useGenerationStore } from '@/stores/generation'

interface BatchPanelProps {
  onClose: () => void
}

export function BatchPanel({ onClose }: BatchPanelProps) {
  const { t } = useTranslation()
  const queue = useBatchQueueStore()
  const createTask = useGenerationStore((s) => s.createTask)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const runningRef = useRef(false)

  const { items, isRunning, concurrency } = queue
  const pendingItems = items.filter((i) => i.status === 'pending')
  const runningItems = items.filter((i) => i.status === 'running')
  const completedItems = items.filter((i) => i.status === 'completed')
  const failedItems = items.filter((i) => i.status === 'failed')

  const processQueue = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true

    while (true) {
      const state = useBatchQueueStore.getState()
      if (!state.isRunning) break

      const pending = state.items.filter((i) => i.status === 'pending')
      const running = state.items.filter((i) => i.status === 'running')

      if (pending.length === 0 && running.length === 0) {
        useBatchQueueStore.setState({ isRunning: false })
        break
      }

      const slots = state.concurrency - running.length
      if (slots <= 0) {
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }

      const toStart = pending.slice(0, slots)
      for (const item of toStart) {
        useBatchQueueStore.getState().updateItem(item.id, { status: 'running', startedAt: Date.now() })
        try {
          const pid = item.providerId
          const mdl = item.model
          if (!pid || !mdl) {
            throw new Error('No provider/model configured')
          }
          const taskId = await createTask('image', {
            prompt: item.prompt,
            providerId: pid,
            model: mdl,
            size: (item.size || '1024x1024') as '1024x1024',
          })
          useBatchQueueStore.getState().updateItem(item.id, { status: 'completed', taskId, finishedAt: Date.now() })
        } catch (err) {
          useBatchQueueStore.getState().updateItem(item.id, {
            status: 'failed',
            error: err instanceof Error ? err.message : 'Generation failed',
            finishedAt: Date.now(),
          })
        }
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    runningRef.current = false
  }, [createTask])

  useEffect(() => {
    if (isRunning && !runningRef.current) {
      processQueue()
    }
  }, [isRunning, processQueue])

  const handleImport = () => {
    const count = queue.importFromJSON(importText)
    if (count > 0) {
      setShowImport(false)
      setImportText('')
    }
  }

  const handleAddManual = () => {
    queue.addItems([{ prompt: '', providerId: '', model: '', size: '1024x1024' }])
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className='w-3.5 h-3.5 text-green-400' />
      case 'running': return <div className='w-3.5 h-3.5 rounded-full border-2 border-[var(--juhe-cyan)] border-t-transparent animate-spin' />
      case 'failed': return <X className='w-3.5 h-3.5 text-red-400' />
      default: return <Circle className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
    }
  }

  return (
    <div className='h-full flex flex-col'>
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <h3 className='text-sm font-semibold text-[var(--juhe-text)]'>{t('generate.batchQueue')}</h3>
        <button onClick={onClose} className='p-1 rounded hover:bg-[var(--juhe-surface)] text-[var(--juhe-text-3)]'>
          <X className='w-4 h-4' />
        </button>
      </div>

      <div className='px-4 py-3 border-b border-[var(--juhe-border)] space-y-2'>
        <div className='flex items-center gap-2 flex-wrap'>
          {!isRunning ? (
            <button
              type='button'
              onClick={() => { if (pendingItems.length > 0) queue.startQueue() }}
              disabled={pendingItems.length === 0}
              className='flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white disabled:opacity-40'
            >
              <Play className='w-3 h-3' /> {t('generate.startProduction')}
            </button>
          ) : (
            <button type='button' onClick={queue.pauseQueue} className='flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-[var(--juhe-amber)]/20 text-[var(--juhe-amber)]'>
              <Pause className='w-3 h-3' /> {t('generate.pause')}
            </button>
          )}
          <button type='button' onClick={handleAddManual} className='flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)]'>
            <Plus className='w-3 h-3' /> {t('generate.add')}
          </button>
          <button type='button' onClick={() => setShowImport(true)} className='flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)]'>
            <Upload className='w-3 h-3' /> {t('generate.importJson')}
          </button>
          {completedItems.length > 0 && (
            <button type='button' onClick={queue.clearCompleted} className='flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)]'>
              <Trash2 className='w-3 h-3' /> {t('generate.clearCompleted')}
            </button>
          )}
        </div>
        <div className='flex items-center gap-3 text-[10px] text-[var(--juhe-text-3)]'>
          <span>{t('generate.total')}: {items.length}</span>
          <span className='text-green-400'>{t('generate.completed')}: {completedItems.length}</span>
          <span className='text-red-400'>{t('generate.failed')}: {failedItems.length}</span>
          <span className='text-[var(--juhe-cyan)]'>{t('generate.running')}: {runningItems.length}</span>
          <span className='ml-auto flex items-center gap-1'>
            {t('generate.concurrency')}:
            <select value={concurrency} onChange={(e) => queue.setConcurrency(Number(e.target.value))} className='bg-transparent outline-none text-[var(--juhe-text-2)]'>
              {[1,2,3,4,5,6,8,10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </span>
        </div>
      </div>

      {showImport && (
        <div className='px-4 py-3 border-b border-[var(--juhe-border)] bg-[var(--juhe-void)]'>
          <label className='block text-[10px] text-[var(--juhe-text-3)] mb-1'>{t('generate.pasteJsonArray')}</label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='["prompt1", "prompt2"]'
            rows={3}
            className='w-full px-2 py-1.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)] outline-none resize-none'
          />
          <div className='flex gap-2 mt-2'>
            <button type='button' onClick={handleImport} className='px-3 py-1 text-[10px] rounded-lg bg-[var(--juhe-cyan)] text-white'>{t('generate.import')}</button>
            <button type='button' onClick={() => setShowImport(false)} className='px-3 py-1 text-[10px] rounded-lg bg-[var(--juhe-surface)] text-[var(--juhe-text-3)] border border-[var(--juhe-border)]'>{t('generate.cancel')}</button>
          </div>
        </div>
      )}

      <div className='flex-1 overflow-y-auto px-4 py-2 space-y-1.5'>
        {items.length === 0 && (
          <div className='flex items-center justify-center h-full text-xs text-[var(--juhe-text-3)]'>
            {t('generate.noTasks')}
          </div>
        )}
        {items.map((item) => (
          <BatchQueueItem key={item.id} item={item} onRemove={queue.removeItem} onRetry={queue.retryItem} onUpdate={queue.updateItem} statusIcon={statusIcon} />
        ))}
      </div>
    </div>
  )
}

function BatchQueueItem({ item, onRemove, onRetry, onUpdate, statusIcon }: {
  item: BatchItem
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onUpdate: (id: string, patch: Partial<BatchItem>) => void
  statusIcon: (s: string) => React.ReactNode
}) {
  const { t } = useTranslation()
  const isPending = item.status === 'pending'
  return (
    <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--juhe-surface)]/50 border border-[var(--juhe-border)] group'>
      {statusIcon(item.status)}
      {isPending ? (
        <input
          type='text'
          value={item.prompt}
          onChange={(e) => onUpdate(item.id, { prompt: e.target.value })}
          placeholder={t('generate.enterPrompt')}
          className='flex-1 bg-transparent text-xs text-[var(--juhe-text)] outline-none min-w-0'
        />
      ) : (
        <span className={`flex-1 text-xs truncate min-w-0 ${item.status === 'failed' ? 'text-red-400' : 'text-[var(--juhe-text-2)]'}`}>
          {item.prompt || item.error || '(empty)'}
        </span>
      )}
      {item.status === 'failed' && (
        <button type='button' onClick={() => onRetry(item.id)} className='p-1 rounded hover:bg-[var(--juhe-amber)]/10 text-[var(--juhe-amber)]' title={t('generate.retry')}>
          <RotateCcw className='w-3 h-3' />
        </button>
      )}
      <button type='button' onClick={() => onRemove(item.id)} className='p-1 rounded hover:bg-red-500/10 text-[var(--juhe-text-3)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity' title={t('generate.delete')}>
        <Trash2 className='w-3 h-3' />
      </button>
    </div>
  )
}
