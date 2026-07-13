/**
 * Notification Service
 * Uses Electron's Notification API for OS-level notifications
 * Respects user's notification settings
 */

import { ipcMain, Notification } from 'electron'
import store from '../stores/config'

interface NotificationSettings {
  enabled: boolean
  taskCompleted: boolean
  taskFailed: boolean
  queueCompleted: boolean
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  taskCompleted: true,
  taskFailed: true,
  queueCompleted: true
}

// Rate limiting: max N notifications per window
const NOTIFICATION_BURST_MAX = 5
const NOTIFICATION_BURST_WINDOW_MS = 10_000
const notificationTimestamps: number[] = []

function isRateLimited(): boolean {
  const now = Date.now()
  // Purge timestamps outside the window
  while (notificationTimestamps.length > 0 && now - notificationTimestamps[0] > NOTIFICATION_BURST_WINDOW_MS) {
    notificationTimestamps.shift()
  }
  if (notificationTimestamps.length >= NOTIFICATION_BURST_MAX) {
    return true
  }
  notificationTimestamps.push(now)
  // Trim to max entries to bound memory
  if (notificationTimestamps.length > NOTIFICATION_BURST_MAX * 2) {
    notificationTimestamps.splice(0, notificationTimestamps.length - NOTIFICATION_BURST_MAX)
  }
  return false
}

function getSettings(): NotificationSettings {
  return (store.get('notificationSettings') as NotificationSettings) ?? DEFAULT_SETTINGS
}

function shouldShow(type: keyof Omit<NotificationSettings, 'enabled'>): boolean {
  const settings = getSettings()
  if (!settings.enabled) return false
  return settings[type] ?? true
}

/**
 * Show an OS notification
 */
export function showNotification(options: { title: string; body: string; silent?: boolean }): void {
  const settings = getSettings()
  if (!settings.enabled) return

  // Don't show if app has notification permission disabled
  if (!Notification.isSupported()) return

  // Rate limit to prevent notification spam
  if (isRateLimited()) return

  const notification = new Notification({
    ...options,
    silent: options.silent ?? false
  })

  notification.show()
}

/**
 * Show task completed notification
 */
export function notifyTaskCompleted(taskType: string, prompt?: string): void {
  if (!shouldShow('taskCompleted')) return

  const typeLabel = taskType === 'image' ? '图片' : taskType === 'video' ? '视频' : '任务'
  showNotification({
    title: `${typeLabel}生成完成`,
    body: prompt ? `「${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}」` : '您的生成任务已完成',
    silent: false
  })

  // Also emit to renderer for in-app notification toast
  const { BrowserWindow } = require('electron')
  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
    win.webContents.send('notification:show', {
      type: 'taskCompleted',
      title: `${typeLabel}生成完成`,
      body: prompt ? `「${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}」` : '您的生成任务已完成'
    })
  })
}

/**
 * Show task failed notification
 */
export function notifyTaskFailed(taskType: string, error?: string): void {
  if (!shouldShow('taskFailed')) return

  const typeLabel = taskType === 'image' ? '图片' : taskType === 'video' ? '视频' : '任务'
  showNotification({
    title: `${typeLabel}生成失败`,
    body: error ? error.slice(0, 100) : '生成任务执行失败，请检查配置后重试',
    silent: false
  })

  const { BrowserWindow } = require('electron')
  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
    win.webContents.send('notification:show', {
      type: 'taskFailed',
      title: `${typeLabel}生成失败`,
      body: error ? error.slice(0, 100) : '生成任务执行失败，请检查配置后重试'
    })
  })
}

/**
 * Show all tasks in queue completed notification
 */
export function notifyQueueCompleted(total: number): void {
  if (!shouldShow('queueCompleted')) return

  showNotification({
    title: '队列任务全部完成',
    body: `队列中的 ${total} 个任务已全部处理完毕`,
    silent: false
  })

  const { BrowserWindow } = require('electron')
  BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
    win.webContents.send('notification:show', {
      type: 'queueCompleted',
      title: '队列任务全部完成',
      body: `队列中的 ${total} 个任务已全部处理完毕`
    })
  })
}

/**
 * Register notification IPC handlers
 */
export function registerNotificationIpc(): void {
  ipcMain.handle('notifications:request-permission', () => {
    return Notification.isSupported()
  })

  ipcMain.handle('notifications:get-settings', () => {
    return getSettings()
  })

  ipcMain.handle('notifications:set-settings', (_, settings: Partial<NotificationSettings>) => {
    const current = getSettings()
    const updated = { ...current, ...settings }
    store.set('notificationSettings', updated)
    return updated
  })
}
