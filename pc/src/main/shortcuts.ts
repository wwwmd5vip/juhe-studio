import { type BrowserWindow, globalShortcut } from 'electron'

const SHORTCUT_TOGGLE = 'CommandOrControl+Shift+Space'

export function registerGlobalShortcuts(mainWindow: BrowserWindow): void {
  // Toggle window visibility
  globalShortcut.register(SHORTCUT_TOGGLE, () => {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  console.log('[Shortcuts] Global shortcuts registered')
}

export function unregisterGlobalShortcuts(): void {
  try {
    globalShortcut.unregisterAll()
    console.log('[Shortcuts] Global shortcuts unregistered')
  } catch (err) {
    console.error('[Shortcuts] Failed to unregister shortcuts:', err)
  }
}
