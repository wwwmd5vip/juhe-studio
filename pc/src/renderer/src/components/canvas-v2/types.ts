export interface Position {
  x: number
  y: number
}

export interface ViewportTransform {
  x: number
  y: number
  k: number
}

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

export type CanvasNodeStatus = 'idle' | 'success' | 'loading' | 'error' | 'queued' | 'running'

export type CanvasGenerationMode = 'text' | 'image' | 'video' | 'audio'
export type CanvasImageGenerationType = 'generation' | 'edit'

/** 共享的元数据字段，按需可选 */
export interface CanvasNodeMetadata {
  content?: string
  composerContent?: string
  prompt?: string
  status?: CanvasNodeStatus
  errorDetails?: string
  fontSize?: number
  generationMode?: CanvasGenerationMode
  generationType?: CanvasImageGenerationType
  model?: string
  size?: string
  quality?: string
  count?: number
  seconds?: string
  vquality?: string
  generateAudio?: string
  watermark?: string
  audioVoice?: string
  audioFormat?: string
  audioSpeed?: string
  audioInstructions?: string
  references?: string[]
  naturalWidth?: number
  naturalHeight?: number
  freeResize?: boolean
  cropRect?: { x: number; y: number; width: number; height: number }
  upscaleParams?: { targetLongEdge: number; algorithm: string }
  splitParams?: CanvasImageSplitParams
  angleParams?: CanvasImageAngleParams
  maskDataUrl?: string
  referenceUrl?: string
  isBatchRoot?: boolean
  batchRootId?: string
  batchChildIds?: string[]
  batchUsesReferenceImages?: boolean
  primaryImageId?: string
  imageBatchExpanded?: boolean
  storageKey?: string
  mimeType?: string
  bytes?: number
  durationMs?: number

  // ---- 兼容现有节点类型的额外字段 ----
  url?: string
  name?: string
  text?: string
  providerId?: string
  modelId?: string
  ratio?: string
  imageInputs?: string[]
  outputs?: string[]
  taskId?: string
  error?: string
  label?: string
  collapsed?: boolean
  nodeIds?: string[]
  messages?: { role: 'user' | 'assistant'; content: string }[]
  outputMode?: 'inline' | 'downstream'
  seed?: number
  params?: Record<string, unknown>
  loraEnabled?: boolean
  webapp?: string
  machine?: string
  images?: string[]
  elapsedMs?: number
  generatedAt?: string
  results?: string[]
  imageResults?: string[]
  mode?: 'sequential' | 'parallel'
  workflowId?: string
  duration?: number
}

export interface CanvasNode {
  id: string
  type: CanvasNodeType
  title: string
  position: Position
  width: number
  height: number
  metadata?: CanvasNodeMetadata
}

export interface CanvasConnection {
  id: string
  fromNodeId: string
  toNodeId: string
}

export interface ConnectionHandle {
  nodeId: string
  handleType: 'source' | 'target'
}

export interface SelectionBox {
  startWorldX: number
  startWorldY: number
  currentWorldX: number
  currentWorldY: number
  additive: boolean
  initialSelectedNodeIds: string[]
}

export interface CanvasAssistantReference {
  id: string
  type: CanvasNodeType
  title: string
  dataUrl?: string
  storageKey?: string
  text?: string
}

export interface CanvasAssistantImage {
  id: string
  dataUrl: string
  storageKey?: string
  prompt: string
}

export interface CanvasAssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool' | 'error'
  title?: string
  text: string
  meta?: string
  detail?: unknown
  references?: CanvasAssistantReference[]
}

export interface CanvasAssistantSession {
  id: string
  title: string
  messages: CanvasAssistantMessage[]
  createdAt: string
  updatedAt: string
}

export interface CanvasProject {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  chatSessions: CanvasAssistantSession[]
  activeChatId: string | null
  backgroundMode: CanvasBackgroundMode
  showImageInfo: boolean
  viewport: ViewportTransform
}

export type CanvasBackgroundMode = 'dots' | 'lines' | 'blank'

export interface ContextMenuState {
  type: 'node' | 'connection' | 'pane'
  x: number
  y: number
  flowPos?: Position
  nodeId?: string
  connectionId?: string
}

export interface CanvasAgentOp {
  action: string
  params: Record<string, unknown>
}

export interface CanvasAgentSnapshot {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
}

export interface CanvasImageSplitParams {
  rows: number
  columns: number
}

export interface CanvasImageAngleParams {
  horizontalAngle: number
  pitchAngle: number
  cameraDistance: number
  wideAngle: boolean
}
