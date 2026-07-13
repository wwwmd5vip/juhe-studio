/**
 * AI 生成相关类型定义
 */

// 生成任务类型
export type GenerationType = 'image' | 'text' | 'video' | 'audio' | 'jimeng' | 'aliyun-image' | 'aliyun-video'

// 生成任务状态
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused'

// 任务优先级
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

// 图像尺寸
export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024' | '512x512' | '768x768' | '256x256'

// 图像质量
export type ImageQuality = 'standard' | 'hd' | 'high' | 'medium' | 'low'

// 图像风格
export type ImageStyle = 'vivid' | 'natural' | 'digital-art' | 'photographic' | 'anime'

// 生成参数
export interface GenerationParams {
  // 通用
  prompt: string
  negativePrompt?: string
  model?: string
  providerId?: string
  seed?: number
  n?: number

  // 图像特有
  size?: ImageSize
  aspectRatio?: string
  quality?: ImageQuality
  style?: ImageStyle

  // 参考图
  referenceImages?: string[] // base64
  referenceWeight?: number // 0-1 global weight
  referenceWeights?: number[] // per-image weights, parallel to referenceImages
  referenceMode?: 'fusion' | 'controlnet' | 'ipadapter' // how to use references

  // 视频特有
  duration?: number | string // 5, 10, 15, 30 or Pippit strings like "~15s"
  fps?: number // 24, 30, 60
  motionStrength?: number // 0-1
  cameraMotion?: 'static' | 'pan' | 'zoom_in' | 'zoom_out' | 'orbit'
  videoModel?: 'kling-3.0' | 'seedance-2.0' | 'veo-3.1' | 'wan-2.6' | string
  cameraStrength?: 'weak' | 'medium' | 'strong' // Jimeng 运镜强度
  camera?: string // Jimeng 运镜模板ID

  // 视频模式与参考
  mode?: 'text' | 'image' | 'first-last-frame' | 'multi-reference'

  // 图生图变换类型
  transformation?: string

  // 显式生成模式（区分图/视频/音频/文本）
  generationMode?: 'image' | 'video' | 'audio' | 'text'

  // 音频特有
  audioVoice?: string
  audioFormat?: string
  audioSpeed?: string
  audioInstructions?: string
  firstFrame?: string | null // base64
  lastFrame?: string | null // base64
  referenceTags?: string[] // character, scene, object, style

  // 智能扩图参数
  outpaintTop?: number // 0-1
  outpaintBottom?: number // 0-1
  outpaintLeft?: number // 0-1
  outpaintRight?: number // 0-1

  // 智能超清参数
  resolution?: '4k' | '8k' | '720p' | '1080p' | '4K'
  superResolutionScale?: number // 0-100 细节生成程度

  // 素材提取参数
  editPrompt?: string // 提取指令如"提取鞋子"
  loraWeight?: number // POD定制权重

  // 动作模仿参数
  videoUrl?: string // 动作视频URL
  cutResultFirstSecond?: boolean // 动作模仿2.0首秒裁剪

  // 小云雀参数
  productName?: string // 产品名称
  modelImages?: string[] // 模特图URL列表
  videoUrls?: string[] // 参考视频URL列表
  language?: string // 语言
  enableWatermark?: boolean // 是否开启明水印

  // 图片生成4.0/4.6 高级参数
  imageArea?: number // int 面积值 如 4194304
  forceSingle?: boolean // 强制单图
  minRatio?: number // 最小宽高比 如 1/3
  maxRatio?: number // 最大宽高比 如 3

  // 批量生成
  batchCount?: number // 批量数量
  batchPrompts?: string[] // 批量提示词列表
  variationSeed?: boolean // 是否变化 seed

  // 自动优化
  autoOptimize?: boolean

  // 提示词优化器配置
  optimizerProviderId?: string
  optimizerModel?: string
}

// 生成结果
export interface GenerationOutput {
  id: string
  type: GenerationType
  url?: string
  base64?: string
  mediaType?: string
  width?: number
  height?: number
  seed?: number
  revisedPrompt?: string
  isFavorite?: boolean
  favoritedAt?: number
}

// 生成任务（运行时）
export interface GenerationTask {
  id: string
  type: GenerationType
  status: GenerationStatus
  priority: TaskPriority
  params: GenerationParams
  outputs: GenerationOutput[]
  error?: string
  progress: number
  stage: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  pausedAt?: number
  // 供应商异步任务 ID，用于重试时直接查询而非重新提交
  externalTaskId?: string
  // 供应商标识，用于重试时路由到正确的查询逻辑
  externalProvider?: 'jimeng' | 'aliyun'
  // 用于取消进行中的 HTTP 请求
  abortController?: AbortController
}

// 队列状态
export interface QueueState {
  isPaused: boolean
  maxConcurrent: number
  totalTasks: number
  pendingCount: number
  runningCount: number
  completedCount: number
  failedCount: number
  cancelledCount: number
  pausedCount: number
}

// 生成请求
export interface GenerateRequest {
  type: GenerationType
  params: GenerationParams
}

// 生成响应
export interface GenerateResponse {
  taskId: string
  status: GenerationStatus
  outputs?: GenerationOutput[]
  error?: string
}

// 进度更新
export interface GenerationProgress {
  taskId: string
  status: GenerationStatus
  progress: number
  stage: string
  message?: string
  outputs?: GenerationOutput[]
}

// 队列操作请求
export interface QueueControlRequest {
  action: 'pause' | 'resume' | 'clear-completed' | 'clear-failed' | 'clear-all'
}

// 批量任务操作
export interface BatchTaskRequest {
  taskIds: string[]
  action: 'cancel' | 'retry' | 'delete'
}
