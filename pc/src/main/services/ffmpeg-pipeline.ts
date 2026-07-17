/**
 * FFmpeg 视频合成管线。
 *
 * 核心能力：
 * - 图片/视频片段拼接 + 转场效果
 * - Ken Burns 运动效果（6 种）
 * - 背景音乐混音
 * - 字幕叠加
 *
 * 使用 child_process.execFile 调用系统 FFmpeg。
 */

import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  ComposeRequest,
  ComposeProgress,
  ComposeResult,
  KenBurnsMotion
} from '@shared/types/ffmpeg'
import { detectFFmpeg } from './ffmpeg-detect'

// ── Ken Burns 滤镜 ──

const KEN_BURNS_FILTERS: Record<KenBurnsMotion, string> = {
  zoom_in_slow: 'zoompan=z=\'min(zoom+0.001,1.5)\':d=1:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\'',
  zoom_out_slow: 'zoompan=z=\'max(zoom-0.001,0.67)\':d=1:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\'',
  pan_left: 'zoompan=z=1.3:x=\'x+2\':y=\'ih/2-(ih/zoom/2)\':d=1',
  pan_right: 'zoompan=z=1.3:x=\'x-2\':y=\'ih/2-(ih/zoom/2)\':d=1',
  ken_burns: 'zoompan=z=\'min(zoom+0.0008,1.4)\':x=\'iw/2-(iw/zoom/2)+sin(time*0.5)*10\':y=\'ih/2-(ih/zoom/2)+cos(time*0.3)*5\':d=1',
  bounce: 'zoompan=z=\'if(lte(t,0.33),1+0.5*t/0.33,if(lte(t,0.66),1.5-0.3*(t-0.33)/0.33,1.2+0.1*(t-0.66)/0.34))\':d=1',
  none: ''
}

// ── 转场效果（使用 xfade 滤镜） ──

const TRANSITION_EFFECTS: Record<string, string> = {
  fade: 'fade',
  crossfade: 'fade',
  glitch: 'pixelize',
  zoom: 'zoomin',
  lightleak: 'fadewhite',
  blur: 'fadegrays'
}

/**
 * 生成单个片段的 FFmpeg 滤镜字符串。
 */
