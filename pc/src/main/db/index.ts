import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { app } from 'electron'
import { join } from 'node:path'

function getDbPath(): string {
  return join(app.getPath('userData'), 'app.db')
}

const dbPath = getDbPath()

let client: ReturnType<typeof createClient>
let db: ReturnType<typeof drizzle>

function initClient() {
  client = createClient({ url: `file:${dbPath}` })
  db = drizzle(client)
  // Apply performance and concurrency PRAGMAs.
  // Fire-and-forget at module init (ok because DB operations are queued via IPC).
  // Re-applied synchronously in reinitializeDatabase to cover DB reset scenarios.
  client.execute('PRAGMA journal_mode=WAL').catch(err => console.warn('[DB] Failed to set WAL mode:', err))
  client.execute('PRAGMA busy_timeout=5000').catch(err => console.warn('[DB] Failed to set busy_timeout:', err))
  client.execute('PRAGMA wal_autocheckpoint=1000').catch(err => console.warn('[DB] Failed to set wal_autocheckpoint:', err))

  // Periodic WAL checkpoint to prevent WAL file from growing unboundedly
  setInterval(() => {
    try {
      client.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      // ignore — checkpoint failures are non-critical
    }
  }, 30 * 60 * 1000) // every 30 minutes
}

try {
  initClient()
} catch (error) {
  console.error('[DB] Failed to initialize database:', error)
  // Create in-memory fallback
  client = createClient({ url: ':memory:' })
  db = drizzle(client)
}

export { db }

/** Re-initialize the database connection (used after clearing the database file) */
export async function reinitializeDatabase() {
  await client.close()
  initClient()
}
