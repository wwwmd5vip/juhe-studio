import { type RefObject, useEffect } from 'react'

interface UseCanvasKeyboardOptions {
  /** Optional ref to the canvas container — shortcuts only fire when focus is inside this element */
  containerRef?: RefObject<HTMLElement | null>
  onUndo: () => void
  onRedo: () => void
  onDeleteSelected: () => void
  onCopySelected: () => void
  onPaste: () => void
  onDuplicateSelected: () => void
  onSelectAll: () => void
  /** 清除所有状态（Escape） */
  onClearAll: () => void
  onGroupSelected: () => void
  onRunSelected: () => void
  onRunCascade: () => void
}

export function useCanvasKeyboard({
  containerRef,
  onUndo,
  onRedo,
  onDeleteSelected,
  onCopySelected,
  onPaste,
  onDuplicateSelected,
  onSelectAll,
  onClearAll,
  onGroupSelected,
  onRunSelected,
  onRunCascade
}: UseCanvasKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle canvas shortcuts when focus is inside the canvas workspace
      if (containerRef?.current && !containerRef.current.contains(document.activeElement)) {
        return
      }

      // 忽略在输入框中按下的键
      const target = event.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[data-canvas-no-keyboard]')
      ) {
        return
      }

      const isMod = event.metaKey || event.ctrlKey

      // Escape - clear all state
      if (event.key === 'Escape') {
        event.preventDefault()
        onClearAll()
        return
      }

      // Delete / Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        onDeleteSelected()
        return
      }

      // Ctrl+Z - undo
      if (isMod && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        onUndo()
        return
      }

      // Ctrl+Shift+Z or Ctrl+Y - redo
      if ((isMod && event.key === 'z' && event.shiftKey) || (isMod && event.key === 'y')) {
        event.preventDefault()
        onRedo()
        return
      }

      // Ctrl+C - copy
      if (isMod && event.key === 'c') {
        event.preventDefault()
        onCopySelected()
        return
      }

      // Ctrl+V - paste
      if (isMod && event.key === 'v') {
        event.preventDefault()
        onPaste()
        return
      }

      // Ctrl+D - duplicate
      if (isMod && event.key === 'd') {
        event.preventDefault()
        onDuplicateSelected()
        return
      }

      // Ctrl+A - select all
      if (isMod && event.key === 'a') {
        event.preventDefault()
        onSelectAll()
        return
      }

      // Ctrl+G - group
      if (isMod && event.key === 'g') {
        event.preventDefault()
        onGroupSelected()
        return
      }

      // Enter - run selected
      if (event.key === 'Enter') {
        event.preventDefault()
        onRunSelected()
        return
      }

      // Ctrl+Enter - run cascade
      if (isMod && event.key === 'Enter') {
        event.preventDefault()
        onRunCascade()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    containerRef,
    onUndo,
    onRedo,
    onDeleteSelected,
    onCopySelected,
    onPaste,
    onDuplicateSelected,
    onSelectAll,
    onClearAll,
    onGroupSelected,
    onRunSelected,
    onRunCascade
  ])
}
