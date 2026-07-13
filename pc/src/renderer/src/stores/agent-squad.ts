/**
 * Multi-Agent Collaboration Squad Store (Zustand + persist)
 * Orchestrates real LLM calls for sequential / parallel / debate / hierarchical writing workflows.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { error as toastError } from '@/components/ui/toast'
import type { Agent } from './agents'
import { getAllAgents, useAgentsStore } from './agents'
import { useProviderStore } from './providers'

export type SquadMode = 'sequential' | 'parallel' | 'debate' | 'hierarchical'
export type SquadResultStatus = 'streaming' | 'done' | 'error'

export interface SquadAgent {
  agentId: string
  order?: number
  role?: string
  providerId?: string
  modelId?: string
  temperature?: number
}

export interface AgentSquad {
  id: string
  name: string
  description: string
  mode: SquadMode
  agents: SquadAgent[]
  sharedContext: boolean
  createdAt: number
}

export const PRESET_SQUADS: Omit<AgentSquad, 'id' | 'createdAt'>[] = [
  {
    name: 'agentSquad.presets.productLaunch.name',
    description: 'agentSquad.presets.productLaunch.description',
    mode: 'hierarchical',
    sharedContext: true,
    agents: [
      { agentId: 'preset-product-manager', order: 1, role: '定义目标与范围' },
      { agentId: 'preset-market-strategist', order: 2, role: '分析市场与定位' },
      { agentId: 'preset-brand-copywriter', order: 3, role: '输出文案与传播点' },
      { agentId: 'preset-critical-reviewer', order: 4, role: '审查风险与漏洞' }
    ]
  },
  {
    name: 'agentSquad.presets.research.name',
    description: 'agentSquad.presets.research.description',
    mode: 'sequential',
    sharedContext: true,
    agents: [
      { agentId: 'preset-academic-researcher', order: 1, role: '收集资料与框架' },
      { agentId: 'preset-data-analyst', order: 2, role: '提炼结构化结论' },
      { agentId: 'preset-critical-reviewer', order: 3, role: '检查论证缺口' }
    ]
  },
  {
    name: 'agentSquad.presets.content.name',
    description: 'agentSquad.presets.content.description',
    mode: 'parallel',
    sharedContext: true,
    agents: [
      { agentId: 'preset-brand-copywriter', role: '写作', temperature: 0.8 },
      { agentId: 'preset-visual-designer', role: '视觉', temperature: 0.7 },
      { agentId: 'preset-prompt-engineer', role: '提示词', temperature: 0.4 }
    ]
  },
  {
    name: 'agentSquad.presets.solution.name',
    description: 'agentSquad.presets.solution.description',
    mode: 'debate',
    sharedContext: true,
    agents: [
      { agentId: 'preset-code-expert', role: '技术方案' },
      { agentId: 'preset-product-manager', role: '产品约束' },
      { agentId: 'preset-critical-reviewer', role: '反方视角' },
      { agentId: 'preset-project-planner', role: '执行路径' }
    ]
  }
]

export type SquadToolEventStatus = 'calling' | 'success' | 'error'

export interface SquadToolEvent {
  type: 'tool-call' | 'tool-result'
  toolName: string
  serverId: string
  status: SquadToolEventStatus
  args?: unknown
  result?: unknown
  error?: string
}

export interface SquadResult {
  agentId: string
  agentName: string
  output: string
  timestamp: number
  status: SquadResultStatus
  error?: string
  toolEvents?: SquadToolEvent[]
}

interface SquadStreamEvent {
  taskId: string
  type:
    | 'text-delta'
    | 'tool-call'
    | 'tool-result'
    | 'agent-start'
    | 'agent-done'
    | 'synthesis-start'
    | 'synthesis-done'
    | 'done'
    | 'error'
  agentId?: string
  agentName?: string
  textDelta?: string
  toolCall?: { toolName: string; args: unknown }
  toolResult?: { toolName: string; result: unknown }
  content?: string
  error?: string
}

interface AgentSquadState {
  squads: AgentSquad[]
  activeSquadId: string | null
  isRunning: boolean
  currentStep: number
  totalSteps: number
  results: SquadResult[]
  finalOutput: string
  error: string | null
  enableMcpTools: boolean
  currentTaskId: string | null
  createSquad: (data: Omit<AgentSquad, 'id' | 'createdAt'>) => void
  updateSquad: (id: string, data: Partial<AgentSquad>) => void
  deleteSquad: (id: string) => void
  setActiveSquad: (id: string | null) => void
  runSquad: (squadId: string, input: string) => Promise<void>
  cancelRun: () => void
  resetResults: () => void
  setEnableMcpTools: (enabled: boolean) => void
  setCurrentStep: (step: number) => void
  setIsRunning: (running: boolean) => void
}

const api = (
  window as unknown as {
    api: {
      agentSquad: {
        run: (req: {
          taskId: string
          mode: SquadMode
          input: string
          agents: Array<{
            agentId: string
            agentName: string
            systemPrompt: string
            providerId: string
            modelId: string
            temperature?: number
            role?: string
          }>
          sharedContext: boolean
          enableMcpTools: boolean
        }) => Promise<{ taskId: string; started: boolean }>
        cancel: (taskId: string) => Promise<{ cancelled: boolean }>
        onStream: (cb: (event: unknown, data: SquadStreamEvent) => void) => () => void
      }
    }
  }
).api

// ---- Module-level stream listener ----
let researchListenerCleanup: (() => void) | null = null

function ensureAgentSquadListener() {
  if (researchListenerCleanup) return
  researchListenerCleanup = api.agentSquad.onStream((_event, data) => {
    useAgentSquadStore.setState((state) => {
      if (state.currentTaskId && data.taskId !== state.currentTaskId) return state

      switch (data.type) {
        case 'agent-start': {
          const exists = state.results.some((r) => r.agentId === data.agentId)
          if (exists) return state
          return {
            results: [
              ...state.results,
              {
                agentId: data.agentId as string,
                agentName: data.agentName as string,
                output: '',
                timestamp: Date.now(),
                status: 'streaming',
                toolEvents: []
              }
            ]
          }
        }
        case 'text-delta': {
          return {
            results: state.results.map((r) =>
              r.agentId === data.agentId ? { ...r, output: r.output + (data.textDelta || '') } : r
            )
          }
        }
        case 'tool-call': {
          const toolName = (data.toolCall?.toolName as string) || ''
          const serverId = toolName.includes('__') ? toolName.split('__')[0] : 'mcp'
          return {
            results: state.results.map((r) =>
              r.agentId === data.agentId
                ? {
                    ...r,
                    toolEvents: [
                      ...(r.toolEvents || []),
                      {
                        type: 'tool-call',
                        toolName,
                        serverId,
                        status: 'calling' as SquadToolEventStatus,
                        args: data.toolCall?.args
                      }
                    ]
                  }
                : r
            )
          }
        }
        case 'tool-result': {
          const resultToolName = (data.toolResult?.toolName as string) || ''
          return {
            results: state.results.map((r) =>
              r.agentId === data.agentId
                ? {
                    ...r,
                    toolEvents:
                      r.toolEvents?.map((ev, idx) => {
                        if (
                          idx === (r.toolEvents?.length ?? 0) - 1 &&
                          ev.toolName === resultToolName &&
                          ev.status === 'calling'
                        ) {
                          const result = data.toolResult?.result
                          const isError = typeof result === 'string' && result.startsWith('Error:')
                          return {
                            ...ev,
                            type: 'tool-result',
                            status: isError ? ('error' as SquadToolEventStatus) : ('success' as SquadToolEventStatus),
                            result: isError ? undefined : result,
                            error: isError ? result : undefined
                          }
                        }
                        return ev
                      }) || []
                  }
                : r
            )
          }
        }
        case 'agent-done': {
          return {
            results: state.results.map((r) =>
              r.agentId === data.agentId ? { ...r, status: 'done', output: data.content || r.output } : r
            )
          }
        }
        case 'synthesis-start': {
          return {
            results: [
              ...state.results,
              {
                agentId: 'synthesis',
                agentName: 'Synthesis',
                output: '',
                timestamp: Date.now(),
                status: 'streaming',
                toolEvents: []
              }
            ]
          }
        }
        case 'synthesis-done': {
          return {
            results: state.results.map((r) =>
              r.agentId === 'synthesis' ? { ...r, status: 'done', output: data.content || r.output } : r
            ),
            finalOutput: data.content || state.finalOutput
          }
        }
        case 'done': {
          return { isRunning: false, currentTaskId: null }
        }
        case 'error': {
          toastError({ description: data.error || 'Agent squad execution failed' })
          return { error: data.error || 'Execution failed', isRunning: false, currentTaskId: null }
        }
        default:
          return state
      }
    })
  })
}

function resolveAgentConfig(
  agent: Agent,
  squadAgent: SquadAgent
): { providerId: string; modelId: string; temperature?: number } | null {
  const providers = useProviderStore.getState().providers
  let providerId = squadAgent.providerId || agent.providerId
  let modelId = squadAgent.modelId || agent.modelId
  const temperature = squadAgent.temperature ?? agent.temperature

  if (!providerId || !modelId) {
    const fallbackProvider = providers.find((p) => p.isEnabled && p.models.some((m) => m.isEnabled))
    if (!fallbackProvider) return null
    providerId = fallbackProvider.id
    modelId = fallbackProvider.models.find((m) => m.isEnabled)?.name
    if (!modelId) return null
  }

  const targetProvider = providers.find((p) => p.id === providerId)
  const targetModel = targetProvider?.models.find((m) => m.name === modelId || m.id === modelId)
  if (targetProvider && !targetModel?.isEnabled) {
    const enabledModel = targetProvider.models.find((m) => m.isEnabled)
    if (enabledModel) modelId = enabledModel.name
  }

  return { providerId, modelId: modelId as string, temperature }
}

export const useAgentSquadStore = create<AgentSquadState>()(
  persist(
    (set, get) => ({
      squads: [],
      activeSquadId: null,
      isRunning: false,
      currentStep: 0,
      totalSteps: 0,
      results: [],
      finalOutput: '',
      error: null,
      enableMcpTools: false,
      currentTaskId: null,

      createSquad: (data) => {
        const squad: AgentSquad = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: Date.now()
        }
        set((state) => ({
          squads: [squad, ...state.squads],
          activeSquadId: squad.id
        }))
      },

      updateSquad: (id, data) => {
        set((state) => ({
          squads: state.squads.map((s) => (s.id === id ? { ...s, ...data } : s))
        }))
      },

      deleteSquad: (id) => {
        set((state) => ({
          squads: state.squads.filter((s) => s.id !== id),
          activeSquadId: state.activeSquadId === id ? null : state.activeSquadId
        }))
      },

      setActiveSquad: (id) => {
        set({ activeSquadId: id })
      },

      runSquad: async (squadId, input) => {
        if (get().isRunning) return
        set({ isRunning: true })
        const agentsStore = useAgentsStore.getState()
        const providersStore = useProviderStore.getState()

        if (providersStore.providers.length === 0) {
          await providersStore.loadProviders()
        }
        if (useProviderStore.getState().providers.length === 0) {
          set({ error: 'No providers configured. Please add an API provider first.', isRunning: false })
          toastError({ description: 'No providers configured. Please add an API provider first.' })
          return
        }

        const squad = get().squads.find((s) => s.id === squadId)
        if (!squad || squad.agents.length === 0) {
          set({ isRunning: false })
          return
        }

        const allAgents = getAllAgents(agentsStore.agents)
        const sortedAgents =
          squad.mode === 'sequential' ? [...squad.agents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : squad.agents

        const agentConfigs = sortedAgents
          .map((squadAgent) => {
            const agent = allAgents.find((a) => a.id === squadAgent.agentId)
            if (!agent) return null
            const resolved = resolveAgentConfig(agent, squadAgent)
            if (!resolved) return null
            return {
              agentId: agent.id,
              agentName: agent.name,
              systemPrompt: agent.systemPrompt || 'You are a helpful assistant.',
              providerId: resolved.providerId,
              modelId: resolved.modelId,
              temperature: resolved.temperature,
              role: squadAgent.role
            }
          })
          .filter(Boolean) as Array<{
          agentId: string
          agentName: string
          systemPrompt: string
          providerId: string
          modelId: string
          temperature?: number
          role?: string
        }>

        if (agentConfigs.length === 0) {
          set({ error: 'No agents with usable provider/model.', isRunning: false })
          toastError({ description: 'No agents with usable provider/model.' })
          return
        }

        const taskId = `squad-${squad.id}-${Date.now()}`
        ensureAgentSquadListener()

        set({
          currentStep: 0,
          totalSteps: agentConfigs.length + 1,
          results: [],
          finalOutput: '',
          error: null,
          currentTaskId: taskId
        })

        try {
          await api.agentSquad.run({
            taskId,
            mode: squad.mode,
            input,
            agents: agentConfigs,
            sharedContext: squad.sharedContext,
            enableMcpTools: get().enableMcpTools
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          set({ error: message, isRunning: false, currentTaskId: null })
          toastError({ description: message })
        }
      },

      cancelRun: async () => {
        const { currentTaskId } = get()
        if (currentTaskId) {
          await api.agentSquad.cancel(currentTaskId).catch(() => undefined)
        }
        set({ isRunning: false, currentTaskId: null })
      },

      resetResults: () => {
        set({ results: [], currentStep: 0, isRunning: false, finalOutput: '', error: null, currentTaskId: null })
      },

      setEnableMcpTools: (enabled) => {
        set({ enableMcpTools: enabled })
      },

      setCurrentStep: (step) => {
        set({ currentStep: step })
      },

      setIsRunning: (running) => {
        set({ isRunning: running })
      }
    }),
    {
      name: 'cherrystudio-agent-squads',
      partialize: (state) => ({
        squads: state.squads,
        activeSquadId: state.activeSquadId,
        enableMcpTools: state.enableMcpTools
      })
    }
  )
)
