/**
 * 插件引擎 - 主进程
 * M4 Phase 2: 插件系统核心
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GenerationTask, GenerationType, ImageQuality, ImageSize, ImageStyle } from '@shared/types/generation'
import type {
  PluginContext,
  PluginGenerationResult,
  PluginInstance,
  PluginManifest,
  PluginRecord,
  PluginRegistration
} from '@shared/types/plugin'
import { errorMessage } from '@shared/utils/error-classifier'
import { app, ipcMain } from 'electron'
import { getGenerationQueue } from './queue'
import store from '../stores/config'

const PLUGIN_FETCH_TIMEOUT = 30_000 // 30 seconds

const PLUGINS_DIR = join(app.getPath('userData'), 'plugins')
const PLUGIN_REGISTRY_FILE = join(PLUGINS_DIR, 'registry.json')

function mapGenerationTypeToOutputType(type: GenerationType): 'image' | 'video' | 'text' | 'audio' {
  if (type === 'aliyun-image' || type === 'jimeng') return 'image'
  if (type === 'aliyun-video') return 'video'
  return type
}

// 确保插件目录存在
if (!existsSync(PLUGINS_DIR)) {
  mkdirSync(PLUGINS_DIR, { recursive: true })
}

class PluginEngine {
  private plugins = new Map<string, PluginInstance>()
  private registry: PluginRecord[] = []

  constructor() {
    // Security gate: plugins must be explicitly enabled by the user
    if (!store.get('pluginsEnabled')) {
      console.warn(
        '[PluginEngine] Plugins are disabled by default for security. ' +
        'To enable, set "pluginsEnabled" to true in config. ' +
        'WARNING: Plugins run with full main process privileges and can execute arbitrary code.'
      )
      // Still register IPC for status queries, but skip plugin loading
      this.registerIpc()
      return
    }
    this.loadRegistry()
    this.registerIpc()
  }

  getStatus() {
    return {
      isRunning: true,
      loadedPlugins: Array.from(this.plugins.values()).map((p) => p.manifest.id)
    }
  }

  // ===== 注册 IPC =====

  private registerIpc() {
    // 获取已安装插件列表
    ipcMain.handle('plugin:list', async () => {
      return Array.from(this.plugins.values()).map((p) => ({
        manifest: p.manifest,
        status: p.status,
        error: p.error
      }))
    })

    // 安装插件 (从本地路径或 URL)
    ipcMain.handle('plugin:install', async (_event, source: string) => {
      try {
        return await this.installPlugin(source)
      } catch (error) {
        const message = errorMessage(error)
        throw new Error(`ERR_PLUGIN_INSTALL_FAILED: Failed to install plugin: ${message}`)
      }
    })

    // 卸载插件
    ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
      return this.uninstallPlugin(pluginId)
    })

    // 启用/禁用插件
    ipcMain.handle('plugin:toggle', async (_event, pluginId: string) => {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) throw new Error('ERR_PLUGIN_NOT_FOUND: Plugin not found')

      if (plugin.status === 'active') {
        await this.deactivatePlugin(pluginId)
      } else {
        await this.activatePlugin(pluginId)
      }
      return true
    })

    // 获取插件设置
    ipcMain.handle('plugin:get-settings', async (_event, pluginId: string) => {
      const record = this.registry.find((r) => r.id === pluginId)
      return record?.settings || {}
    })

    // 更新插件设置
    ipcMain.handle('plugin:set-settings', async (_event, pluginId: string, settings: Record<string, unknown>) => {
      const record = this.registry.find((r) => r.id === pluginId)
      if (record) {
        record.settings = { ...record.settings, ...settings }
        this.saveRegistry()
      }
      return true
    })
  }

  // ===== 插件生命周期 =====

  async installPlugin(source: string): Promise<PluginRecord> {
    // 1. 下载/复制插件包
    const pluginDir = await this.downloadPlugin(source)

    // 2. 读取 manifest
    const manifestPath = join(pluginDir, 'manifest.json')
    if (!existsSync(manifestPath)) {
      throw new Error('ERR_PLUGIN_MANIFEST_MISSING: Plugin manifest file does not exist')
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest

    // 3. 验证 manifest
    this.validateManifest(manifest)

    // 4. 检查是否已安装
    if (this.plugins.has(manifest.id)) {
      throw new Error(`ERR_PLUGIN_ALREADY_INSTALLED: Plugin ${manifest.id} is already installed`)
    }

    // 5. 创建插件记录
    const record: PluginRecord = {
      id: manifest.id,
      manifest,
      status: 'installed',
      installPath: pluginDir,
      installDate: new Date().toISOString()
    }

    // 6. 注册到引擎
    const instance = this.createInstance(record)
    this.plugins.set(manifest.id, instance)
    this.registry.push(record)
    this.saveRegistry()

    // 7. 自动激活
    await this.activatePlugin(manifest.id)

    return record
  }

  async uninstallPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false

    // 1. 先停用
    if (plugin.status === 'active') {
      await this.deactivatePlugin(pluginId)
    }

    // 2. 清理注册
    plugin.registrations.forEach((reg) => reg.dispose())
    plugin.registrations = []

    // 3. 删除文件
    const record = this.registry.find((r) => r.id === pluginId)
    if (record && existsSync(record.installPath)) {
      rmSync(record.installPath, { recursive: true, force: true })
    }

    // 4. 从注册表移除
    this.plugins.delete(pluginId)
    this.registry = this.registry.filter((r) => r.id !== pluginId)
    this.saveRegistry()

    return true
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.status === 'active') return

    try {
      plugin.status = 'loading'

      // 1. 加载主进程入口
      const record = this.registry.find((r) => r.id === pluginId)
      if (!record || !record.installPath) {
        throw new Error(`Plugin ${pluginId}: install path not found in registry`)
      }
      const mainPath = join(record.installPath, plugin.context.manifest.main)
      // Validate mainPath stays within installPath to prevent path traversal
      const resolvedMain = require('node:path').resolve(mainPath)
      if (!resolvedMain.startsWith(record.installPath + require('node:path').sep) && resolvedMain !== record.installPath) {
        throw new Error(`Access denied: plugin main "${plugin.context.manifest.main}" resolves outside plugin directory`)
      }
      if (existsSync(resolvedMain)) {
        // 使用 require 加载插件主进程代码
        // 注意: 需要沙箱隔离
        const pluginModule = require(resolvedMain)
        if (pluginModule.activate) {
          await pluginModule.activate(plugin.context)
        }
      }

      // 2. 注册贡献点
      await this.registerContributes(plugin)

      plugin.status = 'active'
      this.updateRecordStatus(pluginId, 'active')
    } catch (error) {
      plugin.status = 'error'
      plugin.error = errorMessage(error)
      this.updateRecordStatus(pluginId, 'error', plugin.error)
      throw error
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || plugin.status !== 'active') return

    try {
      // 1. 调用 deactivate
      const record = this.registry.find((r) => r.id === pluginId)
      if (!record || !record.installPath) {
        throw new Error(`Plugin ${pluginId}: install path not found in registry`)
      }
      const mainPath = join(record.installPath, plugin.context.manifest.main)
      // Validate mainPath stays within installPath to prevent path traversal
      const resolvedMain = require('node:path').resolve(mainPath)
      if (!resolvedMain.startsWith(record.installPath + require('node:path').sep) && resolvedMain !== record.installPath) {
        throw new Error(`Access denied: plugin main "${plugin.context.manifest.main}" resolves outside plugin directory`)
      }
      if (existsSync(resolvedMain)) {
        const pluginModule = require(resolvedMain)
        if (pluginModule.deactivate) {
          await pluginModule.deactivate()
        }
      }

      // 2. 清理所有注册
      plugin.registrations.forEach((reg) => reg.dispose())
      plugin.registrations = []

      plugin.status = 'disabled'
      this.updateRecordStatus(pluginId, 'disabled')
    } catch (error) {
      plugin.status = 'error'
      plugin.error = errorMessage(error)
      this.updateRecordStatus(pluginId, 'error', plugin.error)
    }
  }

  // ===== 贡献点注册 =====

  private async registerContributes(plugin: PluginInstance): Promise<void> {
    const contributes = plugin.manifest.contributes
    if (!contributes) return

    // 注册生成类型
    if (contributes.generationTypes) {
      for (const genType of contributes.generationTypes) {
        const reg: PluginRegistration = {
          type: 'generation',
          id: genType.id,
          dispose: () => {
            // 取消注册生成类型
          }
        }
        plugin.registrations.push(reg)
      }
    }

    // 注册命令
    if (contributes.commands) {
      for (const cmd of contributes.commands) {
        const handler = () => {
          // 通过 IPC 转发到渲染进程执行
        }
        ipcMain.handle(`plugin:command:${cmd.id}`, handler)

        const reg: PluginRegistration = {
          type: 'command',
          id: cmd.id,
          dispose: () => {
            ipcMain.removeHandler(`plugin:command:${cmd.id}`)
          }
        }
        plugin.registrations.push(reg)
      }
    }

    // 注册 IPC 处理器
    if (plugin.manifest.permissions.includes('ipc')) {
      // 插件可以通过 context.api 注册自定义 IPC
    }
  }

  // ===== 辅助方法 =====

  private createInstance(record: PluginRecord): PluginInstance {
    const context: PluginContext = {
      manifest: record.manifest,
      api: {
        generate: async (type, params) => {
          // 插件调用主应用生成能力
          if (!record.manifest.permissions.includes('generation')) {
            return {
              success: false,
              error: 'ERR_PLUGIN_NO_GENERATION_PERMISSION: Plugin does not have generation permission'
            }
          }
          try {
            const queue = getGenerationQueue()
            const genType = type as GenerationType
            const task = queue.createTask(genType, {
              prompt: (params.prompt as string) || '',
              model: params.model as string | undefined,
              providerId: params.providerId as string | undefined,
              n: (params.n as number) || 1,
              size: params.size as ImageSize | undefined,
              aspectRatio: params.aspectRatio as string | undefined,
              quality: params.quality as ImageQuality | undefined,
              style: params.style as ImageStyle | undefined,
              seed: params.seed as number | undefined,
              duration: params.duration as number | undefined,
              fps: params.fps as number | undefined,
              cameraMotion: params.cameraMotion as 'static' | 'pan' | 'zoom_in' | 'zoom_out' | 'orbit' | undefined,
              referenceImages: params.referenceImages as string[] | undefined,
              negativePrompt: params.negativePrompt as string | undefined
            })

            // Wait for task completion with timeout
            const result = await this.waitForTask(task)
            return result
          } catch (error) {
            const message = errorMessage(error)
            return { success: false, error: message }
          }
        },
        storage: {
          get: async <T>(key: string): Promise<T | undefined> => {
            const settings = record.settings || {}
            return settings[key] as T
          },
          set: async <T>(key: string, value: T): Promise<void> => {
            record.settings = { ...record.settings, [key]: value }
            this.saveRegistry()
          }
        },
        ui: {
          showNotification: (message, type = 'info') => {
            console.log(`[Plugin ${record.manifest.id}] ${type}: ${message}`)
          },
          showModal: async () => null,
          openPanel: () => {}
        },
        fetch: async (url, options) => {
          if (!record.manifest.permissions.includes('network')) {
            throw new Error('ERR_PLUGIN_NO_NETWORK_PERMISSION: Plugin does not have network permission')
          }
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), PLUGIN_FETCH_TIMEOUT)
          try {
            return await fetch(url, { ...options, signal: controller.signal })
          } finally {
            clearTimeout(timeout)
          }
        },
        log: {
          info: (...args) => console.log(`[Plugin ${record.manifest.id}]`, ...args),
          warn: (...args) => console.warn(`[Plugin ${record.manifest.id}]`, ...args),
          error: (...args) => console.error(`[Plugin ${record.manifest.id}]`, ...args)
        }
      },
      events: {
        on: (_event, _handler) => {
          // 实现事件监听
          return () => {}
        },
        emit: (_event, ..._args) => {
          // 实现事件发射
        }
      }
    }

    return {
      manifest: record.manifest,
      status: 'installed',
      context,
      registrations: []
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('ERR_PLUGIN_MANIFEST_INVALID: Plugin manifest invalid: missing required fields')
    }
    if (!manifest.main) {
      throw new Error('ERR_PLUGIN_MANIFEST_INVALID: Plugin manifest invalid: missing main entry')
    }
    if (!manifest.permissions) {
      manifest.permissions = []
    }
  }

  private async downloadPlugin(source: string): Promise<string> {
    // 本地路径
    if (existsSync(source)) {
      const stat = statSync(source)
      if (stat.isDirectory()) {
        return source
      }
      // Plugin archive extraction requires a zip library (e.g. adm-zip)
      // For now, only directory-based plugins are supported
      throw new Error(
        'ERR_PLUGIN_ARCHIVE_NOT_SUPPORTED: Plugin archive extraction is not yet implemented. Please extract manually and provide the directory path.'
      )
    }

    // URL 下载
    if (source.startsWith('http')) {
      const pluginId = `plugin-${Date.now()}`
      const pluginDir = join(PLUGINS_DIR, pluginId)
      mkdirSync(pluginDir, { recursive: true })

      const dController = new AbortController()
      const dTimeout = setTimeout(() => dController.abort(), PLUGIN_FETCH_TIMEOUT)
      let response: Response
      try {
        response = await fetch(source, { signal: dController.signal })
      } finally {
        clearTimeout(dTimeout)
      }
      if (!response.ok) {
        throw new Error(`ERR_PLUGIN_DOWNLOAD_FAILED: Failed to download plugin: ${response.status}`)
      }

      // Plugin download requires zip extraction
      // Save the downloaded file for manual extraction
      const buffer = await response.arrayBuffer()
      const zipPath = join(pluginDir, 'plugin.zip')
      const tmpPath = zipPath + '.tmp.' + process.pid
      writeFileSync(tmpPath, Buffer.from(buffer))
      renameSync(tmpPath, zipPath)
      throw new Error(
        `ERR_PLUGIN_DOWNLOADED: Plugin downloaded to ${zipPath}. Please extract manually and reinstall from the directory.`
      )
    }

    throw new Error(`ERR_UNSUPPORTED_PLUGIN_SOURCE: Unsupported plugin source: ${source}`)
  }

  private loadRegistry(): void {
    try {
      if (existsSync(PLUGIN_REGISTRY_FILE)) {
        const data = readFileSync(PLUGIN_REGISTRY_FILE, 'utf-8')
        this.registry = JSON.parse(data)

        // 恢复插件实例
        for (const record of this.registry) {
          if (existsSync(record.installPath)) {
            const instance = this.createInstance(record)
            this.plugins.set(record.id, instance)

            // 如果之前是 active 状态，尝试重新激活
            if (record.status === 'active') {
              this.activatePlugin(record.id).catch((err) => {
                console.error(`Failed to reactivate plugin ${record.id}:`, err)
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load plugin registry:', error)
      this.registry = []
    }
  }

  private saveRegistry(): void {
    try {
      const tmpPath = PLUGIN_REGISTRY_FILE + '.tmp.' + process.pid
      writeFileSync(tmpPath, JSON.stringify(this.registry, null, 2))
      renameSync(tmpPath, PLUGIN_REGISTRY_FILE)
    } catch (error) {
      console.error('Failed to save plugin registry:', error)
    }
  }

  private updateRecordStatus(pluginId: string, status: PluginRecord['status'], error?: string): void {
    const record = this.registry.find((r) => r.id === pluginId)
    if (record) {
      record.status = status
      record.error = error
      this.saveRegistry()
    }
  }

  /** Wait for a generation task to complete and return result to plugin */
  private async waitForTask(task: GenerationTask): Promise<PluginGenerationResult> {
    const TIMEOUT = 10 * 60 * 1000 // 10 minutes max
    const POLL_INTERVAL = 500 // ms
    const startTime = Date.now()

    return new Promise((resolve) => {
      const check = () => {
        const elapsed = Date.now() - startTime
        if (elapsed > TIMEOUT) {
          resolve({ success: false, error: 'ERR_PLUGIN_GENERATION_TIMEOUT: Generation timed out after 10 minutes' })
          return
        }

        if (task.status === 'completed') {
          resolve({
            success: true,
            outputs: task.outputs.map((o) => ({
              type: mapGenerationTypeToOutputType(o.type),
              url: o.url,
              base64: o.base64,
              mimeType: o.mediaType
            })),
            metadata: {
              taskId: task.id,
              prompt: task.params.prompt,
              model: task.params.model,
              duration: elapsed
            }
          })
          return
        }

        if (task.status === 'failed' || task.status === 'cancelled') {
          resolve({ success: false, error: task.error || `Generation ${task.status}` })
          return
        }

        setTimeout(check, POLL_INTERVAL)
      }
      check()
    })
  }
}

// 单例
let engine: PluginEngine | null = null

export function getPluginEngine(): PluginEngine {
  if (!engine) {
    engine = new PluginEngine()
  }
  return engine
}
