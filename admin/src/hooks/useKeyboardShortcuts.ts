import { useEffect } from 'react'

type ShortcutHandler = (e: KeyboardEvent) => void

interface ShortcutDef {
  key: string
  ctrl?: boolean
  handler: ShortcutHandler
}

/**
 * 全局键盘快捷键 Hook
 * @example
 * useKeyboardShortcuts([
 *   { key: 'b', ctrl: true, handler: () => toggleSider() },
 *   { key: 'Escape', handler: () => closeModal() },
 * ])
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()
        const ctrlMatch = s.ctrl
          ? e.ctrlKey || e.metaKey
          : !e.ctrlKey && !e.metaKey && !e.altKey

        if (keyMatch && ctrlMatch && !isInputFocused()) {
          e.preventDefault()
          s.handler(e)
          break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}
