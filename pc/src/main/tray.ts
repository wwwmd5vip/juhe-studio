import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { app, type BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { getGenerationQueue } from './services/queue'
import { checkForUpdates } from './updater'

let tray: Tray | null = null
let mainWindowRef: BrowserWindow | null = null

// Simple locale-aware labels for the main process (no react-i18next)
const isZh = (app.getLocale() || '').startsWith('zh')

const labels = {
  quickGenerate: isZh ? '快速生成' : 'Quick Generate',
  aiChat: isZh ? 'AI聊天' : 'AI Chat',
  taskQueue: isZh ? '任务队列' : 'Task Queue',
  settings: isZh ? '设置' : 'Settings',
  show: isZh ? '显示窗口' : 'Show Window',
  hide: isZh ? '隐藏窗口' : 'Hide Window',
  checkUpdate: isZh ? '检查更新' : 'Check for Updates',
  about: isZh ? '关于' : 'About',
  quit: isZh ? '退出' : 'Quit',
  appName: isZh ? '聚合创作引擎' : 'Cherry Studio',
  running: isZh ? '运行中' : 'Running',
  waiting: isZh ? '等待中' : 'Waiting',
  completed: isZh ? '已完成' : 'Completed',
  failed: isZh ? '失败' : 'Failed',
  idle: isZh ? '空闲' : 'Idle',
  status: isZh ? '状态' : 'Status'
}

function getQueueStatusText(): string {
  const queue = getGenerationQueue()
  const state = queue.getQueueState()
  if (state.runningCount > 0) {
    return `${labels.running}: ${state.runningCount} | ${labels.waiting}: ${state.pendingCount}`
  }
  if (state.pendingCount > 0) {
    return `${labels.waiting}: ${state.pendingCount}`
  }
  if (state.totalTasks > 0) {
    return `${labels.completed}: ${state.completedCount} | ${labels.failed}: ${state.failedCount}`
  }
  return labels.idle
}

export function createTray(mainWindow: BrowserWindow): Tray {
  mainWindowRef = mainWindow

  const iconPath = is.dev ? join(process.cwd(), 'resources/icon.png') : join(__dirname, '../../resources/icon.png')

  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (process.platform === 'darwin') {
      icon = icon.resize({ width: 16, height: 16 })
      icon.setTemplateImage(true)
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  updateTrayTooltip()

  buildTrayMenu()

  // Click behavior varies by platform
  tray.on('click', () => {
    if (process.platform === 'darwin') {
      // macOS: left-click shows the menu by default in our setup, toggle window
      toggleWindow()
    } else {
      // Windows/Linux: left-click shows menu (handled by setContextMenu)
      // We rely on the context menu for these platforms
      if (mainWindowRef) {
        tray?.popUpContextMenu()
      }
    }
  })

  tray.on('double-click', () => {
    showAndFocusWindow()
  })

  return tray
}

function buildTrayMenu(): void {
  if (!tray || !mainWindowRef) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: labels.quickGenerate,
      click: () => {
        showAndFocusWindow()
        mainWindowRef?.webContents.send('navigate:to', '/generate')
      }
    },
    {
      label: labels.aiChat,
      click: () => {
        showAndFocusWindow()
        mainWindowRef?.webContents.send('navigate:to', '/chat')
      }
    },
    {
      label: labels.taskQueue,
      click: () => {
        showAndFocusWindow()
        mainWindowRef?.webContents.send('navigate:to', '/queue')
      }
    },
    {
      label: labels.settings,
      click: () => {
        showAndFocusWindow()
        mainWindowRef?.webContents.send('navigate:to', '/settings')
      }
    },
    { type: 'separator' },
    {
      label: labels.show,
      click: () => showAndFocusWindow()
    },
    {
      label: labels.hide,
      click: () => {
        mainWindowRef?.hide()
      }
    },
    { type: 'separator' },
    {
      label: labels.checkUpdate,
      click: () => {
        checkForUpdates()
        showAndFocusWindow()
        mainWindowRef?.webContents.send('navigate:to', '/settings')
      }
    },
    {
      label: labels.about,
      click: () => {
        showAndFocusWindow()
        mainWindowRef?.webContents.send('navigate:to', '/settings/about')
      }
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

function showAndFocusWindow(): void {
  if (!mainWindowRef) return
  if (mainWindowRef.isMinimized()) mainWindowRef.restore()
  mainWindowRef.show()
  mainWindowRef.focus()
}

function toggleWindow(): void {
  if (!mainWindowRef) return
  if (mainWindowRef.isVisible()) {
    mainWindowRef.hide()
  } else {
    showAndFocusWindow()
  }
}

export function updateTrayTooltip(): void {
  if (!tray) return
  const queueStatus = getQueueStatusText()
  tray.setToolTip(`${labels.appName}\n${labels.status}: ${queueStatus}`)
}

export function updateTrayBadge(count: number): void {
  if (!tray || process.platform === 'linux') return

  // macOS supports setTitle as badge; Windows doesn't have native badge on tray
  if (process.platform === 'darwin') {
    tray.setTitle(count > 0 ? String(count) : '')
  }

  // Update tooltip to reflect running tasks
  updateTrayTooltip()
}

export function getTray(): Tray | null {
  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
  mainWindowRef = null
}
