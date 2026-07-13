import { create } from 'zustand'
import { message } from 'antd'
import type { UserMe } from '../api/auth'

interface JWTPayload {
  exp?: number
  iat?: number
  sub?: string
  role?: number
  [key: string]: unknown
}

let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null

function decodeJWT(token: string): JWTPayload | null {
  try {
    const payload: JWTPayload = JSON.parse(atob(token.split('.')[1]))
    return payload
  } catch {
    return null
  }
}

function scheduleTokenExpiryWarning(token: string) {
  // Clear any existing timer
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer)
    tokenRefreshTimer = null
  }

  const payload = decodeJWT(token)
  if (!payload?.exp) return

  const expiresIn = payload.exp * 1000 - Date.now()
  const refreshTime = expiresIn - 5 * 60 * 1000 // 5 minutes before expiry
  if (refreshTime > 0) {
    tokenRefreshTimer = setTimeout(() => {
      message.warning('登录即将过期，请保存工作后重新登录')
    }, refreshTime)
  }
}

interface AuthState {
  token: string | null
  user: UserMe | null
  setToken: (token: string) => void
  setUser: (user: UserMe) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: (() => {
    try {
      const t = localStorage.getItem('juhe_token')
      if (t) scheduleTokenExpiryWarning(t)
      return t
    } catch { return null }
  })(),
  user: (() => {
    try {
      const raw = localStorage.getItem('juhe_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })(),
  setToken: (token) => {
    localStorage.setItem('juhe_token', token)
    scheduleTokenExpiryWarning(token)
    set({ token })
  },
  setUser: (user) => {
    if (user) localStorage.setItem('juhe_user', JSON.stringify(user))
    else localStorage.removeItem('juhe_user')
    set({ user })
  },
  logout: () => {
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer)
      tokenRefreshTimer = null
    }
    localStorage.removeItem('juhe_token')
    localStorage.removeItem('juhe_user')
    set({ token: null, user: null })
  },
}))
