import fs from 'node:fs'
import path from 'node:path'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { app } from 'electron'
import { db } from './index'
import { setMigrationStatus } from './migration-guard'
import { migrateProviderKeysToPlaintext } from './migrate-provider-keys'

async function findMigrationsFolder(): Promise<string | null> {
  const possiblePaths = [
    join(__dirname, 'db/migrations'),
    join(__dirname, '../db/migrations'),
    join(__dirname, '../../src/main/db/migrations'),
    join(process.cwd(), 'src/main/db/migrations'),
    join(process.resourcesPath || '', 'app.asar.unpacked', 'src/main/db/migrations'),
    join(app.getAppPath(), 'src/main/db/migrations')
  ]

  for (const p of possiblePaths) {
    const journalPath = join(p, 'meta', '_journal.json')
    if (fs.existsSync(journalPath)) {
      return p
    }
  }

  return null
}

export async function runMigrations() {
  const migrationsFolder = await findMigrationsFolder()

  if (!migrationsFolder) {
    console.error('[DB] No valid migration folder found with meta/_journal.json')
    return
  }

  // Back up the database before migration
  const dbPath = path.join(app.getPath('userData'), 'app.db')
  if (fs.existsSync(dbPath)) {
    const backupPath = `${dbPath}.pre-migration-${Date.now()}.bak`
    try {
      fs.copyFileSync(dbPath, backupPath)
      console.log('[DB] Database backed up to', backupPath)
    } catch (err) {
      console.warn('[DB] Failed to create database backup:', err)
    }
  }

  try {
    await migrate(db, { migrationsFolder })
    console.log('[DB] Migrations completed successfully from:', migrationsFolder)
    setMigrationStatus(true)

    // 安全添加缺失的列（处理 journal 已记录但 DDL 未实际执行的情况）
    await safeAddMissingColumns()

    await migrateProviderKeysToPlaintext()
  } catch (error: unknown) {
    const msg = (error as Error)?.message || String(error)
    console.error('[DB] Migration failed:', msg)
    setMigrationStatus(false, msg)
    console.warn('[DB] Continuing in read-only compatibility mode — Creator OS features disabled')
    // Don't rethrow — allow app to start in degraded mode
  }
}

/**
 * 安全添加迁移中定义的缺失列。
 * 用 PRAGMA table_info 检查列是否存在，仅在缺失时 ALTER TABLE ADD COLUMN。
 */
async function safeAddMissingColumns(): Promise<void> {
  // 列定义：[table, column, type_suffix]
  const columns: Array<[string, string, string]> = [
    ['generations', 'project_id', 'text REFERENCES projects(id) ON DELETE SET NULL'],
    ['ecommerce_workflows', 'project_id', 'text REFERENCES projects(id) ON DELETE SET NULL'],
    ['showcase_tasks', 'project_id', 'text REFERENCES projects(id) ON DELETE SET NULL'],
    ['projects', 'brand_kit_id', 'text'],
    ['chat_sessions', 'workspace_id', 'text'],
    ['workflows', 'workspace_id', 'text'],
    ['prompt_templates', 'workspace_id', 'text'],
    ['skills', 'workspace_id', 'text'],
    ['memories', 'workspace_id', 'text']
  ]

  let added = 0
  let skipped = 0

  for (const [table, column, type] of columns) {
    try {
      // 检查列是否存在
      const result = await db.all(
        `PRAGMA table_info(\`${table}\`)`
      ) as unknown as Array<{ name: string }>
      const exists = result.some((row) => row.name === column)

      if (exists) {
        skipped++
        continue
      }

      // 列不存在，添加它
      await db.run(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`)
      console.log(`[DB] Safe-add: ${table}.${column}`)
      added++
    } catch (err) {
      // 表不存在或列已存在——静默跳过
      console.warn(`[DB] Safe-add skipped for ${table}.${column}:`, (err as Error)?.message)
      skipped++
    }
  }

  if (added > 0) {
    console.log(`[DB] Safe-added ${added} missing columns (${skipped} already present)`)
  }
}
