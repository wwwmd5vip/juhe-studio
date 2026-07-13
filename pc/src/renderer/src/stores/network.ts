/**
 * 网络状态管理 (Zustand)
 */

import { create } from 'zustand'

interface NetworkState {
  isOnline: boolean
  lastChecked: number
  checkInterval: number
  setOnline: (online: boolean) => void
  checkConnection: () => Promise<boolean>
}

const CHECK_ENDPOINTS = [
  'https://www.baidu.com/favicon.ico',
  'https://www.bing.com/favicon.ico',
  'https://www.google.com/generate_204'
]
const DEFAULT_INTERVAL = 30000 // 30s

async function fetchOnline(): Promise<boolean> {
  if (!navigator.onLine) return false

  for (const endpoint of CHECK_ENDPOINTS) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(endpoint, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (res.type === 'opaque' || res.status === 204 || res.status === 0 || res.status === 200) {
        return true
      }
    } catch {
      // try next endpoint
    }
  }
  return false
}

export const useNetworkStore = create<NetworkState>((set, _get) => ({
  isOnline: navigator.onLine,
  lastChecked: Date.now(),
  checkInterval: DEFAULT_INTERVAL,

  setOnline: (online) => {
    set({ isOnline: online, lastChecked: Date.now() })
  },

  checkConnection: async () => {
    const online = await fetchOnline()
    set({ isOnline: online, lastChecked: Date.now() })
    return online
  }
}))

// 浏览器事件监听 + 定时轮询
let intervalId: ReturnType<typeof setInterval> | null = null
let listenerRefCount = 0
let listenersRegistered = false

function handleOnline() {
  useNetworkStore.getState().setOnline(true)
}

function handleOffline() {
  useNetworkStore.getState().setOnline(false)
}

export function initNetworkListener() {
  const store = useNetworkStore.getState()

  listenerRefCount += 1

  if (!listenersRegistered) {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    // Use recursive setTimeout so interval changes take effect immediately
    const scheduleCheck = () => {
      intervalId = setTimeout(() => {
        void useNetworkStore.getState().checkConnection()
        scheduleCheck()
      }, useNetworkStore.getState().checkInterval)
    }
    scheduleCheck()
    listenersRegistered = true
    void store.checkConnection()
  }

  return () => {
    listenerRefCount = Math.max(0, listenerRefCount - 1)
    if (listenerRefCount > 0 || !listenersRegistered) return

    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (intervalId) {
      clearTimeout(intervalId)
      intervalId = null
    }
    listenersRegistered = false
  }
}
