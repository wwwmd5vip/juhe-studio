/**
 * Creator OS 状态工具
 */

import type { BatchStatus, CreatorTask } from '../types/creator-os'

/**
 * 根据一批 CreatorTask 的运行时状态推导整个批次的当前状态。
 *
 * 规则：
 * - 如果有任何任务在 submitting / processing / pending → 'processing'
 * - 如果没有任何 processing 但有 failed / cancelled → 分类讨论：
 *   - 全部 completed → 'completed'
 *   - 全部 failed/cancelled 且无任何 success → 'failed'
 *   - 部分 completed 部分 failed → 'partial'
 * - 所有任务都 pending 且无任何已完成 → 'idle'
 *
 * 这个函数是纯函数，不访问 DB，可由 renderer 和 main process 共享使用。
 */
export function computeBatchStatus(tasks: Pick<CreatorTask, 'runtimeStatus'>[]): BatchStatus {
  if (tasks.length === 0) return 'idle'

  const statuses = tasks.map((t) => t.runtimeStatus)

  const hasRunning = statuses.some(
    (s) => s === 'submitting' || s === 'processing' || s === 'pending'
  )
  if (hasRunning) return 'processing'

  const hasFailed = statuses.some((s) => s === 'failed' || s === 'cancelled')
  const hasCompleted = statuses.some((s) => s === 'completed')

  if (hasFailed && !hasCompleted) return 'failed'
  if (hasFailed && hasCompleted) return 'partial'
  if (hasCompleted && statuses.every((s) => s === 'completed')) return 'completed'

  // 所有任务都还在 pending（尚未提交到队列）
  return 'idle'
}
