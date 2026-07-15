// ── Canvas Agent MCP 共享类型 ──

/** 画布操作类型 —— 原子级操作，对应渲染进程的 canvas-agent-ops */
export type CanvasOpKind =
  | 'create_node'
  | 'delete_nodes'
  | 'update_node'
  | 'update_node_text'
  | 'move_nodes'
  | 'resize_node'
  | 'connect_nodes'
  | 'select_nodes'
  | 'set_viewport'
  | 'generate_image'
  | 'apply_ops'   // 批量操作

/** 画布节点类型 */
export type CanvasNodeType =
  | 'image'
  | 'text'
  | 'config'
  | 'video'
  | 'audio'
  | 'output'
  | 'group'
  | 'llm'
  | 'loop'
  | 'comfy'
  | 'modelscope'

/** 画布节点 */
export interface CanvasAgentNode {
  id: string
  type: CanvasNodeType
  title: string
  content?: string
  prompt?: string
  imageUrl?: string
  position: { x: number; y: number }
  width: number
  height: number
  connectedTo?: string[]
}

/** 画布连接 */
export interface CanvasAgentConnection {
  id: string
  fromNodeId: string
  toNodeId: string
}

/** 画布快照 */
export interface CanvasAgentSnapshot {
  nodes: CanvasAgentNode[]
  connections: CanvasAgentConnection[]
  viewport: { x: number; y: number; k: number }
  selection: string[]
}

/** 单个画布操作 */
export interface CanvasAgentOp {
  kind: CanvasOpKind
  nodeId?: string
  nodeIds?: string[]
  nodeType?: CanvasNodeType
  title?: string
  content?: string
  prompt?: string
  imageUrl?: string
  position?: { x: number; y: number }
  width?: number
  height?: number
  fromNodeId?: string
  toNodeId?: string
  viewport?: { x: number; y: number; k: number }
  ops?: CanvasAgentOp[]
  modelId?: string
  providerId?: string
}

/** 操作执行结果 */
export interface CanvasAgentResult {
  success: boolean
  snapshot?: CanvasAgentSnapshot
  error?: string
  affectedNodeIds?: string[]
}
