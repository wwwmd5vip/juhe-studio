import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type Database from 'better-sqlite3'
import { db } from './connection.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, 'migrations')

export function migrate(database: Database.Database = db) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      filename TEXT PRIMARY KEY
    )
  `)

  const appliedRows = database
    .prepare('SELECT filename FROM __migrations')
    .pluck()
    .all() as string[]
  const applied = new Set(appliedRows)

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  // Ensure linear migration sequence: no unapplied file may sort before an already-applied one.
  const appliedIndices = appliedRows
    .map((filename) => files.indexOf(filename))
    .filter((index) => index !== -1)
  const maxAppliedIndex = appliedIndices.length > 0 ? Math.max(...appliedIndices) : -1

  for (const file of files) {
    if (applied.has(file)) continue

    const index = files.indexOf(file)
    if (index < maxAppliedIndex) {
      throw new Error(`Migration order violation: ${file} sorts before already-applied migration(s)`)
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    const applyMigration = database.transaction((migrationFile: string, migrationSql: string) => {
      database.exec(migrationSql)
      database.prepare('INSERT INTO __migrations (filename) VALUES (?)').run(migrationFile)
    })
    applyMigration(file, sql)
    console.log(`[migrate] applied ${file}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate()
}
