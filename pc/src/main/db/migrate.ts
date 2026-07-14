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
    await migrateProviderKeysToPlaintext()
  } catch (error: unknown) {
    const msg = (error as Error)?.message || String(error)
    console.error('[DB] Migration failed:', msg)
    setMigrationStatus(false, msg)
    console.warn('[DB] Continuing in read-only compatibility mode — Creator OS features disabled')
    // Don't rethrow — allow app to start in degraded mode
  }
}
