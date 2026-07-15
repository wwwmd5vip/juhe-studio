// ── 电商套图 Agent 类型 ──

/** 套图幻灯片类型 */
export type ProductSetSlideType = 'main' | 'selling' | 'scene' | 'detail'

/** 套图请求 */
export interface ProductSetRequest {
  /** 商品图 base64 data URL */
  productImage: string
  /** 商品名称（可选，不提供则 AI 自动识别） */
  productName?: string
  /** 品类（可选，不提供则 AI 自动识别） */
  category?: string
  /** Provider ID */
  providerId: string
  /** 模型 ID */
  modelId: string
  /** Vision Provider ID（用于图片分析，默认同 providerId） */
  visionProviderId?: string
  /** Vision Model ID（默认从配置读取） */
  visionModelId?: string
}

/** 单张幻灯片 */
export interface ProductSetSlide {
  type: ProductSetSlideType
  label: string // e.g. "白底主图", "卖点海报", "场景图", "详情头图"
  aspectRatio: string // e.g. "3:4", "1:1", "16:9"
  prompt: string // AI 生成的 image prompt
  copyText?: string // 配图文案
  imageUrl?: string | null // 生成后的图片 URL
  status: 'pending' | 'generating' | 'done' | 'error'
  error?: string
}

/** 套图结果 */
export interface ProductSetResult {
  productName: string
  category: string
  slides: ProductSetSlide[]
}

/** LLM 分析结果（中间产物） */
export interface ProductAnalysis {
  productName: string
  category: string
  attributes: string[] // 主要属性（颜色、材质、风格等）
  slides: Array<{
    type: ProductSetSlideType
    label: string
    prompt: string
    copyText: string
  }>
}
