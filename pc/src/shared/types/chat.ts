/**
 * 聊天相关类型定义
 * 1:1 复刻 Cherry Studio 的 MessageBlock 架构
 */

// ==================== 基础类型 ====================

export type MessageRole = 'user' | 'assistant' | 'system'

// 消息状态 - 对齐 Cherry Studio
export type MessageStatus = 'sending' | 'streaming' | 'success' | 'error' | 'paused' | 'cancelled'

// 消息块类型 - 1:1 复刻 Cherry Studio
export enum MessageBlockType {
  UNKNOWN = 'unknown',
  MAIN_TEXT = 'main_text',
  THINKING = 'thinking',
  TRANSLATION = 'translation',
  IMAGE = 'image',
  CODE = 'code',
  TOOL = 'tool',
  FILE = 'file',
  ERROR = 'error',
  CITATION = 'citation',
  VIDEO = 'video',
  COMPACT = 'compact'
}

// 消息块状态 - 1:1 复刻 Cherry Studio
export enum MessageBlockStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  STREAMING = 'streaming',
  SUCCESS = 'success',
  ERROR = 'error',
  PAUSED = 'paused'
}

// ==================== 序列化错误 ====================

export interface SerializedError {
  message: string
  status?: number
  statusCode?: number
  providerId?: string
  modelId?: string
  i18nKey?: string
}

// ==================== MessageBlock 基础类型 ====================

export interface BaseMessageBlock {
  id: string
  messageId: string
  type: MessageBlockType
  status: MessageBlockStatus
  createdAt: string
  updatedAt?: string
  metadata?: Record<string, unknown>
  error?: SerializedError
}

// 占位块（流式加载时）
export interface PlaceholderMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.UNKNOWN
}

// 主文本块
export interface MainTextMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.MAIN_TEXT
  content: string
  citationReferences?: {
    citationBlockId?: string
    citationBlockSource?: unknown
  }[]
}

// 思考过程块
export interface ThinkingMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.THINKING
  content: string
  thinking_millsec?: number
}

// 翻译块
export interface TranslationMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.TRANSLATION
  content: string
  sourceBlockId?: string
  sourceLanguage?: string
  targetLanguage?: string
}

// 代码块
export interface CodeMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.CODE
  content: string
  language?: string
}

// 图片块
export interface ImageMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.IMAGE
  url?: string
  file?: FileMetadata
  metadata?: BaseMessageBlock['metadata'] & {
    prompt?: string
    negativePrompt?: string
    generateImageResponse?: unknown
  }
}

// 工具调用块
export interface ToolMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.TOOL
  toolId: string
  toolName?: string
  arguments?: Record<string, unknown>
  content?: string | object
  metadata?: BaseMessageBlock['metadata'] & {
    rawMcpToolResponse?: unknown
  }
}

// 文件块
export interface FileMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.FILE
  file: FileMetadata
}

// 引用块
export interface CitationMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.CITATION
  response?: unknown
  knowledge?: unknown[]
  memories?: unknown[]
}

// 视频块
export interface VideoMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.VIDEO
  url?: string
  filePath?: string
}

// 错误块
export interface ErrorMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.ERROR
}

// Compact 块
export interface CompactMessageBlock extends BaseMessageBlock {
  type: MessageBlockType.COMPACT
  content: string
  compactedContent: string
}

// 消息块联合类型
export type MessageBlock =
  | PlaceholderMessageBlock
  | MainTextMessageBlock
  | ThinkingMessageBlock
  | TranslationMessageBlock
  | CodeMessageBlock
  | ImageMessageBlock
  | ToolMessageBlock
  | FileMessageBlock
  | ErrorMessageBlock
  | CitationMessageBlock
  | VideoMessageBlock
  | CompactMessageBlock

// 文件元数据
export interface FileMetadata {
  id: string
  name: string
  path?: string
  url?: string
  size?: number
  type: string
  ext?: string
}

// ==================== 聊天消息 ====================

export interface ChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string // 兼容旧版，主文本内容（从 blocks 同步）
  blocks?: MessageBlock[] // 新版 Block 结构
  status: MessageStatus
  attachments?: Array<{ type: string; url: string; name?: string }>
  modelId?: string
  providerId?: string
  tokensUsed?: number
  latency?: number
  createdAt: string
  updatedAt?: string
}

// ==================== 聊天会话 ====================

export interface ChatSession {
  id: string
  title: string
  providerId?: string
  modelId?: string
  systemPrompt?: string
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

// ==================== 流式消息 chunk ====================

export interface ChatStreamChunk {
  sessionId: string
  messageId: string
  textDelta?: string
  thinkingDelta?: string
  finishReason?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  error?: SerializedError
  toolCall?: {
    id: string
    name: string
    arguments: Record<string, unknown>
  }
  toolResult?: {
    id: string
    name: string
    result: string
    error?: boolean
  }
}

// ==================== 请求类型 ====================

export interface CreateSessionRequest {
  title?: string
  providerId?: string
  modelId?: string
  systemPrompt?: string
}

export interface SendMessageRequest {
  sessionId: string
  content: string
  providerId: string
  modelId: string
  systemPrompt?: string
  attachments?: Array<{ type: string; url: string; name?: string }>
  messageId?: string
  /** 启用生成工具（generate_image, generate_video, generate_product_set） */
  enableGenerationTools?: boolean
}

export interface ChatMessageForAI {
  role: MessageRole
  content: string
}

// ==================== 错误分类 ====================

export interface ErrorClassification {
  category:
    | 'auth'
    | 'model'
    | 'quota'
    | 'context_length'
    | 'payload'
    | 'network'
    | 'proxy'
    | 'stream'
    | 'content'
    | 'server'
    | 'deprecated'
    | 'parse'
    | 'generation'
    | 'unknown'
  i18nKey: string
  navTarget: string | null
}

// ==================== Chat Assistant (智能体/助手) ====================

export interface ChatAssistant {
  id: string
  name: string
  emoji: string
  systemPrompt: string
  description: string
  modelId?: string
  providerId?: string
  isPreset: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
