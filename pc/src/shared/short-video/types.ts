// ── 脚本引擎类型 ──

/** 镜头类型 */
export type ShotType =
  | 'hook'          // 黄金 3 秒 (吸引注意力)
  | 'pain_point'    // 痛点展示
  | 'product_reveal' // 产品亮相
  | 'demo'          // 使用演示
  | 'social_proof'  // 社交证明
  | 'cta'           // 行动号召

/** 镜头运动 */
export type CameraMotion =
  | 'zoom_in_slow'
  | 'zoom_out_slow'
  | 'pan_left'
  | 'pan_right'
  | 'ken_burns'
  | 'bounce'
  | 'static'

/** 转场类型 */
export type TransitionType =
  | 'ai_start_end'   // AI 生成首尾帧过渡
  | 'ai_reference'   // AI 参考图过渡
  | 'ffmpeg_fade'    // FFmpeg 淡入淡出
  | 'ffmpeg_crossfade'
  | 'ffmpeg_glitch'
  | 'ffmpeg_zoom'
  | 'ffmpeg_lightleak'
  | 'ffmpeg_blur'
  | 'cut'            // 硬切

/** 单个分镜 */
export interface ScriptShot {
  shotId: number
  type: ShotType
  duration: number // 秒
  description: string // 画面描述
  camera: CameraMotion // 镜头运动
  voiceover: string // 配音文案
  prompt: string // AI 生图/生视频 prompt
  motion: CameraMotion // 图片运动效果
  transition: TransitionType // 到下一镜的转场
}

/** 平台 SEO 信息 */
export interface ScriptSEO {
  title: string
  hashtags: string[]
  coverText: string
}

/** 视频品类 */
export type VideoCategory = 'beauty' | 'food' | 'fashion' | 'home' | 'digital'

/** 视频风格 */
export type VideoStyle = 'pain_point' | 'scene' | 'comparison' | 'drama'

/** 平台 */
export type VideoPlatform = 'douyin' | 'kuaishou' | 'xiaohongshu' | 'wechat' | 'tiktok'

/** 视频模式 */
export type VideoMode = 'short' | 'opening' | 'review'

/** 完整脚本 */
export interface VideoScript {
  title: string
  category: VideoCategory
  style: VideoStyle
  platform: VideoPlatform
  shots: ScriptShot[]
  seo: ScriptSEO
}

/** 生成脚本请求 */
export interface ScriptGenerateRequest {
  /** 商品名称 */
  productName: string
  /** 商品描述 */
  productDescription?: string
  /** 商品卖点 */
  sellingPoints?: string[]
  /** 品类 */
  category: VideoCategory
  /** 风格 */
  style: VideoStyle
  /** 目标平台 */
  platform: VideoPlatform
  /** 视频模式 */
  mode?: VideoMode
  /** 自定义额外指令 */
  customInstructions?: string
  /** 使用的 Provider ID */
  providerId: string
  /** 使用的模型 ID */
  modelId: string
}
