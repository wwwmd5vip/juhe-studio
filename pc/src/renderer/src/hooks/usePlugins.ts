import { useCallback, useMemo } from 'react'
import { usePluginStore } from '@/stores/plugins'

export function usePlugins() {
  const plugins = usePluginStore((state) => state.plugins)
  const togglePlugin = usePluginStore((state) => state.togglePlugin)
  const getEnabledPlugins = usePluginStore((state) => state.getEnabledPlugins)

  const enabledPlugins = useMemo(() => {
    return getEnabledPlugins()
  }, [getEnabledPlugins])

  const isPluginEnabled = useCallback(
    (id: string) => {
      const plugin = plugins.find((p) => p.id === id)
      return plugin?.isActive ?? false
    },
    [plugins]
  )

  const executePluginAction = useCallback(
    async (id: string, action: string, payload?: unknown) => {
      const plugin = plugins.find((p) => p.id === id)
      if (!plugin) {
        throw new Error(`Plugin ${id} not found`)
      }
      if (!plugin.isActive) {
        throw new Error(`Plugin ${plugin.name} is disabled`)
      }
      // In a real implementation, this would dynamically import the plugin entry
      // and call the specified action. For now, we log the intent.
      console.log(`[Plugin] Executing ${action} on ${plugin.name}`, payload)
      return { success: true, pluginId: id, action, payload }
    },
    [plugins]
  )

  return {
    enabledPlugins,
    isPluginEnabled,
    executePluginAction,
    togglePlugin
  }
}
