/**
 * Load Balancing & Failover 状态管理 (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProviderGroup {
  id: string
  name: string
  providerIds: string[]
  strategy: 'round-robin' | 'random' | 'priority' | 'latency'
  isEnabled: boolean
  healthCheckInterval: number // seconds
  maxRetries: number
  timeout: number // ms
}

export interface ProviderHealth {
  providerId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastChecked: number
  avgLatency: number
  successRate: number
  consecutiveFailures: number
}

interface LoadBalanceState {
  groups: ProviderGroup[]
  health: Record<string, ProviderHealth>
  currentIndex: Record<string, number>

  createGroup: (group: Omit<ProviderGroup, 'id'>) => void
  updateGroup: (id: string, data: Partial<ProviderGroup>) => void
  deleteGroup: (id: string) => void
  selectProvider: (groupId: string) => string | null
  updateHealth: (providerId: string, health: Partial<ProviderHealth>) => void
  runHealthCheck: () => Promise<void>
}

function generateId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function getInitialHealth(providerId: string): ProviderHealth {
  return {
    providerId,
    status: 'healthy',
    lastChecked: 0,
    avgLatency: 0,
    successRate: 1,
    consecutiveFailures: 0
  }
}

export const useLoadBalanceStore = create<LoadBalanceState>()(
  persist(
    (set, get) => ({
      groups: [],
      health: {},
      currentIndex: {},

      createGroup: (group) => {
        const id = generateId()
        const newGroup: ProviderGroup = { ...group, id }
        set((state) => {
          const healthUpdate: Record<string, ProviderHealth> = {}
          for (const pid of newGroup.providerIds) {
            if (!state.health[pid]) {
              healthUpdate[pid] = getInitialHealth(pid)
            }
          }
          return {
            groups: [...state.groups, newGroup],
            health: { ...state.health, ...healthUpdate },
            currentIndex: { ...state.currentIndex, [id]: 0 }
          }
        })
      },

      updateGroup: (id, data) => {
        set((state) => {
          const updatedGroups = state.groups.map((g) => (g.id === id ? { ...g, ...data } : g))
          const group = updatedGroups.find((g) => g.id === id)
          const healthUpdate: Record<string, ProviderHealth> = {}
          if (group) {
            for (const pid of group.providerIds) {
              if (!state.health[pid]) {
                healthUpdate[pid] = getInitialHealth(pid)
              }
            }
          }
          return {
            groups: updatedGroups,
            health: { ...state.health, ...healthUpdate }
          }
        })
      },

      deleteGroup: (id) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          currentIndex: Object.fromEntries(Object.entries(state.currentIndex).filter(([k]) => k !== id))
        }))
      },

      selectProvider: (groupId) => {
        const state = get()
        const group = state.groups.find((g) => g.id === groupId)
        if (!group || !group.isEnabled || group.providerIds.length === 0) {
          return null
        }

        const healthyIds = group.providerIds.filter((pid) => {
          const h = state.health[pid]
          return !h || h.status !== 'unhealthy'
        })

        const candidates = healthyIds.length > 0 ? healthyIds : group.providerIds
        if (candidates.length === 0) return null

        switch (group.strategy) {
          case 'round-robin': {
            const idx = state.currentIndex[groupId] || 0
            const selected = candidates[idx % candidates.length]
            set((s) => ({
              currentIndex: {
                ...s.currentIndex,
                [groupId]: (idx + 1) % candidates.length
              }
            }))
            return selected
          }
          case 'random': {
            return candidates[Math.floor(Math.random() * candidates.length)]
          }
          case 'priority': {
            return candidates[0]
          }
          case 'latency': {
            return candidates.reduce((best, pid) => {
              const bestHealth = state.health[best]
              const pidHealth = state.health[pid]
              const bestLatency = bestHealth?.avgLatency || Infinity
              const pidLatency = pidHealth?.avgLatency || Infinity
              return pidLatency < bestLatency ? pid : best
            }, candidates[0])
          }
          default:
            return candidates[0]
        }
      },

      updateHealth: (providerId, health) => {
        set((state) => {
          const existing = state.health[providerId] || getInitialHealth(providerId)
          return {
            health: {
              ...state.health,
              [providerId]: { ...existing, ...health, providerId }
            }
          }
        })
      },

      runHealthCheck: async () => {
        const state = get()
        const now = Date.now()
        for (const group of state.groups) {
          if (!group.isEnabled) continue
          for (const pid of group.providerIds) {
            const existing = state.health[pid] || getInitialHealth(pid)
            // Simulate a simple health check; in real implementation this would call the provider
            const _isHealthy = existing.consecutiveFailures < group.maxRetries
            const status: ProviderHealth['status'] =
              existing.consecutiveFailures >= group.maxRetries
                ? 'unhealthy'
                : existing.consecutiveFailures > 0
                  ? 'degraded'
                  : 'healthy'
            set((s) => ({
              health: {
                ...s.health,
                [pid]: {
                  ...existing,
                  lastChecked: now,
                  status
                  // Keep avgLatency and successRate as-is in simulation
                }
              }
            }))
          }
        }
      }
    }),
    {
      name: 'cherrystudio-loadbalance',
      partialize: (state) => ({
        groups: state.groups,
        currentIndex: state.currentIndex,
        health: state.health
      })
    }
  )
)

/**
 * Resolve a provider ID considering load balance groups.
 * If the provider is part of an enabled group, returns the group-selected provider.
 * Otherwise returns the original providerId.
 */
export function resolveProviderId(providerId: string | undefined): string | undefined {
  if (!providerId) return providerId
  const { groups, selectProvider } = useLoadBalanceStore.getState()
  const group = groups.find((g) => g.isEnabled && g.providerIds.includes(providerId))
  if (!group) return providerId
  const resolved = selectProvider(group.id)
  return resolved || providerId
}

/**
 * Get the next fallback provider within the same group.
 * Returns null if no other candidate is available.
 */
export function getFallbackProviderId(providerId: string | undefined): string | null {
  if (!providerId) return null
  const { groups, health } = useLoadBalanceStore.getState()
  const group = groups.find((g) => g.isEnabled && g.providerIds.includes(providerId))
  if (!group) return null
  const others = group.providerIds.filter((pid) => pid !== providerId)
  const healthyOthers = others.filter((pid) => {
    const h = health[pid]
    return !h || h.status !== 'unhealthy'
  })
  const candidates = healthyOthers.length > 0 ? healthyOthers : others
  if (candidates.length === 0) return null
  return candidates[0]
}
