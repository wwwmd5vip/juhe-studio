/**
 * FFmpeg 检测服务。
 *
 * 检查系统是否安装 FFmpeg，提供安装指引。
 * macOS: brew install ffmpeg
 * Windows: winget install ffmpeg 或手动下载
 * Linux: apt install ffmpeg / dnf install ffmpeg
 */

import { execFile } from 'node:child_process'
import { platform } from 'node:os'
import type { FFmpegDetectResult } from '@shared/types/ffmpeg'

const INSTALL_HINTS: Record<string, string> = {
  darwin: 'FFmpeg not found. Install with: brew install ffmpeg',
  win32: 'FFmpeg not found. Install with: winget install ffmpeg, or download from https://ffmpeg.org/download.html',
  linux: 'FFmpeg not found. Install with: sudo apt install ffmpeg (Debian/Ubuntu) or sudo dnf install ffmpeg (Fedora)'
}

/**
 * 检测 FFmpeg 是否可用。
 * 优先使用环境变量 FFMPEG_PATH，否则搜索 PATH。
 */
export function detectFFmpeg(): Promise<FFmpegDetectResult> {
  return new Promise((resolve) => {
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'

    execFile(ffmpegPath, ['-version'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve({
          installed: false,
          error: error.message,
          installHint: INSTALL_HINTS[platform()] || INSTALL_HINTS.linux
        })
        return
      }

      // 提取版本号：ffmpeg version 7.1.1 ...
      const versionMatch = stdout.match(/ffmpeg version (\S+)/)
      resolve({
        installed: true,
        version: versionMatch?.[1] || 'unknown',
        path: ffmpegPath
      })
    })
  })
}

/** 同步检测（用于快速检查，可能返回 null） */
export function detectFFmpegSync(): FFmpegDetectResult | null {
  try {
    const { execSync } = require('node:child_process')
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'
    const stdout = execSync(`${ffmpegPath} -version`, { timeout: 3000, encoding: 'utf-8' })
    const versionMatch = stdout.match(/ffmpeg version (\S+)/)
    return {
      installed: true,
      version: versionMatch?.[1] || 'unknown',
      path: ffmpegPath
    }
  } catch {
    return null
  }
}
