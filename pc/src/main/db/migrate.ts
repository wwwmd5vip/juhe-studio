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
  // 先补建可能缺失的表（处理 journal 已记录但 DDL 未执行的情况）
  const missingTables = [
    // ── 0014: Creator OS tables ──
    `CREATE TABLE IF NOT EXISTS assets (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind text NOT NULL DEFAULT 'source',
      file_path text NOT NULL,
      mime_type text NOT NULL DEFAULT 'image/png',
      width integer,
      height integer,
      metadata text,
      status text NOT NULL DEFAULT 'active',
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS assets_project_idx ON assets (project_id)`,
    `CREATE INDEX IF NOT EXISTS assets_kind_idx ON assets (kind)`,
    `CREATE TABLE IF NOT EXISTS creator_tasks (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      runtime_task_id text NOT NULL,
      template_slot_id text NOT NULL,
      slot_index integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending',
      runtime_status text NOT NULL DEFAULT 'pending',
      error_message text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS creator_tasks_project_idx ON creator_tasks (project_id)`,
    `CREATE INDEX IF NOT EXISTS creator_tasks_runtime_idx ON creator_tasks (runtime_task_id)`,
    `CREATE TABLE IF NOT EXISTS versions (
      id text PRIMARY KEY NOT NULL,
      task_id text NOT NULL REFERENCES creator_tasks(id) ON DELETE CASCADE,
      generation_id text,
      version_number integer NOT NULL DEFAULT 1,
      file_path text NOT NULL,
      mime_type text NOT NULL DEFAULT 'image/png',
      is_selected integer NOT NULL DEFAULT 1,
      metadata text,
      created_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS versions_task_idx ON versions (task_id)`,
    `CREATE TABLE IF NOT EXISTS deliverables (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id text NOT NULL REFERENCES creator_tasks(id) ON DELETE CASCADE,
      version_id text REFERENCES versions(id) ON DELETE SET NULL,
      version_file_path text,
      task_runtime_status text,
      label text NOT NULL,
      slot_index integer NOT NULL DEFAULT 0,
      is_selected integer NOT NULL DEFAULT 1,
      sort_order integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS deliverables_project_idx ON deliverables (project_id)`,
    `CREATE TABLE IF NOT EXISTS brand_kits (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      primary_color text NOT NULL DEFAULT '#FF5733',
      secondary_color text DEFAULT '#333333',
      logo_path text,
      font_family text DEFAULT 'Inter',
      style_description text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS workspaces (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      description text,
      icon text DEFAULT 'folder',
      color text DEFAULT '#6366f1',
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    // ── 0011: ecommerce workflows ──
    `CREATE TABLE IF NOT EXISTS ecommerce_workflows (
      id text PRIMARY KEY NOT NULL,
      template_id text NOT NULL,
      name text NOT NULL,
      category text NOT NULL DEFAULT 'tv',
      context text NOT NULL,
      steps text NOT NULL,
      modules text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      project_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS ecommerce_workflows_template_idx ON ecommerce_workflows (template_id)`,
    `CREATE INDEX IF NOT EXISTS ecommerce_workflows_status_idx ON ecommerce_workflows (status)`,
    // ── showcase tasks ──
    `CREATE TABLE IF NOT EXISTS showcase_tasks (
      id text PRIMARY KEY NOT NULL,
      type text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      input text NOT NULL,
      result text,
      error_msg text,
      point_cost integer,
      generation_task_ids text,
      project_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS showcase_tasks_status_idx ON showcase_tasks (status)`
  ]

  for (const sql of missingTables) {
    try {
      await db.run(sql)
    } catch (err) {
      console.warn('[DB] Safe-table skipped:', (err as Error)?.message)
    }
  }
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
