import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { deliverables, versions } from '../../db/schema'
import type { ExportResult } from '@shared/types/creator-os'
import { getAllowedUserFileRoots, isPathWithinRoots } from './paths'

export function resolveConflict(filename: string, existing: Set<string>): string {
  if (!existing.has(filename)) return filename
  const dot = filename.lastIndexOf('.')
  const name = dot > 0 ? filename.slice(0, dot) : filename
  const ext = dot > 0 ? filename.slice(dot) : ''
  let i = 1
  let candidate: string
  do {
    candidate = `${name} (${i})${ext}`
    i++
  } while (existing.has(candidate))
  return candidate
}

export async function exportAssets(
  projectId: string,
  outputDir: string
): Promise<ExportResult> {
  // 安全校验：导出目录必须位于允许的用户目录内，拒绝 /System、/usr 等任意系统目录写入
  if (!isPathWithinRoots(outputDir, getAllowedUserFileRoots())) {
    return {
      ok: false,
      exportedCount: 0,
      errors: [`Access denied: output directory is outside allowed directories: ${outputDir}`]
    }
  }

  const items = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.projectId, projectId), eq(deliverables.isSelected, true)))
    .orderBy(deliverables.sortOrder)

  if (items.length === 0) {
    return { ok: false, exportedCount: 0, errors: ['No selected deliverables to export'] }
  }

  mkdirSync(outputDir, { recursive: true })
  const existing = new Set<string>()
  let exported = 0
  const errors: string[] = []

  for (const del of items) {
    const versionRows = del.versionId
      ? await db.select().from(versions).where(eq(versions.id, del.versionId)).limit(1)
      : []
    const version = versionRows[0]
    if (!version || !version.filePath) {
      errors.push(`No file for deliverable "${del.label}" (${del.id})`)
      continue
    }
    if (!existsSync(version.filePath)) {
      errors.push(`File not found: ${version.filePath}`)
      continue
    }

    const ext = version.filePath.slice(version.filePath.lastIndexOf('.') || undefined)
    const rawName = `${del.label}${ext}`.replace(/[<>:"/\\|?*]/g, '_')
    const destName = resolveConflict(rawName, existing)
    existing.add(destName)

    copyFileSync(version.filePath, join(outputDir, destName))
    exported++
  }

  return { ok: errors.length === 0, exportedCount: exported, errors }
}
