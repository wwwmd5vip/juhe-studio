import { create } from 'zustand'

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  activePanel: string | null
  setActivePanel: (panel: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel })
}))
