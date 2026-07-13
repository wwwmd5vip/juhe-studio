import type { GenerationTask, TaskPriority } from '@shared/types/generation'
import type React from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2, Pause, X } from 'lucide-react'

/** 筛选状态类型 */
export type FilterStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/** 状态颜色和图标配置 */
export const statusConfig: Record<string, { labelKey: string; color: string; icon: React.ReactNode }> = {
  pending: { labelKey: 'queue.status.pending', color: 'text-[var(--juhe-text-3)]', icon: <Clock className='w-3 h-3' /> },
  processing: { labelKey: 'queue.status.processing', color: 'text-[var(--juhe-cyan)]', icon: <Loader2 className='w-3 h-3 animate-spin' /> },
  completed: { labelKey: 'queue.status.completed', color: 'text-[var(--juhe-emerald)]', icon: <CheckCircle2 className='w-3 h-3' /> },
  failed: { labelKey: 'queue.status.failed', color: 'text-[var(--juhe-magenta)]', icon: <AlertCircle className='w-3 h-3' /> },
  cancelled: { labelKey: 'queue.status.cancelled', color: 'text-[var(--juhe-amber)]', icon: <X className='w-3 h-3' /> },
  paused: { labelKey: 'queue.status.paused', color: 'text-[var(--juhe-amber)]', icon: <Pause className='w-3 h-3' /> }
}

/** 优先级颜色配置 */
export const priorityConfig: Record<TaskPriority, { labelKey: string; color: string }> = {
  urgent: { labelKey: 'queue.priority.urgent', color: 'bg-[var(--juhe-magenta)]/20 text-[var(--juhe-magenta)]' },
  high: { labelKey: 'queue.priority.high', color: 'bg-[var(--juhe-amber)]/20 text-[var(--juhe-amber)]' },
  normal: { labelKey: 'queue.priority.normal', color: 'bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)]' },
  low: { labelKey: 'queue.priority.low', color: 'bg-[var(--juhe-text-dim)]/20 text-[var(--juhe-text-3)]' }
}

/** 所有筛选选项 */
export const FILTER_OPTIONS: FilterStatus[] = ['all', 'pending', 'processing', 'completed', 'failed', 'cancelled']

/** 并发选项 */
export const CONCURRENT_OPTIONS = [1, 2, 3, 4, 5]

/** 获取任务类型标签 */
export function getTaskTypeLabel(task: GenerationTask, t: (key: string) => string): string {
  if (task.type === 'image' && (task.params.firstFrame || (task.params.referenceImages && task.params.referenceImages.length > 0))) {
    return t('queue.types.img2img') || 'Img2Img'
  }
  if (task.type === 'image') return t('queue.types.image') || 'Image'
  if (task.type === 'video') return t('queue.types.video') || 'Video'
  if (task.type === 'text') return t('queue.types.text') || 'Text'
  return task.type
}

/** 格式化短时间 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** 格式化耗时 */
export function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start
  const seconds = Math.floor(duration / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/** 格式化完整时间 */
export function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
