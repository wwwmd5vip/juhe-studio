/**
 * 生成任务队列 v2
 * 支持：优先级、暂停/恢复、批量操作、状态统计
 */

import type {
  GenerationParams,
  GenerationTask,
  GenerationType,
  QueueState,
  TaskPriority
} from '@shared/types/generation'
import { errorMessage } from '@shared/utils/error-classifier'
import { createLogger } from '@shared/utils/logger'
import { stripBinaryDataFromParams } from '@shared/utils/task-utils'

const logger = createLogger('Queue')

interface QueueOptions {
  maxConcurrent?: number
  onUpdate?: (task: GenerationTask) => void
  onQueueStateChange?: (state: QueueState) => void
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1
}

class GenerationQueue {
  tasks = new Map<string, GenerationTask>()
  pending: string[] = []
  running = new Set<string>()
  private maxConcurrent: number
  private isPaused = false
  onUpdate?: (task: GenerationTask) => void
  onQueueStateChange?: (state: QueueState) => void
  private executors = new Map<string, (task: GenerationTask) => Promise<void>>()

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 2
    this.onUpdate = options.onUpdate
    this.onQueueStateChange = options.onQueueStateChange
  }

  /** 注册任务类型执行器 */
  registerExecutor(type: GenerationType, executor: (task: GenerationTask) => Promise<void>) {
    this.executors.set(type, executor)
  }

  /** 创建新任务 */
  createTask(type: GenerationType, params: GenerationParams, priority: TaskPriority = 'normal'): GenerationTask {
    const task: GenerationTask = {
      id: crypto.randomUUID(),
      type,
      status: 'pending',
      priority,
      params,
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    }
    logger.info('[Queue] Task created:', {
      taskId: task.id,
      type,
      model: params.model,
      providerId: params.providerId,
      prompt: params.prompt?.slice(0, 100),
      priority,
      hasReferenceImages: !!(params.referenceImages && params.referenceImages.length > 0),
      referenceImageCount: params.referenceImages?.length ?? 0,
      queueState: this.getQueueState()
    })
    this.tasks.set(task.id, task)
    this.insertByPriority(task.id)
    this.processQueue()
    this.emitStateChange()
    return task
  }

  /** 创建批量任务 */
  createBatch(
    type: GenerationType,
    baseParams: GenerationParams,
    prompts: string[],
    priority: TaskPriority = 'normal'
  ): GenerationTask[] {
    const tasks: GenerationTask[] = []
    for (let i = 0; i < prompts.length; i++) {
      const params = {
        ...baseParams,
        prompt: prompts[i],
        seed: baseParams.variationSeed ? (baseParams.seed ?? 0) + i : baseParams.seed
      }
      const task: GenerationTask = {
        id: crypto.randomUUID(),
        type,
        status: 'pending',
        priority,
        params,
        outputs: [],
        progress: 0,
        stage: 'queued',
        createdAt: Date.now()
      }
      this.tasks.set(task.id, task)
      this.insertByPriority(task.id)
      tasks.push(task)
    }
    this.processQueue()
    this.emitStateChange()
    return tasks
  }

  /** 按优先级插入 pending 队列 */
  insertByPriority(taskId: string) {
    const task = this.tasks.get(taskId)
    if (!task) return

    const weight = PRIORITY_WEIGHT[task.priority]
    let insertIndex = this.pending.length
    for (let i = 0; i < this.pending.length; i++) {
      const other = this.tasks.get(this.pending[i])
      if (other && PRIORITY_WEIGHT[other.priority] < weight) {
        insertIndex = i
        break
      }
    }
    this.pending.splice(insertIndex, 0, taskId)
  }

  /** 暂停队列 */
  pause(): boolean {
    if (this.isPaused) return false
    this.isPaused = true
    this.emitStateChange()
    return true
  }

  /** 恢复队列 */
  resume(): boolean {
    if (!this.isPaused) return false
    this.isPaused = false
    this.emitStateChange()
    this.processQueue()
    return true
  }

  /** 取消任务 */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    if (task.status === 'pending') {
      task.status = 'cancelled'
      this.pending = this.pending.filter((id) => id !== taskId)
      this.emitUpdate(task)
      this.emitStateChange()
      return true
    }

    if (task.status === 'processing') {
      // Abort in-flight HTTP requests
      task.abortController?.abort()
      task.status = 'cancelled'
      this.emitUpdate(task)
      this.emitStateChange()
      return true
    }

    if (task.status === 'paused') {
      task.status = 'cancelled'
      this.emitUpdate(task)
      this.emitStateChange()
      return true
    }

    return false
  }

  /** 批量取消 */
  cancelTasks(taskIds: string[]): string[] {
    const cancelled: string[] = []
    for (const id of taskIds) {
      if (this.cancelTask(id)) cancelled.push(id)
    }
    return cancelled
  }

  /** 重试失败任务 */
  retryTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || (task.status !== 'failed' && task.status !== 'cancelled')) return false

    task.status = 'pending'
    task.progress = 0
    task.stage = 'queued'
    task.error = undefined
    task.completedAt = undefined
    // 保留 externalTaskId 和 externalProvider，重试时会直接查询而非重新提交
    this.insertByPriority(taskId)
    this.processQueue()
    this.emitUpdate(task)
    this.emitStateChange()
    return true
  }

  /** 批量重试 */
  retryTasks(taskIds: string[]): string[] {
    const retried: string[] = []
    for (const id of taskIds) {
      if (this.retryTask(id)) retried.push(id)
    }
    return retried
  }

  /** 删除任务 */
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false
    if (task.status === 'processing') return false

    this.tasks.delete(taskId)
    this.pending = this.pending.filter((id) => id !== taskId)
    this.emitStateChange()
    return true
  }

  /** 批量删除 */
  deleteTasks(taskIds: string[]): string[] {
    const deleted: string[] = []
    for (const id of taskIds) {
      if (this.deleteTask(id)) deleted.push(id)
    }
    return deleted
  }

  /** 清理已完成任务 */
  cleanupCompleted(): number {
    let count = 0
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(id)
        count++
      }
    }
    this.pending = this.pending.filter((id) => this.tasks.has(id))
    this.emitStateChange()
    return count
  }

  /** 清理所有任务 */
  clearAll(): number {
    const count = this.tasks.size
    // 先取消运行中的
    for (const [_id, task] of this.tasks) {
      if (task.status === 'processing') {
        task.status = 'cancelled'
        this.emitUpdate(task)
      }
    }
    this.tasks.clear()
    this.pending = []
    this.running.clear()
    this.emitStateChange()
    return count
  }

  /** 获取任务 */
  getTask(taskId: string): GenerationTask | undefined {
    return this.tasks.get(taskId)
  }

  /** 获取所有任务 */
  getAllTasks(): GenerationTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  /** 获取队列状态 */
  getQueueState(): QueueState {
    const all = Array.from(this.tasks.values())
    return {
      isPaused: this.isPaused,
      maxConcurrent: this.maxConcurrent,
      totalTasks: all.length,
      pendingCount: all.filter((t) => t.status === 'pending').length,
      runningCount: all.filter((t) => t.status === 'processing').length,
      completedCount: all.filter((t) => t.status === 'completed').length,
      failedCount: all.filter((t) => t.status === 'failed').length,
      cancelledCount: all.filter((t) => t.status === 'cancelled').length,
      pausedCount: all.filter((t) => t.status === 'paused').length
    }
  }

  /** 设置最大并发 */
  setMaxConcurrent(n: number) {
    this.maxConcurrent = Math.max(1, Math.min(n, 10))
    this.processQueue()
    this.emitStateChange()
  }

  private async processQueue() {
    if (this.isPaused) return
    while (this.pending.length > 0 && this.running.size < this.maxConcurrent) {
      const taskId = this.pending.shift()
      if (!taskId) break

      const task = this.tasks.get(taskId)
      if (!task || task.status !== 'pending') continue

      this.running.add(taskId)
      this.runTask(task)
    }
  }

  private async runTask(task: GenerationTask) {
    const runStartTime = Date.now()
    task.status = 'processing'
    task.startedAt = Date.now()
    task.stage = 'initializing'
    // Create AbortController so the task can be cancelled mid-flight
    task.abortController = new AbortController()
    logger.info('[Queue] Task started:', {
      taskId: task.id,
      type: task.type,
      model: task.params.model,
      providerId: task.params.providerId,
      prompt: task.params.prompt?.slice(0, 100),
      queueState: this.getQueueState()
    })
    this.emitUpdate(task)
    this.emitStateChange()

    const executor = this.executors.get(task.type)
    if (!executor) {
      const errMsg = `未注册的执行器类型: ${task.type}`
      logger.error('[Queue] No executor:', { taskId: task.id, type: task.type })
      task.status = 'failed'
      task.error = errMsg
      task.completedAt = Date.now()
      this.running.delete(task.id)
      this.emitUpdate(task)
      this.emitStateChange()
      this.processQueue()
      return
    }

    const taskWithEmitUpdate = task as GenerationTask & { emitUpdate?: () => void }
    taskWithEmitUpdate.emitUpdate = () => {
      this.emitUpdate(task)
    }

    try {
      await executor(task)
      if (task.status === 'processing') {
        task.status = 'completed'
        task.completedAt = Date.now()
        logger.info('[Queue] Task completed:', {
          taskId: task.id,
          type: task.type,
          model: task.params.model,
          duration: `${Date.now() - runStartTime}ms`,
          outputCount: task.outputs.length,
          outputs: task.outputs.map((o) => ({
            type: o.type,
            hasUrl: !!o.url,
            hasBase64: !!o.base64,
            mediaType: o.mediaType
          }))
        })
      }
    } catch (error) {
      if (task.status === 'processing') {
        task.status = 'failed'
        const errorMsg = errorMessage(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        // 构建详细错误信息，包含请求参数上下文
        const context = {
          model: task.params.model,
          providerId: task.params.providerId,
          prompt: task.params.prompt?.slice(0, 100),
          type: task.type
        }
        task.error = errorMsg
        task.completedAt = Date.now()
        logger.error('[Queue] Task failed:', {
          taskId: task.id,
          type: task.type,
          model: task.params.model,
          duration: `${Date.now() - runStartTime}ms`,
          error: errorMsg,
          context,
          stack: errorStack
        })
      }
    } finally {
      // Strip base64 image data and abort controller after execution to free memory
      task.abortController = undefined
      task.params = stripBinaryDataFromParams(
        task.params as unknown as Record<string, unknown>
      ) as unknown as GenerationParams
      this.running.delete(task.id)
      // Wrap emit calls in try-catch so processQueue() always runs
      try { this.emitUpdate(task) } catch (e) { logger.error('[Queue] emitUpdate error:', e) }
      try { this.emitStateChange() } catch (e) { logger.error('[Queue] emitStateChange error:', e) }
      this.processQueue()
      // Auto-cleanup old completed tasks to prevent memory bloat
      this.cleanupOldTasks()
    }
  }

  /** Auto-cleanup completed/failed tasks older than 1 hour to prevent memory bloat */
  private cleanupOldTasks(): void {
    const ONE_HOUR = 60 * 60 * 1000
    const now = Date.now()
    let cleaned = 0
    for (const [id, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        now - task.completedAt > ONE_HOUR
      ) {
        this.tasks.delete(id)
        cleaned++
      }
    }
    if (cleaned > 0) {
      logger.info(`[Queue] Auto-cleaned ${cleaned} old completed tasks`)
    }
  }

  private emitUpdate(task: GenerationTask) {
    this.onUpdate?.(task)
  }

  emitStateChange() {
    this.onQueueStateChange?.(this.getQueueState())
  }
}

