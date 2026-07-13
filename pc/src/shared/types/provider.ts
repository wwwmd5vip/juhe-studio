/**
 * Provider 与 Model 类型定义
 * 整合数据库层 (Drizzle) 与 Registry 层 (provider-registry) 的类型
 */

import type {
  EndpointType,
  Modality,
  ImageGenerationSupport as RegistryImageGenerationSupport,
  ModelCapability as RegistryModelCapability,
  ModelConfig as RegistryModelConfig,
  ProviderConfig as RegistryProviderConfig
} from '@cherrystudio/provider-registry'

// Re-export registry ModelCapability for convenience
export type { RegistryModelCapability }

/** UI-facing model capability vocabulary (mirrors registry values where possible) */
export type ModelCapability =
  | 'chat'
  | 'reasoning'
  | 'vision'
  | 'websearch'
  | 'embedding'
  | 'function_calling'
  | 'image'
  | 'video'
  | 'audio'
  | 'free'

// ============================================================
// 数据库层类型 (与 src/main/db/schema.ts 对应)
// ============================================================

/** 数据库中的 Provider 记录 */
export interface DbProvider {
  id: string
  name: string
  type: string // endpoint type, e.g. 'openai-chat-completions'
  presetId: string | null
  baseUrl: string | null
  apiKey: string | null
  // Volcengine-style dual-key auth
  accessKeyId: string | null
  secretAccessKey: string | null
  isEnabled: boolean
  isCustom: boolean
  createdAt: string
  updatedAt: string
}

/** 数据库中的 Model 记录 */
export interface DbModel {
  id: string
  providerId: string
  name: string
  displayName: string | null
  type: string
  capabilities: string[] | null
  parameters: Record<string, unknown> | null
  isEnabled: boolean
  createdAt: string
}

// ============================================================
// 运行时类型 (UI 层使用)
// ============================================================

/** 用户配置的 Provider，合并数据库记录与运行时状态 */
export interface Provider extends DbProvider {
  /** 连接状态 */
  connectionStatus: 'unknown' | 'connected' | 'error'
  /** 最后连接错误信息 */
  lastError?: string
  /** 该 Provider 下的模型列表 */
  models: Model[]
}

/** 用户配置的 Model，合并数据库记录与 Registry 元数据 */
export interface Model extends DbModel {
  /** Registry 中的完整模型配置 (如果匹配到) */
  registryConfig?: RegistryModelConfig
  /** Registry 图像生成配置 (如果匹配到) */
  imageGeneration?: RegistryImageGenerationSupport
  /** 是否从 Provider 自动拉取 */
  isAutoFetched: boolean
}

// ============================================================
// Provider 预设配置
// ============================================================

/** 预设 Provider 模板 */
export interface ProviderPreset {
  id: string
  name: string
  description?: string
  type: EndpointType
  defaultBaseUrl: string
  apiKeyUrl?: string
  docsUrl?: string
  modelsUrl?: string
  /** 是否支持模型列表自动拉取 */
  supportsModelList: boolean
  /** 该预设支持的模型能力 (用于 UI 筛选) */
  capabilities?: RegistryModelCapability[]
  /** 认证类型: 'apiKey' (默认) | 'dualKey' (AK/SK 双密钥, 如火山引擎) */
  authType?: 'apiKey' | 'dualKey'
  /** 默认模型列表 (用于不支持模型列表自动拉取的 provider) */
  defaultModels?: { name: string; displayName: string; capabilities?: string[] }[]
}

// ============================================================
// API 请求/响应类型
// ============================================================

/** 创建 Provider 请求 */
export interface CreateProviderRequest {
  name: string
  type: string
  baseUrl: string
  apiKey?: string
  accessKeyId?: string
  secretAccessKey?: string
  isEnabled?: boolean
  isCustom?: boolean
  presetId?: string
  parameters?: Record<string, unknown>
}

/** 更新 Provider 请求 */
export interface UpdateProviderRequest {
  id: string
  name?: string
  type?: string
  baseUrl?: string
  apiKey?: string
  accessKeyId?: string
  secretAccessKey?: string
  isEnabled?: boolean
  presetId?: string
}

/** 连接测试结果 */
export interface ConnectionTestResult {
  success: boolean
  message: string
  latency?: number // ms
  models?: Array<{
    id: string
    name: string
    capabilities?: RegistryModelCapability[]
  }>
}

/** 模型拉取结果 */
export interface FetchModelsResult {
  providerId: string
  models: Array<{
    modelId: string
    name: string
    capabilities: ModelCapability[]
    modalities?: { input: Modality[]; output: Modality[] }
    contextWindow?: number
  }>
  total: number
  added: number
  updated: number
  error?: string
}

// ============================================================
// 参数面板类型
// ============================================================

/** 模型参数定义 (用于动态生成参数面板) */
export interface ModelParameterDef {
  key: string
  label: string
  type: 'number' | 'slider' | 'boolean' | 'select' | 'text'
  defaultValue: unknown
  min?: number
  max?: number
  step?: number
  options?: Array<{ label: string; value: string }>
  description?: string
}

/** 常用模型参数 */
export const COMMON_PARAMETERS: ModelParameterDef[] = [
  {
    key: 'temperature',
    label: 'Temperature',
    type: 'slider',
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
    description: '控制输出的随机性，值越高越 creative'
  },
  {
    key: 'topP',
    label: 'Top P',
    type: 'slider',
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.05,
    description: '核采样概率阈值'
  },
  {
    key: 'maxTokens',
    label: 'Max Tokens',
    type: 'number',
    defaultValue: 2048,
    min: 1,
    max: 128000,
    step: 1,
    description: '最大生成 token 数'
  },
  {
    key: 'frequencyPenalty',
    label: 'Frequency Penalty',
    type: 'slider',
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
    description: '降低重复 token 的频率'
  },
  {
    key: 'presencePenalty',
    label: 'Presence Penalty',
    type: 'slider',
    defaultValue: 0,
    min: -2,
    max: 2,
    step: 0.1,
    description: '增加新话题的倾向'
  }
]

// ============================================================
// Re-export registry types for convenience
// ============================================================

export type { RegistryProviderConfig, RegistryModelConfig }
