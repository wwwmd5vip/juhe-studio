/**
 * Backup & Restore state management (Zustand + persist)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAgentsStore } from './agents'
import { useFavoritesStore } from './favorites'
import { useGenerationStore } from './generation'
import { useProviderStore } from './providers'
import { useShortcutsStore } from './shortcuts'
import { useThemeStore } from './theme'

export type BackupCategory = 'settings' | 'providers' | 'history' | 'favorites' | 'workflows' | 'agents' | 'shortcuts'

export interface BackupItem {
  id: string
  name: string
  description?: string
  createdAt: number
  size: number // bytes
  includes: BackupCategory[]
  path?: string // file path if exported
}

interface BackupPayload {
  version: number
  createdAt: number
  categories: BackupCategory[]
  data: Partial<Record<BackupCategory, unknown>>
}

interface BackupState {
  backups: BackupItem[]
  // Backup payloads stored in-memory (not persisted) so restoreBackup uses saved data
  payloads: Record<string, BackupPayload>
  isBackingUp: boolean
  isRestoring: boolean
  error: string | null
  createBackup: (name: string, includes: BackupCategory[]) => Promise<string>
  restoreBackup: (id: string) => Promise<void>
  deleteBackup: (id: string) => void
  exportBackup: (id: string) => Promise<string>
  importBackup: (filePath: string) => Promise<void>
  getBackupSize: (id: string) => number
}

const BACKUP_VERSION = 1

const CATEGORY_LABELS: Record<BackupCategory, string> = {
  settings: 'Settings',
  providers: 'Providers',
  history: 'History',
  favorites: 'Favorites',
  workflows: 'Workflows',
  agents: 'Agents',
  shortcuts: 'Shortcuts'
}

function collectData(categories: BackupCategory[]): Partial<Record<BackupCategory, unknown>> {
  const data: Partial<Record<BackupCategory, unknown>> = {}

  for (const cat of categories) {
    switch (cat) {
      case 'settings': {
        const { mode } = useThemeStore.getState()
        data.settings = { mode }
        break
      }
      case 'providers': {
        const { providers } = useProviderStore.getState()
        data.providers = providers
        break
      }
      case 'history': {
        const { tasks } = useGenerationStore.getState()
        data.history = tasks
        break
      }
      case 'favorites': {
        const { items } = useFavoritesStore.getState()
        data.favorites = items
        break
      }
      case 'agents': {
        const { agents } = useAgentsStore.getState()
        data.agents = agents
        break
      }
      case 'shortcuts': {
        const { shortcuts } = useShortcutsStore.getState()
        data.shortcuts = shortcuts
        break
      }
      case 'workflows': {
        // Workflows are stored in DB; we persist an empty placeholder for now
        data.workflows = []
        break
      }
    }
  }

  return data
}

function applyData(payload: BackupPayload) {
  const { data, categories } = payload

  for (const cat of categories) {
    const catData = data[cat]
    if (catData === undefined) continue

    switch (cat) {
      case 'settings': {
        const { mode } = catData as { mode: 'light' | 'dark' | 'system' }
        useThemeStore.getState().setMode(mode)
        break
      }
      case 'providers': {
        // Providers are managed via DB in this app; skip direct restore
        break
      }
      case 'history': {
        const tasks = catData as ReturnType<typeof useGenerationStore.getState>['tasks']
        useGenerationStore.setState({ tasks })
        break
      }
      case 'favorites': {
        const items = catData as ReturnType<typeof useFavoritesStore.getState>['items']
        useFavoritesStore.setState({ items })
        break
      }
      case 'agents': {
        const agents = catData as ReturnType<typeof useAgentsStore.getState>['agents']
        useAgentsStore.setState({ agents })
        break
      }
      case 'shortcuts': {
        const shortcuts = catData as ReturnType<typeof useShortcutsStore.getState>['shortcuts']
        useShortcutsStore.setState({ shortcuts })
        break
      }
      case 'workflows': {
        // Workflows are stored in DB; skip for now
        break
      }
    }
  }
}

function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2)
}

function deserializeBackup(json: string): BackupPayload {
  const parsed = JSON.parse(json) as BackupPayload
  if (parsed.version !== BACKUP_VERSION) {
    // Future: handle migration
  }
  return parsed
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set, get) => ({
      backups: [],
      payloads: {},
      isBackingUp: false,
      isRestoring: false,
      error: null,

      createBackup: async (name, includes) => {
        set({ isBackingUp: true })
        try {
          const data = collectData(includes)
          const payload: BackupPayload = {
            version: BACKUP_VERSION,
            createdAt: Date.now(),
            categories: includes,
            data
          }
          const json = serializeBackup(payload)
          const size = new Blob([json]).size

          const id = crypto.randomUUID()
          const backup: BackupItem = {
            id,
            name,
            createdAt: Date.now(),
            size,
            includes
          }

          set((state) => ({
            backups: [backup, ...state.backups],
            payloads: { ...state.payloads, [id]: payload },
            isBackingUp: false
          }))

          return id
        } catch (error) {
          set({ isBackingUp: false })
          throw error
        }
      },

      restoreBackup: async (id) => {
        const state = get()
        const backup = state.backups.find((b) => b.id === id)
        if (!backup) throw new Error('Backup not found')

        // Use stored payload if available, otherwise fall back to re-collecting
        const payload = state.payloads[id]
        if (!payload) {
          throw new Error('Backup payload not found — the backup data is no longer available')
        }

        set({ isRestoring: true })
        try {
          applyData(payload)
          set({ isRestoring: false })
        } catch (error) {
          set({ isRestoring: false })
          throw error
        }
      },

      deleteBackup: (id) => {
        set((state) => {
          const { [id]: _, ...remainingPayloads } = state.payloads
          return {
            backups: state.backups.filter((b) => b.id !== id),
            payloads: remainingPayloads
          }
        })
      },

      exportBackup: async (id) => {
        const state = get()
        const backup = state.backups.find((b) => b.id === id)
        if (!backup) throw new Error('Backup not found')

        // Use stored payload if available
        const payload = state.payloads[id]
        const json = payload
          ? serializeBackup(payload)
          : serializeBackup({
              version: BACKUP_VERSION,
              createdAt: backup.createdAt,
              categories: backup.includes,
              data: collectData(backup.includes)
            })
        const filename = `cherry-backup-${backup.name.replace(/\s+/g, '_')}-${new Date(backup.createdAt).toISOString().slice(0, 10)}.json`
        downloadFile(json, filename)
        return filename
      },

      importBackup: async (filePath) => {
        let json: string
        if (filePath.startsWith('data:') || filePath.startsWith('blob:')) {
          const res = await fetch(filePath)
          json = await res.text()
        } else {
          json = filePath
        }

        const payload = deserializeBackup(json)
        applyData(payload)

        const size = new Blob([json]).size
        const id = crypto.randomUUID()
        const backup: BackupItem = {
          id,
          name: `Imported ${new Date(payload.createdAt).toLocaleString()}`,
          createdAt: payload.createdAt,
          size,
          includes: payload.categories
        }

        set((state) => ({
          backups: [backup, ...state.backups],
          payloads: { ...state.payloads, [id]: payload }
        }))
      },

      getBackupSize: (id) => {
        const backup = get().backups.find((b) => b.id === id)
        return backup?.size || 0
      }
    }),
    {
      name: 'cherrystudio-backups',
      partialize: (state) => ({
        backups: state.backups
      })
    }
  )
)

export { CATEGORY_LABELS }
