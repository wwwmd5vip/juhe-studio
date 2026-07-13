/**
 * API 用量监控状态管理 (Zustand + persist)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UsageRecord {
  id: string
  providerId: string
  providerName: string
  modelId: string
  modelName: string
  type: 'image' | 'video' | 'audio' | 'text'
  tokens?: number
  cost: number // estimated cost in USD
  duration: number // ms
  status: 'success' | 'failed'
  createdAt: number
}

interface UsageState {
  records: UsageRecord[]
  addRecord: (record: Omit<UsageRecord, 'id' | 'createdAt'>) => void
  getTodayUsage: () => { count: number; cost: number }
  getProviderStats: () => Array<{
    providerId: string
    providerName: string
    count: number
    cost: number
    successRate: number
  }>
  getDailyStats: (days: number) => Array<{ date: string; count: number; cost: number }>
  clearRecords: () => void
  reset: () => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getStartOfDay(timestamp: number): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatDateKey(timestamp: number): string {
  const d = new Date(timestamp)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (record) => {
        const newRecord: UsageRecord = {
          ...record,
          id: generateId(),
          createdAt: Date.now()
        }
        set((state) => ({
          records: [newRecord, ...state.records].slice(0, 5000)
        }))
      },

      getTodayUsage: () => {
        const todayStart = getStartOfDay(Date.now())
        const todayRecords = get().records.filter((r) => r.createdAt >= todayStart)
        return {
          count: todayRecords.length,
          cost: todayRecords.reduce((sum, r) => sum + r.cost, 0)
        }
      },

      getProviderStats: () => {
        const map = new Map<
          string,
          { providerId: string; providerName: string; count: number; cost: number; success: number }
        >()

        for (const r of get().records) {
          const entry = map.get(r.providerId)
          if (entry) {
            entry.count += 1
            entry.cost += r.cost
            if (r.status === 'success') entry.success += 1
          } else {
            map.set(r.providerId, {
              providerId: r.providerId,
              providerName: r.providerName,
              count: 1,
              cost: r.cost,
              success: r.status === 'success' ? 1 : 0
            })
          }
        }

        return Array.from(map.values()).map((item) => ({
          ...item,
          successRate: item.count > 0 ? Math.round((item.success / item.count) * 100) : 0
        }))
      },

      getDailyStats: (days: number) => {
        const result: Array<{ date: string; count: number; cost: number }> = []
        const now = Date.now()
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          d.setHours(0, 0, 0, 0)
          const start = d.getTime()
          const end = start + 24 * 60 * 60 * 1000
          const dayRecords = get().records.filter((r) => r.createdAt >= start && r.createdAt < end)
          result.push({
            date: formatDateKey(start),
            count: dayRecords.length,
            cost: dayRecords.reduce((sum, r) => sum + r.cost, 0)
          })
        }
        return result
      },

      clearRecords: () => {
        set({ records: [] })
      },

      reset: () => {
        set({ records: [] })
      }
    }),
    {
      name: 'cherrystudio-usage',
      partialize: (state) => ({ records: state.records })
    }
  )
)
