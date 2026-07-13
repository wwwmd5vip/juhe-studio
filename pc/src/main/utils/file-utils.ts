/**
 * File and image handling utilities.
 * Centralizes atomic file writes, hash-based filenames, path validation,
 * image URL-to-base64 resolution, and directory creation.
 */

import crypto from 'node:crypto'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { fromJuheImageURL, parseDataUrl } from '@shared/utils/data-url'
import { getExtension, getMimeType } from '@shared/utils/mime-types'
import { app } from 'electron'

/**
 * Resolve a sub-path under Electron's userData directory and create it if it doesn't exist.
 */
export function ensureDir(subPath: string): string {
  const dir = path.join(app.getPath('userData'), subPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Check if a child path is inside a parent directory.
 */
export function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Write a file atomically by writing to a temp file then renaming.
 */
export function atomicWriteFile(filepath: string, data: Buffer | string): void {
  const tmpPath = `${filepath}.tmp.${process.pid}`
  writeFileSync(tmpPath, data)
  renameSync(tmpPath, filepath)
}

/**
 * Generate a deterministic filename from base64 data using MD5 hash.
 */
export function generateImageFilename(base64Data: string, mimeType: string): string {
  const hash = crypto.createHash('md5').update(base64Data).digest('hex')
  const ext = getExtension(mimeType)
  return `${hash}.${ext}`
}

/**
 * Resolve an image URL to base64 data.
 * Supports data: URLs, juhe-image:// URLs, file:// URLs, and http(s):// URLs.
 */
export async function resolveImageUrlToBase64(url: string): Promise<string> {
  // data: URL
  const parsed = parseDataUrl(url)
  if (parsed) {
    return parsed.base64
  }

  // juhe-image:// URL
  if (url.startsWith('juhe-image://')) {
    const filePath = fromJuheImageURL(url)
    const buffer = await readFile(filePath)
    return buffer.toString('base64')
  }

  // file:// URL
  if (url.startsWith('file://')) {
    const filePath = url.replace(/^file:\/\//, '')
    const buffer = await readFile(decodeURIComponent(filePath))
    return buffer.toString('base64')
  }

  // http(s):// URL — fetch and convert
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}
