import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { parseMarkdown, type PromptRow } from './parse-md.js'
import { parseXlsx } from './parse-xlsx.js'
import { parseJson, parseJsonl } from './parse-json.js'
import { db } from '../db/connection.js'

type FileType = 'md' | 'xlsx' | 'jsonl' | 'json' | 'unknown'

interface SourceFile {
  filePath: string
  file: string
  type: FileType
}

function getFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.md') return 'md'
  if (ext === '.xlsx') return 'xlsx'
  if (ext === '.jsonl') return 'jsonl'
  if (ext === '.json') return 'json'
  return 'unknown'
}

function collectSourceFiles(dir: string, maxDepth = 5, depth = 0, seen = new Set<string>()): SourceFile[] {
  if (depth > maxDepth) return []
  const files: SourceFile[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    let stats: fs.Stats
    try {
      stats = fs.statSync(fullPath)
    } catch {
      // Skip entries that cannot be stat'd (broken symlinks, permission errors).
      continue
    }
    const key = `${stats.dev}:${stats.ino}`
    if (seen.has(key)) continue
    seen.add(key)
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath, maxDepth, depth + 1, seen))
    } else if (stats.isFile()) {
      files.push({ filePath: fullPath, file: '', type: getFileType(fullPath) })
    }
  }
  return files
}

function parseFile(file: string, filePath: string, type: FileType): PromptRow[] {
  switch (type) {
    case 'md':
      return parseMarkdown(file, fs.readFileSync(filePath, 'utf-8'))
    case 'xlsx':
      return parseXlsx(file, fs.readFileSync(filePath))
    case 'jsonl':
      return parseJsonl(file, fs.readFileSync(filePath, 'utf-8'))
    case 'json':
      return parseJson(file, fs.readFileSync(filePath, 'utf-8'))
    default:
      return []
  }
}

export function importPrompts(sourceDir: string, database: Database.Database = db): string[] {
  const allFiles = collectSourceFiles(sourceDir).map((f) => ({
    ...f,
    file: path.relative(sourceDir, f.filePath)
  }))

  const knownFiles = allFiles.filter((f) => f.type !== 'unknown')
  const unknownFiles = allFiles.filter((f) => f.type === 'unknown')
  const skippedByExtension: Record<string, number> = {}
  for (const f of unknownFiles) {
    const ext = path.extname(f.filePath).toLowerCase() || '(no extension)'
    skippedByExtension[ext] = (skippedByExtension[ext] ?? 0) + 1
  }

  const insert = database.prepare(`
    INSERT INTO prompts (source_file, source_id, title, content, negative_prompt, category, style, original_style, scene, image_type, product_category, platform_source, source_url, remark, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_file, source_id) DO UPDATE SET
      title=excluded.title,
      content=excluded.content,
      category=excluded.category,
      style=excluded.style,
      original_style=excluded.original_style,
      scene=excluded.scene,
      image_type=excluded.image_type,
      product_category=excluded.product_category,
      platform_source=excluded.platform_source,
      source_url=excluded.source_url,
      remark=excluded.remark,
      tags=excluded.tags,
      updated_at=CURRENT_TIMESTAMP
  `)

  const exists = database.prepare(`
    SELECT 1 FROM prompts WHERE source_file = ? AND source_id = ? LIMIT 1
  `)

  let total = 0
  let inserted = 0
  let updated = 0
  const failed: string[] = []

  for (const { file, filePath, type } of knownFiles) {
    let rows: PromptRow[]
    try {
      rows = parseFile(file, filePath, type)
    } catch (err) {
      console.warn(`[import] failed to parse ${file}:`, err)
      failed.push(file)
      continue
    }

    const importOneFile = database.transaction((fileRows: PromptRow[]) => {
      for (const row of fileRows) {
        const alreadyExists = exists.get(row.source_file, row.source_id) !== undefined
        insert.run(...rowToParams(row))
        if (alreadyExists) {
          updated++
        } else {
          inserted++
        }
        total++
      }
    })

    try {
      importOneFile(rows)
    } catch (err) {
      console.warn(`[import] failed to import ${file}:`, err)
      failed.push(file)
    }
  }

  console.log(`[import] total=${total} inserted=${inserted} updated=${updated}`)

  if (unknownFiles.length > 0) {
    const summary = Object.entries(skippedByExtension)
      .map(([ext, count]) => `${ext}=${count}`)
      .join(', ')
    console.log(`[import] skipped ${unknownFiles.length} unsupported file(s): ${summary}`)
  }

  return failed
}

function rowToParams(row: PromptRow) {
  return [
    row.source_file,
    row.source_id,
    row.title ?? null,
    row.content,
    row.negative_prompt ?? null,
    row.category ?? null,
    row.style ?? null,
    row.original_style ?? null,
    row.scene ?? null,
    row.image_type ?? null,
    row.product_category ?? null,
    row.platform_source ?? null,
    row.source_url ?? null,
    row.remark ?? null,
    row.tags ?? null
  ]
}
