/**
 * Migration: strip legacy 'enc:' and 'plain:' prefixes from provider API keys,
 * then encrypt plaintext values using safeStorage.
 *
 * 'enc:' values are cleared (cannot be reliably decrypted from old format).
 * 'encv2:' values are left untouched (already properly encrypted).
 * 'plain:' values are stripped to raw content then re-encrypted.
 * Existing plaintext values (no prefix) are encrypted.
 */

import { sql } from 'drizzle-orm'
import { db } from '../db'
import { providers } from '../db/schema'
import { encryptApiKey } from '../services/secure-storage'

export async function migrateProviderKeysToPlaintext(): Promise<void> {
  const result = await db.select().from(providers)
  let updated = 0

  for (const p of result) {
    const updates: Partial<typeof providers.$inferSelect> = {}

    for (const field of ['apiKey', 'accessKeyId', 'secretAccessKey'] as const) {
      const val = p[field]
      if (typeof val !== 'string' || val.length === 0) continue

      // Already properly encrypted — skip
      if (val.startsWith('encv2:')) continue

      // Legacy encrypted — clear it (cannot be decrypted)
      if (val.startsWith('enc:')) {
        ;(updates as Record<string, string>)[field] = ''
        continue
      }

      // Strip plain: prefix if present, then encrypt
      const plaintext = val.startsWith('plain:') ? val.slice(6) : val

      // Encrypt using safeStorage (or fallback to plain:)
      const encrypted = encryptApiKey(plaintext)
      if (encrypted !== val) {
        ;(updates as Record<string, string>)[field] = encrypted
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(providers)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(sql`${providers.id} = ${p.id}`)
      updated++
    }
  }

  if (updated > 0) {
    console.log(`[MigrateProviderKeys] Migrated ${updated} provider(s) to encrypted storage`)
  }
}
