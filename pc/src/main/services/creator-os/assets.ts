import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { db } from '../../db'
import { assets } from '../../db/schema'
import type { Asset, AssetKind } from '@shared/types/creator-os'

/** 确保某项目的资产目录存在并返回路径 */
export function ensureAssetDir(projectId: string, root: string): string {
  const dir = join(root, projectId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 路径安全检查：禁止遍历到 userDataRoot 之外 */
export function isPathAllowed(sourcePath: string, userDataRoot: string): boolean {
  const normalized = resolve(sourcePath)
  const allowed = resolve(userDataRoot)
  return normalized.startsWith(allowed + '/') || normalized.startsWith(allowed + '\\')
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
