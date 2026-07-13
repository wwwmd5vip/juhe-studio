/**
 * Skills Store
 * Skill management state for renderer
 */

import { create } from 'zustand'
import { createApiProxy } from '@/utils/api-proxy'

const api = createApiProxy()

export interface Skill {
  id: string
  name: string
  title: string
  description?: string
  content: string
  category?: string
  isEnabled?: boolean
  isBuiltin?: boolean
  metadata?: Record<string, unknown>
  icon?: string
  orderKey?: number
  createdAt: string
  updatedAt: string
}

interface SkillsState {
  skills: Skill[]
  activeSkillIds: string[]
  isLoading: boolean
  error: string | null

  loadSkills: () => Promise<void>
  createSkill: (data: { name: string; title: string; content: string }) => Promise<Skill | null>
  updateSkill: (id: string, data: Partial<Skill>) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  toggleSkill: (id: string) => Promise<void>
  setActiveSkills: (ids: string[]) => void
  getActiveSkillsContent: () => string
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  activeSkillIds: [],
  isLoading: false,
  error: null,

  loadSkills: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.skills.list()
      set({ skills: result as Skill[], isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load skills'
      set({ error: message, isLoading: false })
    }
  },

  createSkill: async (data) => {
    try {
      const skill = await api.skills.create({
        name: data.name,
        title: data.title,
        content: data.content
      })
      set((state) => ({ skills: [skill as Skill, ...state.skills] }))
      return skill as Skill
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create skill'
      set({ error: message })
      return null
    }
  },

  updateSkill: async (id, data) => {
    try {
      await api.skills.update(id, data)
      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s))
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update skill'
      set({ error: message })
    }
  },

  deleteSkill: async (id) => {
    try {
      await api.skills.delete(id)
      set((state) => ({
        skills: state.skills.filter((s) => s.id !== id),
        activeSkillIds: state.activeSkillIds.filter((sid) => sid !== id)
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete skill'
      set({ error: message })
    }
  },

  toggleSkill: async (id) => {
    try {
      const newEnabled = await api.skills.toggle(id)
      set((state) => ({
        skills: state.skills.map((s) =>
          s.id === id ? { ...s, isEnabled: newEnabled, updatedAt: new Date().toISOString() } : s
        )
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle skill'
      set({ error: message })
    }
  },

  setActiveSkills: (ids) => {
    set({ activeSkillIds: ids })
  },

  getActiveSkillsContent: () => {
    const state = get()
    const activeSkills = state.skills.filter((s) => s.isEnabled && state.activeSkillIds.includes(s.id))
    if (activeSkills.length === 0) return ''
    return activeSkills.map((s) => s.content).join('\n\n---\n\n')
  }
}))
