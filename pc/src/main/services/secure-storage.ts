/**
 * Secure Storage Service
 *
 * Uses Electron's safeStorage API (OS-level keychain encryption) to protect API keys.
 * Stores encrypted keys as base64-encoded strings prefixed with 'encv2:'.
 * Falls back to 'plain:' prefix if OS keychain is unavailable.
 *
 * Backward compatible:
 * - 'encv2:' — safeStorage-encrypted (current)
 * - 'enc:' — legacy encrypted (cannot be decrypted, returns empty)
 * - 'plain:' — plaintext fallback (stripped on read)
 * - no prefix — old plaintext (returned as-is, migrated on next encrypt)
 */

import { safeStorage } from 'electron'

/**
 * Check if encryption is available on the current system.
 * Uses OS-level keychain (macOS Keychain, Windows DPAPI, Linux libsecret).
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Encrypt an API key for storage.
 * Returns a string safe to store in the database.
 * If OS encryption is available, uses safeStorage and prefixes with 'encv2:'.
 * Otherwise falls back to 'plain:' prefix.
 */
export function encryptApiKey(key: string): string {
  if (!key) return ''

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key)
    return `encv2:${encrypted.toString('base64')}`
  }

  return `plain:${key}`
}

/**
 * Decrypt a stored API key value.
 * Handles all legacy formats:
 * - 'encv2:' → safeStorage-decrypt
 * - 'enc:' → legacy encrypted (return empty)
 * - 'plain:' → strip prefix
 * - no prefix → old plaintext (return as-is)
 */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return ''

  if (encrypted.startsWith('encv2:')) {
    try {
      const buffer = Buffer.from(encrypted.slice(6), 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      // Decryption failed — possibly from a different OS user or keychain reset
      console.warn('[SecureStorage] Failed to decrypt encv2 key, returning empty')
      return ''
    }
  }

  if (encrypted.startsWith('enc:')) {
    // Legacy encrypted value cannot be decrypted without the original keychain.
    // Return empty so the caller knows the key needs to be re-entered.
    return ''
  }

  if (encrypted.startsWith('plain:')) {
    return encrypted.slice(6)
  }

  // Old plaintext key — return as-is
  return encrypted
}

/**
 * Check if a stored API key value has an encryption or fallback prefix.
 */
export function isEncryptedValue(value: string): boolean {
  return value.startsWith('encv2:') || value.startsWith('enc:') || value.startsWith('plain:')
}
