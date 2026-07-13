import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShortcutCategory = 'navigation' | 'generation' | 'chat' | 'global'

export interface Shortcut {
  id: string
  name: string
  description: string
  defaultKey: string
  currentKey: string
  category: ShortcutCategory
  isEnabled: boolean
}

interface ShortcutsState {
  shortcuts: Shortcut[]
  isRecording: boolean
  recordingFor: string | null
  updateShortcut: (id: string, key: string) => void
  resetToDefault: (id: string) => void
  resetAll: () => void
  toggleEnabled: (id: string) => void
  startRecording: (id: string) => void
  stopRecording: () => void
  getShortcutById: (id: string) => Shortcut | undefined
}

const defaultShortcuts: Shortcut[] = [
  {
    id: 'nav-generate',
    name: 'Go to Generate',
    description: 'Navigate to the Generate page',
    defaultKey: 'Ctrl+G',
    currentKey: 'Ctrl+G',
    category: 'navigation',
    isEnabled: true
  },
  {
    id: 'nav-history',
    name: 'Go to History',
    description: 'Navigate to the History page',
    defaultKey: 'Ctrl+H',
    currentKey: 'Ctrl+H',
    category: 'navigation',
    isEnabled: true
  },
  {
    id: 'nav-queue',
    name: 'Go to Queue',
    description: 'Navigate to the Queue page',
    defaultKey: 'Ctrl+Q',
    currentKey: 'Ctrl+Q',
    category: 'navigation',
    isEnabled: true
  },
  {
    id: 'nav-chat',
    name: 'Go to Chat',
    description: 'Navigate to the Chat page',
    defaultKey: 'Ctrl+C',
    currentKey: 'Ctrl+C',
    category: 'navigation',
    isEnabled: true
  },
  {
    id: 'nav-settings',
    name: 'Go to Settings',
    description: 'Navigate to the Settings page',
    defaultKey: 'Ctrl+S',
    currentKey: 'Ctrl+S',
    category: 'navigation',
    isEnabled: true
  },
  {
    id: 'nav-home',
    name: 'Go to Dashboard',
    description: 'Navigate to the Home/Dashboard page',
    defaultKey: 'Ctrl+D',
    currentKey: 'Ctrl+D',
    category: 'navigation',
    isEnabled: true
  },
  {
    id: 'chat-new',
    name: 'New Chat',
    description: 'Start a new chat session',
    defaultKey: 'Ctrl+N',
    currentKey: 'Ctrl+N',
    category: 'chat',
    isEnabled: true
  },
  {
    id: 'chat-send',
    name: 'Send Message',
    description: 'Send the current message in chat',
    defaultKey: 'Ctrl+Enter',
    currentKey: 'Ctrl+Enter',
    category: 'chat',
    isEnabled: true
  },
  {
    id: 'gen-start',
    name: 'Start Generation',
    description: 'Start image or video generation',
    defaultKey: 'Ctrl+Shift+G',
    currentKey: 'Ctrl+Shift+G',
    category: 'generation',
    isEnabled: true
  },
  {
    id: 'gen-cancel',
    name: 'Cancel Generation',
    description: 'Cancel the current generation',
    defaultKey: 'Ctrl+Shift+C',
    currentKey: 'Ctrl+Shift+C',
    category: 'generation',
    isEnabled: true
  },
  {
    id: 'global-escape',
    name: 'Close Panels',
    description: 'Close panels, modals, and sidebars',
    defaultKey: 'Escape',
    currentKey: 'Escape',
    category: 'global',
    isEnabled: true
  },
  {
    id: 'global-help',
    name: 'Show Shortcuts Help',
    description: 'Display the keyboard shortcuts help overlay',
    defaultKey: 'Ctrl+/',
    currentKey: 'Ctrl+/',
    category: 'global',
    isEnabled: true
  }
]

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      shortcuts: defaultShortcuts.map((s) => ({ ...s })),
      isRecording: false,
      recordingFor: null,

      updateShortcut: (id, key) => {
        set((state) => ({
          shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...s, currentKey: key } : s)),
          isRecording: false,
          recordingFor: null
        }))
      },

      resetToDefault: (id) => {
        set((state) => ({
          shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...s, currentKey: s.defaultKey } : s))
        }))
      },

      resetAll: () => {
        set((state) => ({
          shortcuts: state.shortcuts.map((s) => ({ ...s, currentKey: s.defaultKey, isEnabled: true }))
        }))
      },

      toggleEnabled: (id) => {
        set((state) => ({
          shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s))
        }))
      },

      startRecording: (id) => {
        set({ isRecording: true, recordingFor: id })
      },

      stopRecording: () => {
        set({ isRecording: false, recordingFor: null })
      },

      getShortcutById: (id) => {
        return get().shortcuts.find((s) => s.id === id)
      }
    }),
    {
      name: 'cherrystudio-shortcuts',
      partialize: (state) => ({
        shortcuts: state.shortcuts
      })
    }
  )
)
