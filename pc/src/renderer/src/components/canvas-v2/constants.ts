import type { CanvasNode, CanvasNodeMetadata, CanvasNodeType } from './types'

interface CanvasNodeSpec {
  width: number
  height: number
  titleKey: string
  metadata?: CanvasNodeMetadata
}

export const NODE_DEFAULT_SIZE: Record<CanvasNodeType, { width: number; height: number; titleKey: string }> = {
  image: { width: 340, height: 240, titleKey: 'canvas.nodeTypes.image' },
  text: { width: 340, height: 240, titleKey: 'canvas.nodeTypes.prompt' },
  config: { width: 340, height: 240, titleKey: 'canvas.nodeTypes.generator' },
  video: { width: 420, height: 236, titleKey: 'canvas.nodeTypes.video' },
  audio: { width: 340, height: 120, titleKey: 'canvas.nodeTypes.audio' },
  output: { width: 340, height: 280, titleKey: 'canvas.nodeTypes.output' },
  group: { width: 320, height: 240, titleKey: 'canvas.nodeTypes.group' },
  llm: { width: 420, height: 590, titleKey: 'canvas.nodeTypes.llm' },
  loop: { width: 336, height: 280, titleKey: 'canvas.nodeTypes.loop' },
  comfy: { width: 420, height: 460, titleKey: 'canvas.nodeTypes.comfy' },
  modelscope: { width: 380, height: 320, titleKey: 'canvas.nodeTypes.modelscope' }
}

export const NODE_SPECS: Record<CanvasNodeType, CanvasNodeSpec> = {
  image: {
    ...NODE_DEFAULT_SIZE.image,
    metadata: { content: '', status: 'idle' }
  },
  text: {
    ...NODE_DEFAULT_SIZE.text,
    metadata: { content: '', status: 'idle', fontSize: 14 }
  },
  config: {
    ...NODE_DEFAULT_SIZE.config,
    metadata: { content: '', status: 'idle', generationMode: 'image' }
  },
  video: {
    ...NODE_DEFAULT_SIZE.video,
    metadata: { content: '', status: 'idle' }
  },
  audio: {
    ...NODE_DEFAULT_SIZE.audio,
    metadata: { content: '', status: 'idle' }
  },
  output: {
    ...NODE_DEFAULT_SIZE.output,
    metadata: { status: 'idle', images: [] }
  },
  group: {
    ...NODE_DEFAULT_SIZE.group,
    metadata: { status: 'idle', collapsed: false, nodeIds: [] }
  },
  llm: {
    ...NODE_DEFAULT_SIZE.llm,
    metadata: { status: 'idle', messages: [], outputMode: 'inline' }
  },
  loop: {
    ...NODE_DEFAULT_SIZE.loop,
    metadata: { status: 'idle', count: 1, mode: 'sequential', results: [], imageResults: [] }
  },
  comfy: {
    ...NODE_DEFAULT_SIZE.comfy,
    metadata: { status: 'idle', seed: -1, params: {} }
  },
  modelscope: {
    ...NODE_DEFAULT_SIZE.modelscope,
    metadata: { status: 'idle', loraEnabled: false, imageInputs: [] }
  }
}

export function getNodeSpec(type: CanvasNodeType): CanvasNodeSpec {
  return NODE_SPECS[type]
}

export function createNode(
  type: CanvasNodeType,
  position: { x: number; y: number },
  overrides?: Partial<CanvasNode>
): CanvasNode {
  const spec = getNodeSpec(type)
  const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    type,
    title: overrides?.title ?? '',
    position,
    width: overrides?.width ?? spec.width,
    height: overrides?.height ?? spec.height,
    metadata: { ...spec.metadata, ...overrides?.metadata }
  }
}

/** 可运行的节点类型 */
export const RUNNABLE_NODE_TYPES: CanvasNodeType[] = ['config', 'video', 'comfy', 'modelscope', 'llm', 'loop']

/** Config 节点不可连接 Config 节点 */
export const VALID_CONNECTIONS: Partial<Record<CanvasNodeType, CanvasNodeType[]>> = {
  text: ['config', 'llm', 'video', 'comfy', 'modelscope'],
  image: ['config', 'video', 'comfy', 'modelscope'],
  config: ['output'],
  llm: ['config', 'video', 'output'],
  video: ['output'],
  comfy: ['output'],
  modelscope: ['output'],
  audio: ['output'],
  output: ['config', 'video', 'comfy', 'modelscope'],
  loop: ['config', 'llm', 'video', 'comfy', 'modelscope', 'output'],
  group: []
}

export function isValidConnection(source: CanvasNodeType, target: CanvasNodeType): boolean {
  const allowed = VALID_CONNECTIONS[source]
  if (!allowed) return false
  return allowed.includes(target)
}

/** 连接线颜色映射 */
export const NODE_COLORS: Record<CanvasNodeType, string> = {
  image: '#10b981',
  text: '#f59e0b',
  config: '#3b82f6',
  video: '#f97316',
  audio: '#a855f7',
  output: '#ec4899',
  group: '#6b7280',
  llm: '#06b6d4',
  loop: '#84cc16',
  comfy: '#8b5cf6',
  modelscope: '#14b8a6'
}
