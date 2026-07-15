// ── FFmpeg 视频合成共享类型 ──

/** Ken Burns 运动效果类型 */
export type KenBurnsMotion =
  | 'zoom_in_slow'
  | 'zoom_out_slow'
  | 'pan_left'
  | 'pan_right'
  | 'ken_burns'
  | 'bounce'
  | 'none'

/** 转场效果类型 */
export type TransitionType =
  | 'fade'
  | 'crossfade'
  | 'glitch'
  | 'zoom'
  | 'lightleak'
  | 'blur'
  | 'none'

/** 视频片段 */
export interface VideoClip {
  /** 输入文件路径（图片或视频） */
  path: string
  /** 片段时长（秒），图片默认 3s */
  duration: number
  /** Ken Burns 运动效果 */
  motion?: KenBurnsMotion
  /** 转场效果（进入此片段的转场） */
  transition?: TransitionType
  /** 转场时长（秒） */
  transitionDuration?: number
}

/** 背景音乐配置 */
export interface BGMConfig {
  /** 音频文件路径 */
  path: string
  /** 音量（0.0–1.0） */
  volume?: number
  /** 是否循环 */
  loop?: boolean
  /** 淡入时长（秒） */
  fadeIn?: number
  /** 淡出时长（秒） */
  fadeOut?: number
}

/** 字幕条目 */
export interface SubtitleEntry {
  /** 开始时间（秒） */
  start: number
  /** 结束时间（秒） */
  end: number
  /** 字幕文本 */
  text: string
}

/** 视频合成请求 */
export interface ComposeRequest {
  /** 输出文件路径 */
  outputPath: string
  /** 视频片段列表 */
  clips: VideoClip[]
  /** 输出分辨率，默认 1080x1920（竖屏） */
  outputSize?: { width: number; height: number }
  /** 帧率，默认 30 */
  fps?: number
  /** 背景音乐 */
  bgm?: BGMConfig
  /** 字幕列表 */
  subtitles?: SubtitleEntry[]
  /** 视频比特率，默认 '2M' */
  bitrate?: string
}

/** 合成进度 */
export interface ComposeProgress {
  /** 当前片段索引 */
  currentClip: number
  /** 总片段数 */
  totalClips: number
  /** 当前阶段 */
  stage: 'resizing' | 'composing' | 'mixing_audio' | 'subtitles' | 'encoding'
  /** 进度百分比 */
  percent: number
}

/** FFmpeg 检测结果 */
export interface FFmpegDetectResult {
  installed: boolean
  version?: string
  path?: string
  error?: string
  installHint?: string
}

/** 合成结果 */
export interface ComposeResult {
  success: boolean
  outputPath?: string
  error?: string
  duration?: number
}
