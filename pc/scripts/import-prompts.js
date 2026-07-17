#!/usr/bin/env node
/* global console, process, require, __dirname */
/**
 * Import crawled prompts JSONL into SQLite.
 *
 * Usage:
 *   node scripts/import-prompts.js
 *   node scripts/import-prompts.js --reset
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@libsql/client')

const JSONL_PATH = path.join(__dirname, '..', 'resources', 'crawled-prompts', 'prompts.jsonl')
const DB_PATH = path.join(__dirname, '..', 'dev.db')

async function main() {
  const args = process.argv.slice(2)
  const reset = args.includes('--reset')

  if (!fs.existsSync(JSONL_PATH)) {
    console.error(`JSONL not found: ${JSONL_PATH}`)
    process.exit(1)
  }

  const client = createClient({ url: `file:${DB_PATH}` })

  if (reset) {
    console.log('Resetting prompt_templates table...')
    await client.execute('DELETE FROM prompt_templates WHERE id LIKE "crawl-%"')
  }

  const lines = fs.readFileSync(JSONL_PATH, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())

  console.log(`Importing ${lines.length} prompts...`)

  let inserted = 0
  let skipped = 0
  const now = new Date().toISOString()

  for (const line of lines) {
    try {
      const r = JSON.parse(line)
      const id = `crawl-${r.id}`

      // Check if already exists
      const existing = await client.execute({
        sql: 'SELECT 1 FROM prompt_templates WHERE id = ?',
        args: [id]
      })
      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      await client.execute({
        sql: `INSERT INTO prompt_templates
          (id, category, name, content, description, tags, cover_image, aspect_ratio, is_favorite, usage_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          r.category || 'custom',
          r.name || 'Untitled',
          r.prompt || '',
          r.categoryName || '',
          JSON.stringify(r.tags || []),
          r.coverImage || null,
          r.aspectRatio || null,
          0,
          0,
          now,
          now
        ]
      })
      inserted++
    } catch (e) {
      console.error('Import error:', e.message)
    }
  }

  console.log(`Done! Inserted: ${inserted}, Skipped: ${skipped}`)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
