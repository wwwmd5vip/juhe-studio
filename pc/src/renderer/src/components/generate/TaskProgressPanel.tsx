/**
 * TaskProgressPanel — 任务进度面板
 * 来源灵感：Merak SSE 流式进度、Mirror Studio 任务监控
 * 实时显示生成任务状态，带进度动画和统计
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, CheckCircle2, Clock, Loader2, Pause, Play, RotateCcw, X } from 'lucide-react'
import { useGenerationStore } from '@/stores/generation'

interface TaskInfo {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startedAt: number
}

export function TaskProgressPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { tasks } = useGenerationStore()
  const [taskList, setTaskList] = useState<TaskInfo[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync tasks from store and animate progress
  useEffect(() => {
    const syncTasks = () => {
      const liveTasks = tasks.slice(0, 20).map((t) => {
        const isRunning = t.status === 'processing'
        const isCompleted = t.status === 'completed'
        const isFailed = t.status === 'failed'

        // For running tasks, animate progress locally
        let progress = t.progress || 0
        if (isRunning && progress < 5) {
          const elapsed = Date.now() - (t.createdAt || Date.now())
          // Simulate progress: 1% per second capped at 90%
          progress = Math.min(90, Math.floor(elapsed / 100))
        }

        return {
          id: t.id,
          title: t.params?.prompt?.slice(0, 60) || '生成任务',
          status: isRunning ? 'running' as const : isCompleted ? 'completed' as const : isFailed ? 'failed' as const : 'pending' as const,
          progress,
          startedAt: t.createdAt || Date.now(),
        } as TaskInfo
      })
      setTaskList(liveTasks)
    }

    syncTasks()
    timerRef.current = setInterval(syncTasks, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [tasks])

  const running = taskList.filter((t) => t.status === 'running')
  const completed = taskList.filter((t) => t.status === 'completed')
  const failed = taskList.filter((t) => t.status === 'failed')
  const total = taskList.length

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${s % 60}s`
  }

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center gap-2'>
          <Activity className='w-4 h-4 text-[var(--juhe-cyan)]' />
          <h3 className='text-sm font-semibold text-[var(--juhe-text)]'>{t('generate.taskProgressTitle')}</h3>
          {running.length > 0 && (
            <span className='text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] animate-pulse'>
              {running.length} {t('generate.running')}
            </span>
          )}
        </div>
        <button onClick={onClose} className='p-1 rounded hover:bg-[var(--juhe-surface)] text-[var(--juhe-text-3)]'>
          <X className='w-4 h-4' />
        </button>
      </div>

      {/* Stats bar */}
      <div className='px-4 py-2.5 border-b border-[var(--juhe-border)] flex items-center gap-3 text-[10px]'>
        <span className='text-[var(--juhe-text-3)]'>{t('generate.total')}: {total}</span>
        <span className='flex items-center gap-1 text-green-400'>
          <CheckCircle2 className='w-3 h-3' /> {completed.length}
        </span>
        <span className='flex items-center gap-1 text-red-400'>
          <X className='w-3 h-3' /> {failed.length}
        </span>
        <span className='flex items-center gap-1 text-[var(--juhe-cyan)]'>
          <Loader2 className='w-3 h-3 animate-spin' /> {running.length}
        </span>
      </div>

      {/* Task list */}
      <div className='flex-1 overflow-y-auto px-4 py-2 space-y-2'>
        {taskList.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full text-xs text-[var(--juhe-text-3)] gap-2'>
            <Clock className='w-6 h-6 opacity-30' />
            <span>{t('generate.noTaskRecords')}</span>
          </div>
        )}
        {taskList.map((task) => (
          <div key={task.id} className='px-3 py-2.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)]/30'>
            <div className='flex items-center gap-2 mb-1.5'>
              {task.status === 'running' && <Loader2 className='w-3.5 h-3.5 text-[var(--juhe-cyan)] animate-spin shrink-0' />}
              {task.status === 'completed' && <CheckCircle2 className='w-3.5 h-3.5 text-green-400 shrink-0' />}
              {task.status === 'failed' && <X className='w-3.5 h-3.5 text-red-400 shrink-0' />}
              {task.status === 'pending' && <Clock className='w-3.5 h-3.5 text-[var(--juhe-text-3)] shrink-0' />}
              <span className='text-[11px] text-[var(--juhe-text)] truncate flex-1'>{task.title}</span>
              {task.status === 'running' && (
                <span className='text-[10px] text-[var(--juhe-cyan)] font-mono shrink-0'>{task.progress}%</span>
              )}
            </div>
            {task.status === 'running' && (
              <div className='h-1 rounded-full bg-[var(--juhe-surface)] overflow-hidden'>
                <div
                  className='h-full rounded-full bg-gradient-to-r from-[var(--juhe-cyan)] to-[var(--juhe-violet)] transition-all duration-500 ease-out'
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            )}
            <div className='flex items-center justify-between mt-1'>
              <span className='text-[9px] text-[var(--juhe-text-3)]'>{formatTime(Date.now() - task.startedAt)}{t('generate.ago')}</span>
              {task.status === 'failed' && (
                <button type='button' className='text-[9px] text-[var(--juhe-amber)] hover:underline flex items-center gap-0.5'>
                  <RotateCcw className='w-2.5 h-2.5' /> {t('generate.retry')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
