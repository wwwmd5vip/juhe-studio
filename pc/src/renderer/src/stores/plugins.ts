import { create } from 'zustand'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  icon?: string
}

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  icon?: string
  isActive: boolean
}

interface PluginState {
  plugins: Plugin[]
  loading: boolean
  error: string | null
  loadPlugins: () => Promise<void>
  togglePlugin: (id: string) => Promise<void>
  getEnabledPlugins: () => Plugin[]
  getPluginsByType: () => Plugin[]
}

export const usePluginStore = create<PluginState>()((set, get) => ({
  plugins: [],
  loading: false,
  error: null,

  loadPlugins: async () => {
    set({ loading: true, error: null })
    try {
      const entries = (await window.api.plugins.list()) as Array<{
        manifest: PluginManifest
        status: string
        file: string
      }>
      const plugins: Plugin[] = entries.map((entry) => ({
        id: entry.manifest.id,
        name: entry.manifest.name,
        version: entry.manifest.version,
        description: entry.manifest.description,
        icon: entry.manifest.icon,
        isActive: entry.status === 'active'
      }))
      set({ plugins, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message, loading: false })
    }
  },

  togglePlugin: async (id: string) => {
    const plugin = get().plugins.find((p) => p.id === id)
    if (!plugin) return

    // Optimistic toggle
    const prevActive = plugin.isActive
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === id ? { ...p, isActive: !prevActive } : p
      )
    }))

    try {
      if (prevActive) {
        await window.api.plugins.deactivate(id)
      } else {
        await window.api.plugins.activate(id)
      }
      // Reload from main process to get accurate status
      await get().loadPlugins()
    } catch (err) {
      // Rollback optimistic toggle
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.id === id ? { ...p, isActive: prevActive } : p
        ),
        error: err instanceof Error ? err.message : String(err)
      }))
    }
  },

  getEnabledPlugins: () => {
    return get().plugins.filter((p) => p.isActive)
  },

  getPluginsByType: () => {
    return get().plugins.filter((p) => p.isActive)
  }
}))
