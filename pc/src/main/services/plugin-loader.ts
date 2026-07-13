/**
 * 简易插件加载器 — 扫描 userData/plugins/ 下的 .js 文件
 * 每个插件文件导出 { id, name, version, description, icon?, activate, deactivate }
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import store from '../stores/config'
import { errorMessage } from '@shared/utils/error-classifier'

const PLUGINS_DIR = join(app.getPath('userData'), 'plugins')

if (!existsSync(PLUGINS_DIR)) {
  mkdirSync(PLUGINS_DIR, { recursive: true })
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  icon?: string
}

export interface PluginEntry {
  manifest: PluginManifest
  status: 'active' | 'inactive'
  file: string
}

interface PluginModule {
  id: string
  name: string
  version: string
  description: string
  icon?: string
  activate?: () => void
  deactivate?: () => void
}

class PluginLoader {
  private plugins = new Map<string, { module: PluginModule; status: 'active' | 'inactive'; file: string }>()

  constructor() {
    this.scanPlugins()
  }

  /** 扫描 plugins/ 下所有 .plugin.js 文件并验证 */
  scanPlugins(): void {
    this.plugins.clear()

    // Security gate: plugins must be explicitly enabled by the user
    if (!store.get('pluginsEnabled')) {
      console.warn(
        '[PluginLoader] Plugins are disabled by default for security. ' +
        'To enable, set "pluginsEnabled" to true in config. ' +
        'WARNING: Plugins run with full main process privileges and can execute arbitrary code.'
      )
      return
    }

    if (!existsSync(PLUGINS_DIR)) return

    let files: string[]
    try {
      files = readdirSync(PLUGINS_DIR).filter((f) => f.endsWith('.plugin.js'))
    } catch {
      return
    }

    for (const file of files) {
      const fullPath = join(PLUGINS_DIR, file)
      try {
        const mod: PluginModule = require(fullPath)
        if (!mod.id || !mod.name || !mod.version || !mod.description) {
          console.warn(`[PluginLoader] Skipping ${file}: missing required fields (id, name, version, description)`)
          continue
        }
        this.plugins.set(mod.id, {
          module: mod,
          status: 'inactive',
          file
        })
        console.log(`[PluginLoader] Loaded plugin: ${mod.name} (${mod.id})`)
      } catch (error) {
        console.warn(`[PluginLoader] Failed to load plugin ${file}:`, error)
      }
    }
  }

  /** 列出所有已扫描的插件 */
  listPlugins(): PluginEntry[] {
    const entries: PluginEntry[] = []
    for (const [, plugin] of this.plugins) {
      entries.push({
        manifest: {
          id: plugin.module.id,
          name: plugin.module.name,
          version: plugin.module.version,
          description: plugin.module.description,
          icon: plugin.module.icon
        },
        status: plugin.status,
        file: plugin.file
      })
    }
    return entries
  }

  /** 激活插件（执行 activate 回调） */
  activatePlugin(id: string): { success: boolean; error?: string } {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      return { success: false, error: `Plugin ${id} not found` }
    }
    if (plugin.status === 'active') {
      return { success: false, error: 'Plugin is already active' }
    }
    try {
      plugin.module.activate?.()
      plugin.status = 'active'
      console.log(`[PluginLoader] Activated: ${plugin.module.name}`)
      return { success: true }
    } catch (error) {
      const message = errorMessage(error)
      console.error(`[PluginLoader] Failed to activate ${id}:`, error)
      return { success: false, error: message }
    }
  }

  /** 停用插件（执行 deactivate 回调） */
  deactivatePlugin(id: string): { success: boolean; error?: string } {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      return { success: false, error: `Plugin ${id} not found` }
    }
    if (plugin.status !== 'active') {
      return { success: false, error: 'Plugin is not active' }
    }
    try {
      plugin.module.deactivate?.()
      plugin.status = 'inactive'
      console.log(`[PluginLoader] Deactivated: ${plugin.module.name}`)
      return { success: true }
    } catch (error) {
      const message = errorMessage(error)
      console.error(`[PluginLoader] Failed to deactivate ${id}:`, error)
      return { success: false, error: message }
    }
  }
}

let loader: PluginLoader | null = null

export function getPluginLoader(): PluginLoader {
  if (!loader) {
    loader = new PluginLoader()
  }
  return loader
}
