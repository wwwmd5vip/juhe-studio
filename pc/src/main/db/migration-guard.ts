import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

const MIGRATION_FLAG_FILE = 'migration_0014_status.json'

interface MigrationStatus {
  version: number
  applied: boolean
  error?: string | null
  timestamp: string
}

function flagPath(): string {
  return join(app.getPath('userData'), MIGRATION_FLAG_FILE)
}

export function getMigrationStatus(): MigrationStatus | null {
  const fp = flagPath()
  if (!existsSync(fp)) return null
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'))
  } catch {
    return null
  }
}

export function setMigrationStatus(applied: boolean, error?: string): void {
  writeFileSync(
    flagPath(),
    JSON.stringify({
      version: 14,
      applied,
      error: error ?? null,
      timestamp: new Date().toISOString()
    } satisfies MigrationStatus)
  )
}

export function isCreatorOSEnabled(): boolean {
  const status = getMigrationStatus()
  return status?.applied === true
}
