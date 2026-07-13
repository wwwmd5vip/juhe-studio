import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chat'
import { useGenerationStore } from '@/stores/generation'
import { useShortcutsStore } from '@/stores/shortcuts'

function formatKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.metaKey && !e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  if (key === ' ') {
    parts.push('Space')
  } else if (key !== 'Control' && key !== 'Alt' && key !== 'Shift' && key !== 'Meta') {
    // Capitalize single letters for consistency
    if (key.length === 1) {
      parts.push(key.toUpperCase())
    } else {
      parts.push(key)
    }
  }

  return parts.join('+')
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  const editable = target.isContentEditable
  return tag === 'input' || tag === 'textarea' || tag === 'select' || editable
}

export function useShortcuts() {
  const router = useRouter()
  const { shortcuts, isRecording, recordingFor, updateShortcut, stopRecording } = useShortcutsStore()
  const { createSession } = useChatStore()
  const { isGenerating, createTask, cancelTask, activeTaskId, params } = useGenerationStore()

  const recordingForRef = useRef(recordingFor)
  const isRecordingRef = useRef(isRecording)
  const shortcutsRef = useRef(shortcuts)

  useEffect(() => {
    recordingForRef.current = recordingFor
  }, [recordingFor])

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Recording mode: capture key for shortcut assignment
      if (isRecordingRef.current && recordingForRef.current) {
        e.preventDefault()
        e.stopPropagation()
        const combo = formatKeyEvent(e)
        if (combo) {
          updateShortcut(recordingForRef.current, combo)
        } else {
          stopRecording()
        }
        return
      }

      const formatted = formatKeyEvent(e)
      if (!formatted) return

      // Find matching enabled shortcut
      const shortcut = shortcutsRef.current.find((s) => s.isEnabled && s.currentKey === formatted)
      if (!shortcut) return

      // Ignore navigation/generation shortcuts when typing in inputs
      if (isTypingTarget(e.target) && shortcut.category !== 'global') {
        return
      }

      // Execute action
      switch (shortcut.id) {
        case 'nav-generate':
          e.preventDefault()
          router.navigate({ to: '/generate' })
          break
        case 'nav-history':
          e.preventDefault()
          router.navigate({ to: '/queue' })
          break
        case 'nav-queue':
          e.preventDefault()
          router.navigate({ to: '/queue' })
          break
        case 'nav-chat':
          e.preventDefault()
          router.navigate({ to: '/chat' })
          break
        case 'nav-settings':
          e.preventDefault()
          router.navigate({ to: '/settings' })
          break
        case 'nav-home':
          e.preventDefault()
          router.navigate({ to: '/' })
          break
        case 'chat-new':
          e.preventDefault()
          createSession().catch(() => {})
          break
        case 'chat-send': {
          e.preventDefault()
          // Dispatch a custom event that ChatInput can listen to
          window.dispatchEvent(new CustomEvent('shortcut:send-message'))
          break
        }
        case 'gen-start': {
          e.preventDefault()
          if (!isGenerating && params.prompt.trim().length > 0 && params.providerId && params.model) {
            createTask('image', params).catch(() => {})
          }
          break
        }
        case 'gen-cancel': {
          e.preventDefault()
          if (isGenerating && activeTaskId) {
            cancelTask(activeTaskId).catch(() => {})
          }
          break
        }
        case 'global-escape': {
          // Close modals/panels by dispatching a custom event
          window.dispatchEvent(new CustomEvent('shortcut:close-panels'))
          break
        }
        case 'global-help': {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('shortcut:toggle-help'))
          break
        }
        default:
          break
      }
    },
    [router, updateShortcut, stopRecording, createSession, isGenerating, createTask, cancelTask, activeTaskId, params]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
