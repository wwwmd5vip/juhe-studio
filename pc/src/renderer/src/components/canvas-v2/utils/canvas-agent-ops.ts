/**
 * canvas-agent-ops.ts - 画布原子操作
 * Agent/Assistant 通过操作列表操控画布状态
 */
import { createNode } from '../constants'
import type { CanvasAgentOp, CanvasAgentSnapshot, CanvasConnection, CanvasNode } from '../types'

export type { CanvasAgentOp, CanvasAgentSnapshot }

/**
 * 原子操作：创建节点
 * params: { type, title?, position, width?, height?, metadata? }
 */
function opCreateNode(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const type = (params.type as string) || 'image'
  const position = (params.position as { x: number; y: number }) || { x: 300, y: 200 }
  const node = createNode(type as CanvasNode['type'], position, {
    title: (params.title as string) || '',
    width: params.width as number | undefined,
    height: params.height as number | undefined,
    metadata: params.metadata as Record<string, unknown> | undefined
  } as Partial<CanvasNode>)
  return { ...snapshot, nodes: [...snapshot.nodes, node] }
}

/**
 * 原子操作：删除节点
 * params: { ids: string[] }
 */
function opDeleteNodes(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const ids = params.ids as string[]
  if (!ids || ids.length === 0) return snapshot
  const idSet = new Set(ids)
  return {
    nodes: snapshot.nodes.filter((n) => !idSet.has(n.id)),
    connections: snapshot.connections.filter((c) => !idSet.has(c.fromNodeId) && !idSet.has(c.toNodeId))
  }
}

/**
 * 原子操作：更新节点
 * params: { id, patch: { title?, position?, width?, height?, metadata? } }
 */
function opUpdateNode(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const id = params.id as string
  const patch = params.patch as Record<string, unknown>
  if (!id || !patch) return snapshot
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => {
      if (n.id !== id) return n
      return {
        ...n,
        ...(patch.title != null ? { title: patch.title as string } : {}),
        ...(patch.position ? { position: patch.position as { x: number; y: number } } : {}),
        ...(patch.width != null ? { width: patch.width as number } : {}),
        ...(patch.height != null ? { height: patch.height as number } : {}),
        ...(patch.metadata ? { metadata: { ...n.metadata, ...(patch.metadata as Record<string, unknown>) } } : {})
      }
    })
  }
}

/**
 * 原子操作：更新节点文本内容
 * params: { id, content }
 */
function opUpdateNodeText(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const id = params.id as string
  const content = params.content as string
  if (!id) return snapshot
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => {
      if (n.id !== id) return n
      return { ...n, metadata: { ...n.metadata, content } }
    })
  }
}

/**
 * 原子操作：移动节点
 * params: { moves: { id, position }[] }
 */
function opMoveNodes(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const moves = params.moves as { id: string; position: { x: number; y: number } }[]
  if (!moves || moves.length === 0) return snapshot
  const moveMap = new Map(moves.map((m) => [m.id, m.position]))
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => {
      const pos = moveMap.get(n.id)
      return pos ? { ...n, position: pos } : n
    })
  }
}

/**
 * 原子操作：调整节点大小
 * params: { id, width, height, position? }
 */
function opResizeNode(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const id = params.id as string
  const width = params.width as number
  const height = params.height as number
  if (!id) return snapshot
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((n) => {
      if (n.id !== id) return n
      return {
        ...n,
        width: width ?? n.width,
        height: height ?? n.height,
        ...(params.position ? { position: params.position as { x: number; y: number } } : {})
      }
    })
  }
}

/**
 * 原子操作：连接节点
 * params: { fromNodeId, toNodeId }
 */
function opConnectNodes(snapshot: CanvasAgentSnapshot, params: Record<string, unknown>): CanvasAgentSnapshot {
  const fromNodeId = params.fromNodeId as string
  const toNodeId = params.toNodeId as string
  if (!fromNodeId || !toNodeId) return snapshot

  const exists = snapshot.connections.some((c) => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId)
  if (exists) return snapshot

  const connection: CanvasConnection = {
    id: `conn-agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fromNodeId,
    toNodeId
  }
  return { ...snapshot, connections: [...snapshot.connections, connection] }
}

/**
 * 原子操作：选择节点
 * params: { ids: string[] }
 */
function opSelectNodes(snapshot: CanvasAgentSnapshot, _params: Record<string, unknown>): CanvasAgentSnapshot {
  // Selection is handled externally, this is a no-op on the snapshot
  return snapshot
}

/**
 * 原子操作：设置视口
 * params: { x, y, k }
 */
function opSetViewport(snapshot: CanvasAgentSnapshot, _params: Record<string, unknown>): CanvasAgentSnapshot {
  // Viewport is handled externally
  return snapshot
}

// ---- Ops Registry ----

const OP_HANDLERS: Record<
  string,
  (snapshot: CanvasAgentSnapshot, params: Record<string, unknown>) => CanvasAgentSnapshot
> = {
  create_node: opCreateNode,
  delete_nodes: opDeleteNodes,
  update_node: opUpdateNode,
  update_node_text: opUpdateNodeText,
  move_nodes: opMoveNodes,
  resize_node: opResizeNode,
  connect_nodes: opConnectNodes,
  select_nodes: opSelectNodes,
  set_viewport: opSetViewport
}

/**
 * 将操作列表应用到快照，返回新快照
 */
export function applyCanvasAgentOps(snapshot: CanvasAgentSnapshot, ops: CanvasAgentOp[]): CanvasAgentSnapshot {
  let current = snapshot
  for (const op of ops) {
    const handler = OP_HANDLERS[op.action]
    if (handler) {
      current = handler(current, op.params)
    }
  }
  return current
}

/**
 * 从 nodes/connections 创建快照
 */
export function createSnapshot(nodes: CanvasNode[], connections: CanvasConnection[]): CanvasAgentSnapshot {
  return {
    nodes: nodes.map((n) => ({ ...n, metadata: n.metadata ? { ...n.metadata } : undefined })),
    connections: [...connections]
  }
}
