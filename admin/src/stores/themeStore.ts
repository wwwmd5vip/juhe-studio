import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    return (localStorage.getItem('juhe_theme') as Theme) || 'light'
  } catch {
    return 'light'
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('juhe_theme', next)
      return { theme: next }
    }),
  setTheme: (theme) => {
    localStorage.setItem('juhe_theme', theme)
    set({ theme })
  },
}))
