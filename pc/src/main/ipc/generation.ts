/**
 * Generation IPC Handlers v2
 * 处理 AI 生成任务的创建、查询、取消、队列控制
 * Enhanced with batched progress updates, queue notifications, and OS notifications
 */

import type { BatchTaskRequest, GenerateRequest, GenerationProgress, TaskPriority } from '@shared/types/generation'
import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { creatorTasks } from '../db/schema'
import { executeAliyunImageGeneration, executeAliyunVideoGeneration } from '../services/aliyun-generation'
import { executeAudioGeneration } from '../services/audio-generation'
import { executeImageGeneration, saveGenerationToDb } from '../services/generation'
import { createRoutedGenerationTask } from '../services/generation-router'
import { executeJimengGeneration } from '../services/jimeng-generation'
import { notifyQueueCompleted, notifyTaskCompleted, notifyTaskFailed } from '../services/notifications'
import { getGenerationQueue } from '../services/queue'
import { submitVideoGeneration } from '../services/video-generation'
import { initProviderRegistry } from '../services/image-providers'
import { updateTrayBadge, updateTrayTooltip } from '../tray'

// 存储窗口引用用于推送进度
let mainWindow: Electron.BrowserWindow | null = null

export function setMainWindow(win: Electron.BrowserWindow) {
  mainWindow = win
}

// Batch progress throttling
let progressBatch: GenerationProgress[] = []
let progressFlushTimer: NodeJS.Timeout | null = null
const PROGRESS_FLUSH_INTERVAL = 150 // ms

function flushProgressBatch() {
  if (progressBatch.length === 0 || !mainWindow) return
  const latestByTask = new Map<string, GenerationProgress>()
  for (const p of progressBatch) {
    latestByTask.set(p.taskId, p)
  }
  const batched = Array.from(latestByTask.values())
  // Always clear batch first, so a send failure doesn't block future updates
  progressBatch = []
  try {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('generation:progress-batch', batched)
    }
  } catch (e) {
    console.error('[Generation IPC] flushProgressBatch send error:', e)
  }
}

function pushProgress(progress: GenerationProgress) {
  progressBatch.push(progress)
  if (!progressFlushTimer) {
    progressFlushTimer = setTimeout(() => {
      progressFlushTimer = null
      flushProgressBatch()
    }, PROGRESS_FLUSH_INTERVAL)
  }
  // Also send immediately for completed/failed states
  if (progress.status === 'completed' || progress.status === 'failed') {
    if (progressFlushTimer) {
      clearTimeout(progressFlushTimer)
      progressFlushTimer = null
    }
    flushProgressBatch()
  }
}

function pushQueueState(state: unknown) {
  mainWindow?.webContents.send('queue:state', state)
}

