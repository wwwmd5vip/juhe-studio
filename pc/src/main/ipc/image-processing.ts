/**
 * Image Processing IPC Handlers
 * M3 Phase 1: img2img, inpaint, upscale, remove-bg, outpaint, variant
 */

import type { ImageProcessProgress, ImageProcessRequest, ImageProcessTask } from '@shared/types/image-processing'
import { ipcMain } from 'electron'
import { db } from '../db'
import { generations } from '../db/schema'
import {
  executeImg2Img,
  executeInpaint,
  executeOutpaint,
  executeRemoveBg,
  executeUpscale,
  executeVariant
} from '../services/image-processing'

// 内存任务存储
// NOTE: tasks Map is safe from race conditions because:
// 1. Node.js main process runs on a single thread (event loop)
// 2. Map.set/get/delete are synchronous operations
// 3. Async operations (sharp processing) happen outside the critical path
const tasks = new Map<string, ImageProcessTask>()
let mainWindow: Electron.BrowserWindow | null = null

export function setImageProcessWindow(win: Electron.BrowserWindow) {
  mainWindow = win
}

function pushProgress(progress: ImageProcessProgress) {
  mainWindow?.webContents.send('image-process:progress', progress)
}

function emitUpdate(task: ImageProcessTask) {
  pushProgress({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    stage: task.stage,
    message: task.error,
    outputs: task.outputs
  })
}

async function runTask(task: ImageProcessTask) {
  // Check if task was cancelled before starting
  if (task.status === 'cancelled') return

  task.status = 'processing'
  task.stage = 'initializing'
  emitUpdate(task)

  try {
    switch (task.type) {
      case 'img2img':
        await executeImg2Img(task)
        break
      case 'inpaint':
        await executeInpaint(task)
        break
      case 'upscale':
        await executeUpscale(task)
        break
      case 'remove-bg':
        await executeRemoveBg(task)
        break
      case 'outpaint':
        await executeOutpaint(task)
        break
      case 'variant':
        await executeVariant(task)
        break
      default:
        throw new Error(`Unknown process type: ${task.type}`)
    }

    if (task.status === 'processing') {
      task.status = 'completed'
    }
  } catch (error) {
    if (task.status === 'processing') {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
    }
  } finally {
    if (task.status === 'processing' || task.status === 'completed' || task.status === 'failed') {
      task.completedAt = Date.now()
      emitUpdate(task)
      saveToDb(task)
      // Auto-cleanup completed/failed tasks from memory after 5 minutes
      const TTL = 5 * 60 * 1000
      setTimeout(() => tasks.delete(task.id), TTL)
    }
  }
}

async function saveToDb(task: ImageProcessTask) {
  try {
    await db.insert(generations).values({
      id: task.id,
      type: 'image',
      providerId: task.providerId || 'unknown',
      modelId: task.modelId || 'unknown',
      prompt: task.prompt || `${task.type} processing`,
      parameters: JSON.stringify({
        processType: task.type,
        strength: task.strength,
        scaleFactor: task.scaleFactor,
        ...task.parameters
      }),
      resultUrls: JSON.stringify(task.outputs.map((o) => ('url' in o ? (o as any).url : '') || '')),
      status: task.status,
      errorMessage: task.error,
      createdAt: new Date(task.createdAt).toISOString(),
      updatedAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('Failed to save image process to db:', err)
  }
}

export function registerImageProcessIpc() {
  // 创建图像处理任务
  ipcMain.handle('image-process:create', async (_event, request: ImageProcessRequest) => {
    const task: ImageProcessTask = {
      id: crypto.randomUUID(),
      type: request.type,
      sourceImage: request.sourceImage,
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      maskImage: request.maskImage,
      strength: request.strength,
      scaleFactor: request.scaleFactor,
      providerId: request.providerId,
      modelId: request.modelId,
      parameters: request.parameters,
      status: 'pending',
      outputs: [],
      progress: 0,
      stage: 'queued',
      createdAt: Date.now()
    }

    tasks.set(task.id, task)
    emitUpdate(task)

    // 异步执行
    runTask(task)

    return { taskId: task.id, status: task.status }
  })

  // 获取任务状态
  ipcMain.handle('image-process:get', async (_event, taskId: string) => {
    return tasks.get(taskId) ?? null
  })

  // 取消任务（仅支持 pending 状态）
  ipcMain.handle('image-process:cancel', async (_event, taskId: string) => {
    const task = tasks.get(taskId)
    if (!task || task.status !== 'pending') return false
    task.status = 'cancelled'
    emitUpdate(task)
    return true
  })

  // 获取所有任务
  ipcMain.handle('image-process:list', async () => {
    return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt)
  })
}
