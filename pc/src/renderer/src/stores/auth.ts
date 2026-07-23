/**
 * 认证状态管理 (Zustand)
 */

import { create } from 'zustand'

declare const __DEV__: boolean
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false

function storeLog(label: string, ...args: unknown[]) {
  if (isDev) console.log(`[Store:Auth] ${label}`, ...args)
}

export interface AuthUser {
  id: number
  username: string
  role: number
  status: number
  group: string
  quota: number
  used_quota: number
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (username: string, password: string, remember: boolean, captchaId?: string, captchaCode?: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
  clearError: () => void
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false, // Not loading on start — show login immediately
  error: null,

  login: async (username: string, password: string, remember: boolean, captchaId?: string, captchaCode?: string) => {
    storeLog('Login start', { username })
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.auth.login(username, password, remember, captchaId, captchaCode)
      if (result?.data) {
        set({ user: result.data.user, isAuthenticated: true, isLoading: false, error: null })
        storeLog('Login success', { role: result.data.user.role })
        syncAndReload()
        return true
      }
      storeLog('Login failed: empty response')
      set({ isLoading: false, error: 'Login failed' })
      return false
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      storeLog('Login error', { message })
      set({ isLoading: false, error: message })
      return false
    }
  },

  logout: async () => {
    storeLog('Logout')
    try { await window.api.auth.logout() } catch { /* ignore */ }
    set({ user: null, isAuthenticated: false, isLoading: false, error: null })

    // Reset other stores to prevent data leakage across logout/login
    try {
      const { useGenerationStore } = await import('./generation')
      useGenerationStore.getState().reset()
    } catch { /* ignore */ }
    try {
      const { useChatStore } = await import('./chat')
      useChatStore.getState().reset()
    } catch { /* ignore */ }
    try {
      const { useUsageStore } = await import('./usage')
      useUsageStore.getState().reset()
    } catch { /* ignore */ }
  },

  checkAuth: async () => {
    console.log('[AuthStore] checkAuth starting...')
    try {
      const isAuth = await window.api.auth.isAuthenticated()
      console.log('[AuthStore] isAuthenticated result:', isAuth)
      if (isAuth) {
        const userResult = await window.api.auth.getUser()
        console.log('[AuthStore] getUser result:', userResult)
        if (userResult?.data) {
          set({ user: userResult.data, isAuthenticated: true, isLoading: false })
          console.log('[AuthStore] User authenticated, syncing models...')
          syncAndReload()
          return true
        }
      }
      set({ isLoading: false, isAuthenticated: false, user: null })
      return false
    } catch (err) {
      console.error('[AuthStore] checkAuth error:', err)
      set({ isLoading: false, isAuthenticated: false, user: null })
      return false
    }
  },

  clearError: () => set({ error: null }),

  refreshProfile: async () => {
    try {
      const result = await window.api.auth.getProfile()
      if (result?.data) {
        const data = result.data as unknown as AuthUser
        set({ user: data })
      }
    } catch (err) {
      console.error('[AuthStore] refreshProfile error:', err)
    }
  }
}))

// Helper: sync models from Juhe Management and reload provider store
async function syncAndReload() {
  try {
    console.log('[AuthStore] Syncing models from Juhe Management...')
    await window.api.auth.syncModels()
    console.log('[AuthStore] Model sync succeeded')

    // Refresh user profile (quota, etc.)
    useAuthStore.getState().refreshProfile()

    // Reload the provider store to pick up newly synced models
    setTimeout(async () => {
      // Bail out if the user logged out within the 500ms delay to avoid
      // reloading providers with stale credentials in an unauthenticated state.
      if (!useAuthStore.getState().isAuthenticated) return
      try {
        const { useProviderStore } = await import('../stores/providers')
        await useProviderStore.getState().loadProviders({ force: true })
        console.log('[AuthStore] Provider store reloaded after sync')
      } catch (err) {
        console.error('[AuthStore] Failed to reload providers:', err)
      }
    }, 500)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/token|auth|401|expired|unauthorized/i.test(message)) {
      // JWT 过期 — 自动退出登录，让用户重新登录
      console.warn('[AuthStore] JWT expired, logging out...')
      useAuthStore.getState().logout()
    } else {
      console.error('[AuthStore] Model sync failed:', err)
    }
  }
}
