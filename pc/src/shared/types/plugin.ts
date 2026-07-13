/**
 * 插件系统类型定义
 * M4 Phase 2: 插件架构设计
 *
 * 插件生命周期: install → load → enable → disable → uninstall
 * 插件可以扩展: 生成能力、UI 组件、IPC 处理器、设置项
 */

// ===== 插件元数据 =====

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  homepage?: string
  icon?: string

  // 兼容性
  minAppVersion: string
  maxAppVersion?: string

  // 权限声明
  permissions: PluginPermission[]

  // 入口文件
  main: string // main process entry
  renderer?: string // renderer process entry (optional)

  // 贡献点
  contributes?: PluginContributes
}

export type PluginPermission =
  | 'ipc' // 注册 IPC 处理器
  | 'db' // 访问数据库
  | 'fs' // 文件系统读写
  | 'network' // 网络请求
  | 'ui.sidebar' // 添加侧边栏项
  | 'ui.toolbar' // 添加工具栏按钮
  | 'ui.settings' // 添加设置页
  | 'ui.panel' // 添加面板
  | 'generation' // 扩展生成能力
  | 'storage' // 本地存储

export interface PluginContributes {
  // 生成类型扩展
  generationTypes?: PluginGenerationType[]

  // UI 扩展
  sidebarItems?: PluginSidebarItem[]
  toolbarButtons?: PluginToolbarButton[]
  settingPanels?: PluginSettingPanel[]

  // 命令
  commands?: PluginCommand[]

  // 菜单
  menus?: PluginMenuItem[]
}

// ===== 插件生成类型扩展 =====

export interface PluginGenerationType {
  id: string
  label: string
  icon: string
  description: string
  parameters: PluginParameterDef[]
  execute: (params: Record<string, unknown>) => Promise<PluginGenerationResult>
}

export interface PluginParameterDef {
  key: string
  label: string
  type: 'text' | 'number' | 'slider' | 'boolean' | 'select' | 'textarea' | 'file'
  default?: unknown
  min?: number
  max?: number
  step?: number
  options?: Array<{ label: string; value: string }>
  required?: boolean
  description?: string
}

export interface PluginGenerationResult {
  success: boolean
  outputs?: Array<{
    type: 'image' | 'video' | 'text' | 'audio'
    url?: string
    base64?: string
    content?: string
    mimeType?: string
  }>
  error?: string
  metadata?: Record<string, unknown>
}

// ===== UI 扩展 =====

export interface PluginSidebarItem {
  id: string
  label: string
  icon: string
  route?: string
  panel?: string
}

export interface PluginToolbarButton {
  id: string
  label: string
  icon: string
  tooltip?: string
  command: string
}

export interface PluginSettingPanel {
  id: string
  label: string
  icon: string
  schema: PluginParameterDef[]
}

export interface PluginCommand {
  id: string
  label: string
  keybinding?: string
  handler: () => void | Promise<void>
}

export interface PluginMenuItem {
  id: string
  label: string
  group: 'file' | 'edit' | 'view' | 'tools' | 'help'
  command: string
  shortcut?: string
}

// ===== 插件运行时 =====

export interface PluginInstance {
  manifest: PluginManifest
  status: 'installed' | 'loading' | 'active' | 'error' | 'disabled'
  error?: string

  // 运行时上下文
  context: PluginContext

  // 生命周期方法
  activate?: () => Promise<void>
  deactivate?: () => Promise<void>

  // 已注册的贡献
  registrations: PluginRegistration[]
}

export interface PluginContext {
  // 插件 manifest
  manifest: PluginManifest

  // API 访问
  api: {
    // 生成 API
    generate: (type: string, params: Record<string, unknown>) => Promise<PluginGenerationResult>

    // 存储 API
    storage: {
      get: <T>(key: string) => Promise<T | undefined>
      set: <T>(key: string, value: T) => Promise<void>
    }

    // UI API
    ui: {
      showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
      showModal: (component: unknown, props?: Record<string, unknown>) => Promise<unknown>
      openPanel: (panelId: string) => void
    }

    // 网络 API
    fetch: (url: string, options?: RequestInit) => Promise<Response>

    // 日志 API
    log: {
      info: (...args: unknown[]) => void
      warn: (...args: unknown[]) => void
      error: (...args: unknown[]) => void
    }
  }

  // 事件系统
  events: {
    on: (event: string, handler: (...args: unknown[]) => void) => () => void
    emit: (event: string, ...args: unknown[]) => void
  }
}

export interface PluginRegistration {
  type: 'ipc' | 'ui' | 'command' | 'generation' | 'menu'
  id: string
  dispose: () => void
}

// ===== 插件存储 =====

export interface PluginRecord {
  id: string
  manifest: PluginManifest
  status: 'installed' | 'active' | 'disabled' | 'error'
  installPath: string
  installDate: string
  error?: string
  settings?: Record<string, unknown>
}

// ===== 插件市场 =====

export interface PluginMarketItem {
  id: string
  name: string
  version: string
  description: string
  author: string
  downloads: number
  rating: number
  icon?: string
  tags: string[]
  manifestUrl: string
  downloadUrl: string
}
