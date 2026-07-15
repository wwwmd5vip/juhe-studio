/**
 * Secure Storage Service
 *
 * Uses Electron's safeStorage API (OS-level keychain encryption) to protect API keys.
 * When OS keychain is unavailable, falls back to AES-256-GCM with a persistent local key.
 *
 * Prefix format:
 * - 'encv2:' — safeStorage-encrypted (preferred, macOS Keychain / Windows DPAPI)
 * - 'encv3:' — AES-256-GCM encrypted (fallback when safeStorage unavailable)
 * - 'enc:' — legacy encrypted (cannot be decrypted, returns empty)
 * - 'plain:' — legacy plaintext fallback (stripped on read, migrated on next encrypt)
 * - no prefix — old plaintext (returned as-is, migrated on next encrypt)
 */

import { safeStorage, app } from 'electron'
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// ── AES-256-GCM 参数 ──

const AES_ALGORITHM = 'aes-256-gcm'
const AES_KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

// ── 持久化 AES Key ──

let _aesKey: Buffer | null = null

/**
 * 获取或生成持久化 AES-256 密钥。
 * 密钥存储在 app 用户数据目录中。
 */
function getOrCreateAesKey(): Buffer {
  if (_aesKey) return _aesKey

  try {
    const keyDir = join(app.getPath('userData'), '.keys')
    const keyPath = join(keyDir, 'aes-secret')

    if (existsSync(keyPath)) {
      _aesKey = Buffer.from(readFileSync(keyPath, 'hex'), 'hex')
      return _aesKey
    }

    // 首次使用，生成新密钥
    mkdirSync(keyDir, { recursive: true })
    const newKey = randomBytes(AES_KEY_LENGTH)
    writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 })
    _aesKey = newKey
    return _aesKey
  } catch (err) {
    console.error('[SecureStorage] Failed to get/create AES key, using derived key:', err)
    // 终极降级：从机器指纹派生密钥（不如随机密钥安全，但比 plain: 好）
    const fingerprint = [
      app.getPath('home'),
      app.getPath('userData'),
      app.getName()
    ].join(':')
    _aesKey = createHash('sha256').update(fingerprint).digest()
    return _aesKey
  }
}

/**
 * Check if encryption is available on the current system.
 * Uses OS-level keychain (macOS Keychain, Windows DPAPI, Linux libsecret).
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Encrypt an API key for storage.
 * Priority: safeStorage (encv2:) > AES-256-GCM (encv3:).
 */
export function encryptApiKey(key: string): string {
  if (!key) return ''

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(key)
    return `encv2:${encrypted.toString('base64')}`
  }

  // AES-256-GCM 降级
  try {
    const aesKey = getOrCreateAesKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(AES_ALGORITHM, aesKey, iv, { authTagLength: AUTH_TAG_LENGTH })

    const encrypted = Buffer.concat([
      cipher.update(key, 'utf8'),
      cipher.final()
    ])
    const authTag = cipher.getAuthTag()

    // 格式: encv3:<iv(base64)>:<authTag(base64)>:<ciphertext(base64)>
    return `encv3:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
  } catch (err) {
    console.error('[SecureStorage] AES encryption failed, using plain:', err)
    return `plain:${key}`
  }
}

/**
 * Decrypt a stored API key value.
 *
 * Prefix handling:
 * - 'encv2:' → safeStorage-decrypt (OS keychain)
 * - 'encv3:' → AES-256-GCM decrypt
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
      console.warn('[SecureStorage] Failed to decrypt encv2 key, returning empty')
      return ''
    }
  }

  if (encrypted.startsWith('encv3:')) {
    try {
      const payload = encrypted.slice(6) // iv:authTag:ciphertext
      const parts = payload.split(':')
      if (parts.length !== 3) {
        console.warn('[SecureStorage] Malformed encv3 payload')
        return ''
      }

      const iv = Buffer.from(parts[0], 'base64')
      const authTag = Buffer.from(parts[1], 'base64')
      const ciphertext = Buffer.from(parts[2], 'base64')

      const aesKey = getOrCreateAesKey()
      const decipher = createDecipheriv(AES_ALGORITHM, aesKey, iv, { authTagLength: AUTH_TAG_LENGTH })
      decipher.setAuthTag(authTag)

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ])

      return decrypted.toString('utf8')
    } catch {
      console.warn('[SecureStorage] Failed to decrypt encv3 key, returning empty')
      return ''
    }
  }

  if (encrypted.startsWith('enc:')) {
    // Legacy encrypted value cannot be decrypted without the original keychain.
    return ''
  }

  if (encrypted.startsWith('plain:')) {
    return encrypted.slice(6)
  }

  // Old plaintext key — return as-is
  return encrypted
}

/**
 * Check if a stored API key value has an encryption prefix.
 */
export function isEncryptedValue(value: string): boolean {
  return (
    value.startsWith('encv2:') ||
    value.startsWith('encv3:') ||
    value.startsWith('enc:') ||
    value.startsWith('plain:')
  )
}
