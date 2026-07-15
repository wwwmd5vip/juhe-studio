/**
 * Canvas MCP Bridge — 渲染进程侧
 *
 * 监听主进程发来的 canvas-agent:execute-ops 消息，
 * 将 CanvasAgentOp 转换为画布 Zustand store 操作。
 *
 * 在 CanvasWorkspace 挂载时调用 initCanvasMcpBridge()。
 */

import type { CanvasAgentOp, CanvasAgentSnapshot } from '@shared/types/canvas-agent'

// 延迟引用——由 CanvasWorkspace 注入
let getCanvasState: (() => CanvasAgentSnapshot) | null = null
let applyOpsCallback: ((ops: CanvasAgentOp[]) => void) | null = null

export interface CanvasMcpBridgeConfig {
  /** 获取当前画布快照 */
  getState: () => CanvasAgentSnapshot
  /** 应用操作列表 */
  applyOps: (ops: CanvasAgentOp[]) => void
  /** 当前文档 ID */
  documentId: string
}

/**
 * 初始化 Canvas MCP 桥接。
 * 应在 CanvasWorkspace 组件挂载时调用。
 */
export function initCanvasMcpBridge(config: CanvasMcpBridgeConfig): () => void {
  getCanvasState = config.getState
  applyOpsCallback = config.applyOps

  // 监听主进程发来的操作请求
  const handleExecuteOps = (_event: unknown, payload: { documentId: string; ops: CanvasAgentOp[] }) => {
    if (payload.documentId !== config.documentId) return

    try {
      // 先推当前快照给主进程
      const snapshot = getCanvasState?.()
      if (snapshot) {
        ;(window.api as any).canvasAgent?.pushSnapshot?.(config.documentId, snapshot)
      }

      // 应用操作
      applyOpsCallback?.(payload.ops)

      // 推更新后的快照
      const updatedSnapshot = getCanvasState?.()
      const result = {
        success: true,
        snapshot: updatedSnapshot ?? undefined,
        affectedNodeIds: extractAffectedNodeIds(payload.ops)
      }
      ;(window.api as any).canvasAgent?.sendResult?.(result)
    } catch (err) {
      ;(window.api as any).canvasAgent?.sendResult?.({
        success: false,
        error: (err as Error).message
      })
    }
  }

  const api = (window as any).electron
  if (api?.ipcRenderer) {
    api.ipcRenderer.on('canvas-agent:execute-ops', handleExecuteOps)
  }

  // 返回清理函数
  return () => {
    getCanvasState = null
    applyOpsCallback = null
    if (api?.ipcRenderer) {
      api.ipcRenderer.removeListener('canvas-agent:execute-ops', handleExecuteOps)
    }
  }
}

/** 从操作列表中提取受影响的节点 ID */
function extractAffectedNodeIds(ops: CanvasAgentOp[]): string[] {
  const ids = new Set<string>()
  for (const op of ops) {
    if (op.nodeId) ids.add(op.nodeId)
    if (op.nodeIds) op.nodeIds.forEach((id) => ids.add(id))
  }
  return Array.from(ids)
}

/**
 * 工具操作 → Zustand store 操作映射器。
 * 由 CanvasWorkspace 在 applyOps 回调中使用。
 */
export function applyCanvasMCPOpsToStore(
  ops: CanvasAgentOp[],
  store: {
    nodes: any[]
    connections: any[]
    addNode?: (node: any) => void
    updateNode?: (id: string, data: any) => void
    removeNodes?: (ids: string[]) => void
    addConnection?: (conn: any) => void
    removeConnections?: (ids: string[]) => void
    setViewport?: (x: number, y: number, k: number) => void
    setSelection?: (ids: string[]) => void
  }
): void {
  for (const op of ops) {
    switch (op.kind) {
      case 'create_node': {
        const newNode = {
          id: crypto.randomUUID(),
          type: op.nodeType || 'config',
          title: op.title || 'Untitled',
          position: op.position || { x: 200, y: 200 },
          width: op.width || 280,
          height: op.height || 200,
          content: op.content,
          ...(op.prompt ? { metadata: { prompt: op.prompt } } : {})
        }
        store.addNode?.(newNode)
        break
      }
      case 'delete_nodes': {
        if (op.nodeIds && op.nodeIds.length > 0) {
          store.removeNodes?.(op.nodeIds)
        }
        break
      }
      case 'update_node': {
        if (op.nodeId) {
          const patch: Record<string, unknown> = {}
          if (op.title !== undefined) patch.title = op.title
          if (op.content !== undefined) patch.content = op.content
          if (op.prompt !== undefined) patch.prompt = op.prompt
          store.updateNode?.(op.nodeId, patch)
        }
        break
      }
      case 'move_nodes': {
        if (op.nodeIds && op.position) {
          for (const id of op.nodeIds) {
            store.updateNode?.(id, { position: op.position })
          }
        }
        break
      }
      case 'resize_node': {
        if (op.nodeId) {
          store.updateNode?.(op.nodeId, {
            width: op.width,
            height: op.height
          })
        }
        break
      }
      case 'connect_nodes': {
        if (op.fromNodeId && op.toNodeId) {
          store.addConnection?.({
            id: crypto.randomUUID(),
            fromNodeId: op.fromNodeId,
            toNodeId: op.toNodeId
          })
        }
        break
      }
      case 'select_nodes': {
        store.setSelection?.(op.nodeIds || [])
        break
      }
      case 'set_viewport': {
        if (op.viewport) {
          store.setViewport?.(op.viewport.x, op.viewport.y, op.viewport.k)
        }
        break
      }
      case 'generate_image': {
        // 触发生成：通过 window.api.workflow.executeNode
        if (op.nodeId) {
          ;(window.api as any).workflow?.executeNode?.(op.nodeId)
        }
        break
      }
      case 'apply_ops': {
        // 递归应用子操作
        if (op.ops) {
          applyCanvasMCPOpsToStore(op.ops, store)
        }
        break
      }
    }
  }
}
