import fs from 'node:fs'
import path from 'node:path'
import { parseMarkdown } from './parse-md.js'
import { parseXlsx } from './parse-xlsx.js'
import { db } from '../db/connection.js'

export function importPrompts(sourceDir: string) {
  const files = fs.readdirSync(sourceDir)
  let total = 0
  let inserted = 0
  let updated = 0

  const insert = db.prepare(`
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

  for (const file of files) {
    const filePath = path.join(sourceDir, file)
    if (file.endsWith('.md')) {
      const rows = parseMarkdown(file, fs.readFileSync(filePath, 'utf-8'))
      for (const row of rows) {
        const info = insert.run(...rowToParams(row))
        info.changes === 1 ? inserted++ : updated++
        total++
      }
    } else if (file.endsWith('.xlsx')) {
      const rows = parseXlsx(file, fs.readFileSync(filePath))
      for (const row of rows) {
        const info = insert.run(...rowToParams(row))
        info.changes === 1 ? inserted++ : updated++
        total++
      }
    }
  }

  console.log(`[import] total=${total} inserted=${inserted} updated=${updated}`)
}

function rowToParams(row: ReturnType<typeof parseMarkdown>[number]) {
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
