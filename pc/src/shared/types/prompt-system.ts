/**
 * 提示词系统类型定义
 * Phase 4: Prompt System & History
 */

// ===== 预设词库 =====

export type PresetCategory =
  | 'style' // 风格
  | 'medium' // 媒介
  | 'camera' // 镜头
  | 'lighting' // 光影
  | 'quality' // 画质
  | 'color' // 色彩
  | 'mood' // 氛围
  | 'detail' // 细节
  | 'subject' // 主体
  | 'background' // 背景
  | 'pose' // 姿态
  | 'era' // 时代

export interface PresetTag {
  id: string
  label: string
  en: string // 英文提示词（实际插入的内容）
  zh: string // 中文标签名
  category: PresetCategory
  weight?: number // 默认权重
  popular?: boolean // 是否热门
}

export interface PresetCategoryConfig {
  id: PresetCategory
  label: string
  icon: string // lucide icon name
  description: string
}

// ===== 提示词模板 =====

export interface PromptTemplate {
  id: string
  name: string
  description: string
  prompt: string // 模板内容，支持 {{variable}} 占位
  variables: TemplateVariable[]
  category: string
  tags: string[]
  example?: string
  createdAt: string
  updatedAt: string
  usageCount: number
  coverImage?: string
  isFavorite?: boolean
}

export interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'select' | 'number'
  default?: string
  options?: string[] // select 类型的选项
  required?: boolean
}

// ===== 提示词优化 =====

export interface PromptOptimizeRequest {
  prompt: string
  mode: 'enhance' | 'translate' | 'simplify' | 'creative'
  modelId?: string
  providerId?: string
}

export interface PromptOptimizeResult {
  original: string
  optimized: string
  explanation?: string
}

// ===== 生成历史筛选 =====

export interface GenerationHistoryFilter {
  type?: 'image' | 'text'
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  favorite?: boolean
  providerId?: string
  modelId?: string
}

export interface GenerationHistoryEntry {
  id: string
  type: 'image' | 'text'
  prompt: string
  providerId: string
  modelId: string
  status: string
  parameters?: Record<string, unknown>
  result?: unknown
  favorite: boolean
  createdAt: string
  updatedAt: string
}