function buildClipFilter(
  clip: { duration: number; motion?: KenBurnsMotion },
  outputSize: { width: number; height: number },
  clipIndex: number
): string {
  const { width, height } = outputSize
  const motion = clip.motion || 'none'
  const motionFilter = KEN_BURNS_FILTERS[motion] || ''

  // 缩放到目标分辨率 + 居中裁剪
  let filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`

  // 如果是图片，添加运动效果
  if (motion !== 'none') {
    filter += `,${motionFilter},fps=30,trim=duration=${clip.duration}`
  }

  return filter
}

/**
 * 生成转场 xfade 滤镜字符串。
 */
function buildXfade(
  transition: string | undefined,
  duration: number,
  offset: number
): string {
  if (!transition || transition === 'none') return ''
  const effect = TRANSITION_EFFECTS[transition] || 'fade'
  return `xfade=transition=${effect}:duration=${duration}:offset=${offset}`
}

/**
 * 组合视频片段。
 *
 * 流程：
 * 1. 为每个片段构建缩放/运动滤镜
 * 2. 用 concat 滤镜拼接（带转场）
 * 3. 叠加背景音乐
 * 4. 叠加字幕
 * 5. 编码输出
 */
async function composeClips(
  req: ComposeRequest,
  onProgress?: (p: ComposeProgress) => void
): Promise<ComposeResult> {
  const {
    clips,
    outputPath,
    outputSize = { width: 1080, height: 1920 },
    fps = 30,
    bgm,
    subtitles,
    bitrate = '2M'
  } = req

  if (clips.length === 0) {
    return { success: false, error: 'No clips provided' }
  }

  // 确保输出目录存在
  mkdirSync(dirname(outputPath), { recursive: true })

  // 验证所有输入文件
  for (const clip of clips) {
    if (!existsSync(clip.path)) {
      return { success: false, error: `File not found: ${clip.path}` }
    }
  }

  // 构建 FFmpeg 命令参数
  const args: string[] = ['-y'] // 覆盖输出

  // 输入文件
  for (const clip of clips) {
    args.push('-loop', '1', '-t', String(clip.duration), '-i', clip.path)
  }

  // 背景音乐输入
  let hasBGM = false
  if (bgm && existsSync(bgm.path)) {
    args.push('-stream_loop', bgm.loop ? '-1' : '0', '-i', bgm.path)
    hasBGM = true
  }

  // 构建滤镜图
  const filterParts: string[] = []
  const totalOffset = 0
  const transitionDuration = clips[0]?.transitionDuration || 0.5

  // 为每个片段构建滤镜 + 转场
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    onProgress?.({
      currentClip: i + 1,
      totalClips: clips.length,
      stage: 'resizing',
      percent: Math.round(((i + 1) / clips.length) * 40)
    })

    const clipFilter = buildClipFilter(clip, outputSize, i)
    filterParts.push(`[${i}:v]${clipFilter}[v${i}]`)

    if (i > 0) {
      const xfade = buildXfade(clip.transition, transitionDuration, totalOffset - transitionDuration)
      if (xfade) {
        filterParts.push(`[vprev][v${i}]${xfade}[vout]`)
      }
    }
  }

  // 拼接所有处理后的片段
  const filterComplex = filterParts.join(';')

  args.push('-filter_complex', filterComplex)
  args.push('-r', String(fps))
  args.push('-c:v', 'libx264')
  args.push('-preset', 'medium')
  args.push('-b:v', bitrate)
  args.push('-pix_fmt', 'yuv420p')

  // BGM 混音
  if (hasBGM) {
    const bgmIdx = clips.length
    let audioFilter = `[${bgmIdx}:a]`
    if (bgm?.volume !== undefined) {
      audioFilter += `volume=${bgm.volume},`
    }
    if (bgm?.fadeIn !== undefined && bgm?.fadeOut !== undefined) {
      audioFilter += `afade=t=in:d=${bgm.fadeIn},afade=t=out:st=${totalOffset - (bgm.fadeOut || 0)}:d=${bgm.fadeOut},`
    }
    audioFilter += 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]'
    args.push('-filter_complex', audioFilter)
    args.push('-map', '[aout]')
  }

  // 字幕
  if (subtitles && subtitles.length > 0) {
    const srtContent = subtitles
      .map((sub, i) => {
        const formatTime = (s: number) => {
          const h = Math.floor(s / 3600)
          const m = Math.floor((s % 3600) / 60)
          const sec = (s % 60).toFixed(3)
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(6, '0')}`
        }
        return `${i + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`
      })
      .join('\n')

    // 写临时 SRT 文件
    const { writeFileSync, unlinkSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const srtPath = join(tmpdir(), `juhe-sub-${Date.now()}.srt`)
    writeFileSync(srtPath, srtContent, 'utf-8')

    args.push('-vf', `subtitles=${srtPath.replace(/:/g, '\\:')}:force_style='FontSize=24,Alignment=2'`)
  }

  args.push('-map', '0:v')
  args.push(outputPath)

  onProgress?.({ currentClip: clips.length, totalClips: clips.length, stage: 'encoding', percent: 50 })

  return new Promise((resolve) => {
    execFile(
      process.env.FFMPEG_PATH || 'ffmpeg',
      args,
      { timeout: 600_000, maxBuffer: 10 * 1024 * 1024 }, // 10 分钟超时
      (error, _stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: stderr?.slice(-500) || error.message
          })
          return
        }

        // 提取时长
        const durationMatch = stderr?.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        let duration: number | undefined
        if (durationMatch) {
          duration =
            parseInt(durationMatch[1]) * 3600 +
            parseInt(durationMatch[2]) * 60 +
            parseFloat(durationMatch[3])
        }

        resolve({
          success: true,
          outputPath,
          duration
        })
      }
    )
  })
}

// ── 公共 API ──

/**
 * 执行视频合成（入口函数）。
 * 先检测 FFmpeg 可用性，然后执行合成。
 */
export async function executeCompose(
  req: ComposeRequest,
  onProgress?: (p: ComposeProgress) => void
): Promise<ComposeResult> {
  const ffmpeg = await detectFFmpeg()
  if (!ffmpeg.installed) {
    return {
      success: false,
      error: ffmpeg.installHint || 'FFmpeg is not installed'
    }
  }

  return composeClips(req, onProgress)
}

/** 解析视频时长（用于预览） */
export async function parseVideoDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      process.env.FFMPEG_PATH || 'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ],
      { timeout: 10000 },
      (error, stdout) => {
        if (error) {
          resolve(null)
          return
        }
        const duration = parseFloat(stdout.trim())
        resolve(isNaN(duration) ? null : duration)
      }
    )
  })
}
