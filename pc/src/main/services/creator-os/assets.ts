import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { db } from '../../db'
import { assets } from '../../db/schema'
import type { Asset, AssetKind } from '@shared/types/creator-os'
import { getAllowedUserFileRoots, isPathWithinRoot, isPathWithinRoots } from './paths'

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Invalid dataUrl format')
  const mimeType = match[1]
  const base64 = match[2]
  const extByMime: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif'
  }
  return { mimeType, base64, ext: extByMime[mimeType] || '.png' }
}

/** 确保某项目的资产目录存在并返回路径 */
export function ensureAssetDir(projectId: string, root: string): string {
  const dir = join(root, projectId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 路径安全检查：禁止遍历到 userDataRoot 之外 */
export function isPathAllowed(sourcePath: string, userDataRoot: string): boolean {
  return isPathWithinRoot(sourcePath, userDataRoot)
}

/** 根据扩展名推断 MIME 类型 */
export function detectMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.svg': 'image/svg+xml'
  }
  return map[ext.toLowerCase()] ?? 'image/png'
}

/**
 * 将外部文件导入为项目资产。
 * @param projectId 目标项目 ID
 * @param sourcePath 源文件绝对路径
 * @param assetsRoot 资产根目录（由调用方注入，例如 app.getPath('userData') + '/assets'）
 */
export async function importAsset(
  projectId: string,
  sourcePath: string,
  assetsRoot: string
): Promise<Asset> {
  // 安全校验：源文件必须位于允许的用户目录内（文件对话框/拖拽选择的文件所在位置），
  // 拒绝 /etc/passwd、~/.ssh/* 等任意系统/敏感路径读取
  if (!isPathWithinRoots(sourcePath, getAllowedUserFileRoots())) {
    throw new Error(`Access denied: source path is outside allowed directories: ${sourcePath}`)
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const ext = extname(sourcePath)
  const mimeType = detectMimeType(ext)
  const destName = `${id}${ext}`
  const destDir = ensureAssetDir(projectId, assetsRoot)
  const destPath = join(destDir, destName)

  const stats = statSync(sourcePath)

  // 复制文件
  copyFileSync(sourcePath, destPath)

  // 写入数据库
  const record: typeof assets.$inferInsert = {
    id,
    projectId,
    kind: 'source' as AssetKind,
    filePath: destPath,
    mimeType,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }

  await db.insert(assets).values(record)

  const result: Asset = {
    id,
    projectId,
    kind: 'source',
    filePath: destPath,
    mimeType,
    width: null,
    height: null,
    metadata: { size: stats.size },
    status: 'active',
    createdAt: now,
    updatedAt: now
  }

  return result
}

export async function importAssetFromDataUrl(
  projectId: string,
  dataUrl: string,
  fileName: string,
  assetsRoot: string,
  metadata?: Record<string, unknown>
): Promise<Asset> {
  if (typeof projectId !== 'string' || projectId.length === 0) throw new Error('Invalid projectId')
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) throw new Error('Invalid dataUrl')

  const { mimeType, base64, ext } = parseDataUrl(dataUrl)
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0) throw new Error('Empty image data')

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const destExt = extname(fileName) || ext
  const destName = `${id}${destExt}`
  const destDir = ensureAssetDir(projectId, assetsRoot)
  const destPath = join(destDir, destName)

  writeFileSync(destPath, buffer)

  const record: typeof assets.$inferInsert = {
    id,
    projectId,
    kind: 'source',
    filePath: destPath,
    mimeType,
    status: 'active',
    metadata: metadata ?? null,
    createdAt: now,
    updatedAt: now
  }

  await db.insert(assets).values(record)

  return {
    id,
    projectId,
    kind: 'source',
    filePath: destPath,
    mimeType,
    status: 'active',
    metadata: metadata ?? null,
    createdAt: now,
    updatedAt: now
  } satisfies Asset
}
