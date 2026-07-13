/**
 * Auth IPC Handlers — Juhe Management (JWT-based)
 * Directly uses @juhe-management/client SDK.
 */

import type { LoginResult, Token, User } from '@juhe-management/client'
import { JuheClient } from '@juhe-management/client'
import { ipcMain } from 'electron'
import { createLogger } from '../utils/logger'
import { decryptApiKey, encryptApiKey } from '../services/secure-storage'
import { syncJuheModels } from '../services/model-sync'
import store, { getJuheBaseUrl } from '../stores/config'

const log = createLogger('Auth')

// ===== Token Storage =====

const TOKEN_KEY = 'auth.jwtToken'
const USER_KEY = 'auth.user'

function getToken(): string | null {
  try {
    const t = store.get(TOKEN_KEY)
    return typeof t === 'string' && t.length > 0 ? t : null
  } catch {
    return null
  }
}

function setToken(token: string | null): void {
  if (token) store.set(TOKEN_KEY, token)
  else (store.delete as (k: string) => void)(TOKEN_KEY)
}

function getUser(): User | null {
  try {
    const u = store.get(USER_KEY)
    return u && typeof u === 'object' ? (u as User) : null
  } catch {
    return null
  }
}

function setUser(user: User | null): void {
  if (user) store.set(USER_KEY, user as unknown as Record<string, unknown>)
  else (store.delete as (k: string) => void)(USER_KEY)
}

// ===== Credentials =====

const CREDS_KEY = 'auth.credentials'

function getCredentials(): { username: string; password: string } | null {
  try {
    const c = store.get(CREDS_KEY)
    if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).username === 'string'
      && typeof (c as Record<string, unknown>).password === 'string') {
      return {
        username: (c as Record<string, string>).username,
        password: decryptApiKey((c as Record<string, string>).password)
      }
    }
  } catch {
    /* */
  }
  return null
}

function setCredentials(u: string, p: string): void {
  // Encrypt password before storing (uses OS-level keychain when available)
  store.set(CREDS_KEY, { username: u, password: encryptApiKey(p) })
}

function clearCredentials(): void {
  ;(store.delete as (k: string) => void)(CREDS_KEY)
}

// ===== Helpers =====

function makeClient(): JuheClient {
  return new JuheClient({ baseURL: getJuheBaseUrl(), adminToken: getToken() ?? undefined, timeout: 30000 })
}

function ok<T>(data?: T) {
  return { success: true, data }
}
function fail(error: string) {
  return { success: false, error }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

// ===== Register =====

export function registerAuthIpc() {
  console.log('[AuthIPC] Registering auth IPC handlers...')

  ipcMain.handle('auth:getBaseUrl', () => getJuheBaseUrl())

  ipcMain.handle('auth:isAuthenticated', () => {
    const token = getToken()
    const authenticated = token !== null && !isTokenExpired(token)
    console.log('[AuthIPC] isAuthenticated called, token present:', token !== null, 'expired:', !authenticated)
    if (!authenticated) {
      setToken(null)
      setUser(null)
    }
    return authenticated
  })

  ipcMain.handle('auth:getUser', () => {
    const u = getUser()
    return u ? ok(u) : fail('Not authenticated')
  })

  ipcMain.handle('auth:login', async (_e, username: string, password: string, remember: boolean, captchaId?: string, captchaCode?: string) => {
    log.log('Login attempt', { username, remember, hasCaptcha: !!captchaId })
    const start = Date.now()
    try {
      const result: LoginResult = await makeClient().login({ username, password, captcha_id: captchaId, captcha_code: captchaCode })
      setToken(result.token)
      setUser(result.user)
      if (remember) setCredentials(username, password)
      else clearCredentials()
      log.log('Login success', { username, role: result.user.role, ms: Date.now() - start })

      // Note: model sync is handled by the renderer's authStore.syncAndReload()
      // after login returns — avoids duplicate sync and token-creation race conditions.

      return ok({ user: result.user, token: result.token })
    } catch (err) {
      log.error('Login failed', { username, ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) })
      return fail('登录失败，请检查邮箱和密码')
    }
  })

  // Fetch captcha from backend
  ipcMain.handle('auth:getCaptcha', async () => {
    const start = Date.now()
    try {
      const baseURL = getJuheBaseUrl().replace(/\/$/, '')
      const url = `${baseURL}/api/auth/captcha`
      log.log('Fetching captcha', { url })
      // Use JuheClient (axios) for consistent behavior with login
      const client = new JuheClient({ baseURL: getJuheBaseUrl(), timeout: 15000 })
      const data = await client.getCaptcha()
      log.log('Captcha fetched', { captchaId: data.captcha_id, ms: Date.now() - start })
      return ok(data)
    } catch (err) {
      log.error('Captcha fetch error', { error: err instanceof Error ? err.message : String(err), ms: Date.now() - start })
      return fail(err instanceof Error ? err.message : 'Failed to get captcha')
    }
  })

  ipcMain.handle('auth:logout', async () => {
    setToken(null)
    setUser(null)
    ;(store.delete as (k: string) => void)('auth.apiKey')
    return ok()
  })

  ipcMain.handle('auth:getCredentials', () => ok(getCredentials()))
  ipcMain.handle('auth:clearCredentials', () => {
    clearCredentials()
    return ok()
  })

  ipcMain.handle('auth:setBaseUrl', (_e, url: string) => {
    // Security: validate URL scheme to prevent credential exfiltration
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return fail('Base URL must use http or https protocol')
      }
      store.set('juheBaseUrl', url.replace(/\/$/, ''))
      return ok()
    } catch {
      return fail('Invalid URL format')
    }
  })

  // Profile
  ipcMain.handle('auth:getProfile', async () => {
    try {
      const user = await makeClient().me()
      setUser(user)
      return ok(user)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  // API Keys (Tokens)
  ipcMain.handle('auth:listTokens', async () => {
    try {
      const { data } = await makeClient().listTokens(1, 100)
      return ok(data)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle('auth:createToken', async (_e, name: string) => {
    try {
      const token = await makeClient().createToken({ name, unlimited_quota: true })
      return ok(token)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle('auth:deleteToken', async (_e, id: number) => {
    try {
      await makeClient().deleteToken(id)
      return ok()
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle('auth:getAPIKey', async () => {
    try {
      const { data: tokens } = await makeClient().listTokens(1, 100)
      const active = tokens.filter((t: Token) => t.status === 1 && t.key && !t.key.includes('*'))
      if (active.length > 0) return ok(active[0].key)
      // Create one if none exist
      const created = await makeClient().createToken({ name: 'Auto Key', unlimited_quota: true })
      return ok(created.key ?? null)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  ipcMain.handle('auth:listModels', async () => {
    try {
      const result = await makeClient().listModels()
      return ok(result.data)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed')
    }
  })

  // Sync Juhe Management models to local DB
  ipcMain.handle('auth:syncModels', async () => {
    try {
      const result = await syncJuheModels()
      return ok(result)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'Failed to sync models')
    }
  })
}
