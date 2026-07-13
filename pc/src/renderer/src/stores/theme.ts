import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolved: resolveTheme('system'),
      setMode: (mode) => {
        const resolved = resolveTheme(mode)
        applyTheme(resolved)
        set({ mode, resolved })
      },
      toggle: () => {
        const next = get().resolved === 'light' ? 'dark' : 'light'
        applyTheme(next)
        set({ mode: next, resolved: next })
      }
    }),
    {
      name: 'cherry-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.mode)
          applyTheme(resolved)
          state.resolved = resolved
        }
      }
    }
  )
)

// Listen to system theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const handleThemeChange = (e: MediaQueryListEvent) => {
  const state = useThemeStore.getState()
  if (state.mode === 'system') {
    const resolved = e.matches ? 'dark' : 'light'
    applyTheme(resolved)
    useThemeStore.setState({ resolved })
  }
}
mediaQuery.addEventListener('change', handleThemeChange)

// Cleanup on hot reload
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mediaQuery.removeEventListener('change', handleThemeChange)
  })
}