// 单例队列实例
let queueInstance: GenerationQueue | null = null

export function getGenerationQueue(options?: QueueOptions): GenerationQueue {
  if (!queueInstance) {
    queueInstance = new GenerationQueue(options)
  }
  // Always update callbacks on subsequent calls so late subscribers receive progress updates
  if (options?.onUpdate) {
    queueInstance.onUpdate = options.onUpdate
  }
  if (options?.onQueueStateChange) {
    queueInstance.onQueueStateChange = options.onQueueStateChange
  }
  return queueInstance
}

export { GenerationQueue }

/** 从已保存的任务恢复队列状态 */
export function restoreTasksToQueue(tasks: GenerationTask[]): void {
  const queue = getGenerationQueue()
  for (const task of tasks) {
    // 所有任务都恢复到 tasks Map 中（包括已完成，用于展示历史）
    queue.tasks.set(task.id, task)
    // 未完成的任务加入 pending 队列
    if (task.status === 'pending' || task.status === 'paused' || task.status === 'processing') {
      task.status = 'pending'
      task.progress = 0
      task.stage = 'queued'
      task.error = undefined
      task.startedAt = undefined
      queue.insertByPriority(task.id)
    }
  }
  queue.emitStateChange()
  logger.info('[Queue] Restored tasks from DB:', {
    total: queue.tasks.size,
    pending: queue.pending.length,
    running: queue.running.size
  })
}
