import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ResearchRound {
  round: number
  query: string
  findings: string
  sources: string[]
}

export interface ResearchTask {
  id: string
  topic: string
  status: 'idle' | 'researching' | 'completed' | 'failed'
  rounds: ResearchRound[]
  finalReport: string
  createdAt: number
  completedAt?: number
}

interface ResearchState {
  tasks: ResearchTask[]
  activeTaskId: string | null
  error: string | null
  createTask: (topic: string) => string
  addRound: (taskId: string, round: ResearchRound) => void
  setFinalReport: (taskId: string, report: string) => void
  setStatus: (taskId: string, status: ResearchTask['status']) => void
  deleteTask: (id: string) => void
  getActiveTask: () => ResearchTask | null
  setActiveTaskId: (id: string | null) => void
}

export const useResearchStore = create<ResearchState>()(
  persist(
    (set, get) => ({
      tasks: [],
      error: null,
      activeTaskId: null,

      createTask: (topic: string) => {
        const id = crypto.randomUUID()
        const task: ResearchTask = {
          id,
          topic,
          status: 'idle',
          rounds: [],
          finalReport: '',
          createdAt: Date.now()
        }
        set((state) => ({
          tasks: [task, ...state.tasks],
          activeTaskId: id
        }))
        return id
      },

      addRound: (taskId: string, round: ResearchRound) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, rounds: [...t.rounds, round] } : t))
        }))
      },

      setFinalReport: (taskId: string, report: string) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, finalReport: report, status: 'completed', completedAt: Date.now() } : t
          )
        }))
      },

      setStatus: (taskId: string, status: ResearchTask['status']) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status } : t))
        }))
      },

      deleteTask: (id: string) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          activeTaskId:
            state.activeTaskId === id ? (state.tasks.find((t) => t.id !== id)?.id ?? null) : state.activeTaskId
        }))
      },

      getActiveTask: () => {
        const { activeTaskId, tasks } = get()
        return tasks.find((t) => t.id === activeTaskId) || null
      },

      setActiveTaskId: (id: string | null) => {
        set({ activeTaskId: id })
      }
    }),
    {
      name: 'cherrystudio-research',
      partialize: (state) => ({
        tasks: state.tasks,
        activeTaskId: state.activeTaskId
      })
    }
  )
)
