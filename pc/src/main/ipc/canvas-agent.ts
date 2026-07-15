/**
 * Canvas Agent IPC Bridge — 主进程侧
 *
 * 暴露 IPC 通道，让 MCP 工具调用能桥接到渲染进程的画布操作。
 *
 * 通信模式：
 *   主进程 (MCP tool call) → IPC 'canvas-agent:execute-ops' → 渲染进程
 *   渲染进程 (result)       → IPC 'canvas-agent:result'        → 主进程
 *
 * 也支持渲染进程主动推送快照更新。
 */

import { ipcMain, BrowserWindow } from 'electron'
import { getCanvasTool } from '../services/canvas-agent-tools'
import {
  updateSnapshot,
  getSnapshot,
  recordOps,
  lockSession,
  unlockSession,
  destroySession
} from '../services/canvas-agent-session'
import type { CanvasAgentOp, CanvasAgentResult, CanvasAgentSnapshot } from '@shared/types/canvas-agent'

let mainWindow: BrowserWindow | null = null

export function setCanvasAgentWindow(win: BrowserWindow): void {
  mainWindow = win
}

/**
 * 向渲染进程发送画布操作并等待结果。
 * 这是主进程 → 渲染进程的单向调用。
 */
export function sendCanvasOps(
  documentId: string,
  ops: CanvasAgentOp[]
): Promise<CanvasAgentResult> {
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      reject(new Error('No renderer window available'))
      return
    }

    if (!lockSession(documentId)) {
      reject(new Error('Canvas session is locked — concurrent operation in progress'))
      return
    }

    const timeout = setTimeout(() => {
      unlockSession(documentId)
      reject(new Error('Canvas operation timed out (30s)'))
    }, 30000)

    // 一次性监听器
    const handler = (_event: Electron.IpcMainEvent, result: CanvasAgentResult) => {
      clearTimeout(timeout)
      unlockSession(documentId)
      ipcMain.removeListener('canvas-agent:result', handler)
      recordOps(documentId, ops)
      resolve(result)
    }

    ipcMain.once('canvas-agent:result', handler)
    mainWindow.webContents.send('canvas-agent:execute-ops', { documentId, ops })
  })
}

// ── IPC 注册 ──

export function registerCanvasAgentIpc(): void {
  // 渲染进程推送快照更新
  ipcMain.on(
    'canvas-agent:push-snapshot',
    (_event, documentId: string, snapshot: CanvasAgentSnapshot) => {
      updateSnapshot(documentId, snapshot)
    }
  )

  // 渲染进程查询当前快照
  ipcMain.handle('canvas-agent:get-snapshot', (_event, documentId: string) => {
    return getSnapshot(documentId) ?? null
  })

  // MCP 工具调用入口：接收 toolName + args，执行并返回结果
  ipcMain.handle(
    'canvas-agent:call-tool',
    async (_event, documentId: string, toolName: string, args: Record<string, unknown>) => {
      const tool = getCanvasTool(toolName)
      if (!tool) {
        return { success: false, error: `Unknown canvas tool: ${toolName}` }
      }

      try {
        const ops = tool.toOps(args)
        const result = await sendCanvasOps(documentId, ops)
        return result
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // 列出可用工具
  ipcMain.handle('canvas-agent:list-tools', async () => {
    const { listCanvasToolNames } = await import('../services/canvas-agent-tools')
    return listCanvasToolNames()
  })

  // 销毁会话
  ipcMain.handle('canvas-agent:destroy-session', (_event, documentId: string) => {
    destroySession(documentId)
    return { success: true }
  })
}