export function registerGenerationIpc() {
  const queue = getGenerationQueue({
    maxConcurrent: 2,
    onUpdate: (task) => {
      // Wrap entire callback in try-catch so errors never block the queue
      try {
        pushProgress({
          taskId: task.id,
          status: task.status,
          progress: task.progress,
          stage: task.stage,
          message: task.error,
          outputs: task.outputs
        })
      } catch (e) {
        console.error('[Generation IPC] pushProgress error:', e)
      }

      try {
        const nodeId = (task.params as unknown as Record<string, unknown>).nodeId
        if (nodeId && typeof nodeId === 'string' && !mainWindow?.isDestroyed()) {
          const resultOutput = task.outputs.find((o) => o.url || o.base64)
          mainWindow?.webContents.send('workflow:node:update', {
            nodeId,
            status: task.status === 'completed' ? 'success' : task.status === 'processing' ? 'running' : task.status,
            progress: task.progress,
            stage: task.stage,
            result: resultOutput
              ? { type: resultOutput.type, content: resultOutput.url || resultOutput.base64 || '' }
              : undefined,
            error: task.error
          })
        }
      } catch (e) {
        console.error('[Generation IPC] workflow update error:', e)
      }

      // 完成后保存到数据库
      if (task.status === 'completed' || task.status === 'failed') {
        saveGenerationToDb(task).then((genRecord) => {
          // Creator OS reconciliation: update creatorTasks status + materialize versions
          import('../services/creator-os/reconciliation').then((m) =>
            m.reconcileCreatorTask(task.id, task.status as 'completed' | 'failed', {
              id: task.id,
              resultUrls: JSON.stringify(task.outputs.map((o) => o.url).filter(Boolean)),
              errorMessage: task.error ?? null
            })
          ).catch((err) => console.error('[Generation IPC] reconciliation error:', err))
        }).catch((err) => {
          console.error('Failed to save generation:', err)
        })

        try {
          if (task.status === 'completed') {
            notifyTaskCompleted(task.type, task.params.prompt)
          } else {
            notifyTaskFailed(task.type, task.error)
          }
        } catch (e) {
          console.error('[Generation IPC] notification error:', e)
        }
      }

      // Update tray badge with running count
      try {
        const state = queue.getQueueState()
        updateTrayBadge(state.runningCount)
        updateTrayTooltip()
      } catch (e) {
        console.error('[Generation IPC] tray update error:', e)
      }
    },
    onQueueStateChange: (state) => {
      pushQueueState(state)

      // Notify when all tasks completed
      if (
        state.totalTasks > 0 &&
        state.pendingCount === 0 &&
        state.runningCount === 0 &&
        state.completedCount > 0 &&
        state.failedCount === 0
      ) {
        notifyQueueCompleted(state.completedCount)
      }

      updateTrayBadge(state.runningCount)
      updateTrayTooltip()
    }
  })

  // Creator OS checkpoint: update creatorTasks.runtimeStatus when task begins executing
  queue.setOnTaskSubmitted(async (taskId) => {
    try {
      await db
        .update(creatorTasks)
        .set({ runtimeStatus: 'processing', updatedAt: new Date().toISOString() })
        .where(eq(creatorTasks.runtimeTaskId, taskId))
    } catch (err) {
      console.error('[Generation IPC] Checkpoint update failed:', err)
    }
  })

  // 注册图像生成执行器
  // 初始化 Provider Registry — 能力驱动路由的基础设施
  initProviderRegistry()

  queue.registerExecutor('image', executeImageGeneration)
  queue.registerExecutor('video', submitVideoGeneration)
  queue.registerExecutor('audio', executeAudioGeneration)
  queue.registerExecutor('jimeng', executeJimengGeneration)
  queue.registerExecutor('aliyun-image', executeAliyunImageGeneration)
  queue.registerExecutor('aliyun-video', executeAliyunVideoGeneration)

  // 创建生成任务
  ipcMain.handle('generation:create', async (_event, request: GenerateRequest & { priority?: TaskPriority }) => {
    if (!request || !request.params) {
      throw new Error('Invalid generation request: missing params')
    }
    if (!request.params.prompt) {
      throw new Error('Invalid generation request: missing prompt')
    }
    const params = request.params
    console.log('[IPC:generation:create] Request:', {
      type: request.type,
      model: params.model,
      providerId: params.providerId,
      prompt: params.prompt?.slice(0, 100),
      priority: request.priority,
      hasReferenceImages: !!(params.referenceImages && params.referenceImages.length > 0),
      referenceImageCount: params.referenceImages?.length ?? 0,
      referenceImageLengths: params.referenceImages?.map((img: string) => img.length) ?? []
    })

    const task = await createRoutedGenerationTask(params, request.priority, {
      requestedType: request.type
    })
    console.log('[IPC:generation:create] Routed:', {
      taskId: task.id,
      type: task.type,
      model: params.model,
      providerId: params.providerId
    })
    return { taskId: task.id, status: task.status }
  })

  // 获取任务状态
  ipcMain.handle('generation:get', async (_event, taskId: string) => {
    return queue.getTask(taskId) ?? null
  })

  // 取消任务
  ipcMain.handle('generation:cancel', async (_event, taskId: string) => {
    return queue.cancelTask(taskId)
  })

  // 获取所有任务
  ipcMain.handle('generation:list', async () => {
    const tasks = queue.getAllTasks()
    // 通过 JSON 序列化/反序列化彻底清理不可序列化的属性（如 emitUpdate 函数）
    return tasks.map((task) => JSON.parse(JSON.stringify(task)))
  })

  // 创建批量生成任务
  ipcMain.handle(
    'generation:create-batch',
    async (_event, request: GenerateRequest & { prompts: string[]; priority?: TaskPriority }) => {
      const tasks = queue.createBatch(request.type, request.params, request.prompts, request.priority)
      return { taskIds: tasks.map((t) => t.id), status: 'pending' }
    }
  )

  // ========== 队列控制 API ==========

  // 获取队列状态
  ipcMain.handle('queue:state', async () => {
    return queue.getQueueState()
  })

  // 暂停队列
  ipcMain.handle('queue:pause', async () => {
    return queue.pause()
  })

  // 恢复队列
  ipcMain.handle('queue:resume', async () => {
    return queue.resume()
  })

  // 设置最大并发
  ipcMain.handle('queue:set-concurrent', async (_event, maxConcurrent: number) => {
    queue.setMaxConcurrent(maxConcurrent)
    return true
  })

  // 清理已完成任务
  ipcMain.handle('queue:cleanup', async () => {
    return queue.cleanupCompleted()
  })

  // 清理所有任务
  ipcMain.handle('queue:clear-all', async () => {
    return queue.clearAll()
  })

  // 重试任务
  ipcMain.handle('queue:retry', async (_event, taskId: string) => {
    return queue.retryTask(taskId)
  })

  // 删除任务
  ipcMain.handle('queue:delete', async (_event, taskId: string) => {
    return queue.deleteTask(taskId)
  })

  // 批量操作
  ipcMain.handle('queue:batch-action', async (_event, request: BatchTaskRequest) => {
    switch (request.action) {
      case 'cancel':
        return queue.cancelTasks(request.taskIds)
      case 'retry':
        return queue.retryTasks(request.taskIds)
      case 'delete':
        return queue.deleteTasks(request.taskIds)
      default:
        return []
    }
  })
}
