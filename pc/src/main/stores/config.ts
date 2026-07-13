import { screen } from 'electron'
import Store from 'electron-store'

interface StoreSchema {
  theme: 'light' | 'dark' | 'system'
  language: string
  windowState: {
    width: number
    height: number
    x?: number
    y?: number
    isMaximized: boolean
  }
  /** Juhe Management upstream server URL */
  juheBaseUrl: string
  /** Whether the user has accepted the EULA */
  eula_accepted: boolean
  /** Whether crash reporting is enabled */
  crash_reporting_enabled: boolean
  /** Whether plugin loading is enabled (disabled by default for security) */
  pluginsEnabled: boolean
  /** Last known app version — used to detect downgrades */
  lastVersion?: string
  providers: Array<{
    id: string
    name: string
    type: string
    baseUrl?: string
    isEnabled: boolean
  }>
}

const store = new Store<StoreSchema>({
  defaults: {
    theme: 'system',
    language: 'zh-CN',
    juheBaseUrl: '',  // must be configured by user on first launch
    eula_accepted: false,
    crash_reporting_enabled: true,
    pluginsEnabled: false,
    windowState: {
      width: 1400,
      height: 900,
      isMaximized: false
    },
    providers: []
  }
} as Store.Options<StoreSchema>)

// Legacy hardcoded server addresses cleared on first launch (after migration)
const _prevUrl = store.get('juheBaseUrl')
if (_prevUrl === 'http://studio.juhe.hk:7075' || _prevUrl === 'http://101.96.196.48:7075') {
  store.set('juheBaseUrl', '')
}

export default store

/**
 * Validate the store schema at startup. Logs warnings for invalid values rather than crashing.
 */
export function validateStore(): void {
  const theme = store.get('theme')
  if (!['light', 'dark', 'system'].includes(theme as string)) {
    console.warn(`[Config] Invalid theme "${theme}", resetting to "system"`)
    store.set('theme', 'system')
  }

  try {
    const ws = store.get('windowState')
    if (typeof ws?.width !== 'number' || ws.width < 400 || typeof ws?.height !== 'number' || ws.height < 300) {
      console.warn('[Config] Invalid windowState, resetting to defaults')
      store.set('windowState', { width: 1400, height: 900, isMaximized: false })
    } else if (ws.x !== undefined && ws.y !== undefined) {
      // Validate that saved window position is within any display bounds
      const displays = screen.getAllDisplays()
      const bounds = displays.reduce(
        (acc, d) => {
          acc.minX = Math.min(acc.minX, d.bounds.x)
          acc.minY = Math.min(acc.minY, d.bounds.y)
          acc.maxX = Math.max(acc.maxX, d.bounds.x + d.bounds.width)
          acc.maxY = Math.max(acc.maxY, d.bounds.y + d.bounds.height)
          return acc
        },
        { minX: 0, minY: 0, maxX: 0, maxY: 0 }
      )

      if (
        ws.x < bounds.minX - ws.width ||
        ws.x > bounds.maxX ||
        ws.y < bounds.minY - ws.height ||
        ws.y > bounds.maxY
      ) {
        console.warn(
          `[Config] Window position (${ws.x}, ${ws.y}) is outside display bounds, resetting position`
        )
        store.set('windowState', { ...ws, x: undefined, y: undefined })
      }
    }
  } catch {
    console.warn('[Config] Failed to read windowState, resetting to defaults')
    store.set('windowState', { width: 1400, height: 900, isMaximized: false })
  }

  try {
    const providers = store.get('providers')
    if (!Array.isArray(providers)) {
      console.warn('[Config] Invalid providers, resetting to empty')
      store.set('providers', [])
    }
  } catch {
    console.warn('[Config] Failed to read providers, resetting to empty')
    store.set('providers', [])
  }
}

/**
 * Get the Juhe Management API base URL from environment or persistent store.
 */
export function getJuheBaseUrl(): string {
  if (process.env.JUHE_API_URL) return process.env.JUHE_API_URL.replace(/\/$/, '')
  try {
    const url = store.get('juheBaseUrl')
    if (typeof url === 'string' && url.length > 0) return url.replace(/\/$/, '')
  } catch {
    /* store not available yet */
  }
  return ''
}
