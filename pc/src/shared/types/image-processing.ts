/**
 * 图像处理类型定义
 * M3 Phase 1: 图生图 + 局部重绘 + Upscale
 */

export type ImageProcessType =
  | 'img2img' // 图生图
  | 'inpaint' // 局部重绘
  | 'upscale' // 超分辨率
  | 'remove-bg' // 背景移除
  | 'outpaint' // 扩图
  | 'variant' // 变体

export interface ImageProcessTask {
  id: string
  type: ImageProcessType
  sourceImage: string // base64
  prompt?: string
  negativePrompt?: string
  maskImage?: string // base64 mask for inpaint
  strength?: number // 0-1, img2img strength
  scaleFactor?: number // upscale 倍数
  providerId?: string
  modelId?: string
  parameters?: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  outputs: ImageProcessOutput[]
  error?: string
  progress: number
  stage: string
  createdAt: number
  completedAt?: number
}

export interface ImageProcessOutput {
  id: string
  base64: string
  mediaType: string
  width?: number
  height?: number
}

export interface ImageProcessRequest {
  type: ImageProcessType
  sourceImage: string
  prompt?: string
  negativePrompt?: string
  maskImage?: string
  strength?: number
  scaleFactor?: number
  providerId?: string
  modelId?: string
  parameters?: Record<string, unknown>
}

export interface ImageProcessProgress {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  stage: string
  message?: string
  outputs?: ImageProcessOutput[]
}
