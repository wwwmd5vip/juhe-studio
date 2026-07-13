/**
 * Agent Squad Executor (main process)
 * Runs multi-agent writing workflows with optional MCP tool support.
 */

import { dynamicTool, jsonSchema } from '@ai-sdk/provider-utils'
import type { StreamTextParams } from '@cherrystudio/ai-core'
import { streamText } from '@cherrystudio/ai-core'
import { resolveProvider } from '@main/utils/provider-resolver'
import { callTool, listTools, type McpToolInfo } from './mcp'

/** Maximum characters per agent output in context accumulation to prevent context overflow */
const MAX_OUTPUT_CONTEXT_CHARS = 8000

/** Truncate a string to maxLen characters, appending an ellipsis marker if truncated */
function truncateOutput(text: string, maxLen: number = MAX_OUTPUT_CONTEXT_CHARS): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '\n\n[... output truncated ...]'
}

export interface SquadAgentConfig {
  agentId: string
  agentName: string
  systemPrompt: string
  providerId: string
  modelId: string
  temperature?: number
  role?: string
}

export interface SquadRunRequest {
  taskId: string
  mode: 'sequential' | 'parallel' | 'debate' | 'hierarchical'
  input: string
  agents: SquadAgentConfig[]
  sharedContext: boolean
  enableMcpTools: boolean
}

export interface SquadStreamEvent {
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

let mainWindow: Electron.BrowserWindow | null = null

export function setAgentSquadMainWindow(win: Electron.BrowserWindow) {
  mainWindow = win
}

function pushEvent(event: SquadStreamEvent) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('agent-squad:stream', event)
  }
}

function buildMcpTools(enabledTools: McpToolInfo[]): Record<string, ReturnType<typeof dynamicTool>> {
  const tools: Record<string, ReturnType<typeof dynamicTool>> = {}
  for (const t of enabledTools) {
    const toolName = `${t.serverId}__${t.name}`
    const inputSchema = (t.inputSchema || { type: 'object', properties: {} }) as Record<string, unknown>
    tools[toolName] = dynamicTool({
      description: t.description || `MCP tool ${t.name} from ${t.serverName}`,
      inputSchema: jsonSchema(inputSchema),
      execute: async (args: unknown) => {
        const result = await callTool(t.serverId, t.name, args)
        return result
      }
    })
  }
  return tools
}

async function runAgent(
  taskId: string,
  agent: SquadAgentConfig,
  prompt: string,
  enableMcpTools: boolean,
  abortSignal: AbortSignal
): Promise<string> {
  pushEvent({ taskId, type: 'agent-start', agentId: agent.agentId, agentName: agent.agentName })

  const resolved = await resolveProvider(agent.providerId)
  const settings = { apiKey: resolved.apiKey, baseURL: resolved.baseURL }

  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: agent.systemPrompt || 'You are a helpful assistant.' },
    { role: 'user', content: prompt }
  ]

  const streamParams: StreamTextParams = {
    model: agent.modelId,
    messages,
    maxRetries: 0,
    abortSignal
  }
  if (typeof agent.temperature === 'number') {
    streamParams.temperature = agent.temperature
  }

  // eslint-disable-next-line no-useless-assignment
  let enabledMcpTools: McpToolInfo[] = []
  if (enableMcpTools) {
    enabledMcpTools = await listTools()
    if (enabledMcpTools.length > 0) {
      streamParams.tools = buildMcpTools(enabledMcpTools) as never
      streamParams.stopWhen = ({ steps }) => {
        const last = steps[steps.length - 1]
        return !last || (last.finishReason !== 'tool-calls' && last.finishReason !== 'error') || steps.length >= 5
      }
    }
  }

  const result = await streamText(
    resolved.providerId as Parameters<typeof streamText>[0],
    settings as never,
    streamParams
  )

  let fullText = ''

  try {
    for await (const chunk of result.fullStream) {
      if (abortSignal.aborted) {
        throw new Error('Aborted')
      }
      if (chunk.type === 'text-delta') {
        fullText += chunk.text
        pushEvent({
          taskId,
          type: 'text-delta',
          agentId: agent.agentId,
          agentName: agent.agentName,
          textDelta: chunk.text
        })
      } else if (chunk.type === 'tool-call') {
        pushEvent({
          taskId,
          type: 'tool-call',
          agentId: agent.agentId,
          agentName: agent.agentName,
          toolCall: { toolName: chunk.toolName, args: (chunk as { input?: unknown }).input }
        })
      } else if (chunk.type === 'tool-result') {
        pushEvent({
          taskId,
          type: 'tool-result',
          agentId: agent.agentId,
          agentName: agent.agentName,
          toolResult: { toolName: chunk.toolName, result: (chunk as { output?: unknown }).output }
        })
      } else if (chunk.type === 'error') {
        const errorChunk = chunk as unknown as { error: Error }
        throw errorChunk.error
      }
    }
  } catch (err) {
    const isAborted = err instanceof Error && (err.name === 'AbortError' || err.message === 'Aborted')
    if (!isAborted) {
      throw err
    }
  }

  pushEvent({ taskId, type: 'agent-done', agentId: agent.agentId, agentName: agent.agentName, content: fullText })
  return fullText
}

function buildPrompt(
  mode: SquadRunRequest['mode'],
  agent: SquadAgentConfig,
  input: string,
  previousOutputs: Array<{ agentId: string; agentName: string; output: string }>,
  isManager: boolean
): string {
  const roleHint = agent.role || agent.agentName

  switch (mode) {
    case 'sequential': {
      const context = previousOutputs.map((r) => `### Contribution from ${r.agentName}\n${truncateOutput(r.output)}`).join('\n\n')
      const shared =
        previousOutputs.length > 0 ? `\n\nHere are the previous contributions for context:\n\n${context}` : ''
      return `Task:\n${input}${shared}\n\nYour role: ${roleHint}\n\nPlease continue the work based on the task and any previous contributions. Output only your contribution.`
    }
    case 'parallel': {
      return `Task:\n${input}\n\nYour role: ${roleHint}\n\nPlease work on this task from your specific angle. Output only your contribution.`
    }
    case 'debate': {
      const previous = previousOutputs.at(-1)
      const priorContext = previous ? `\n\nPrevious argument to respond to:\n${truncateOutput(previous.output)}` : ''
      return `Topic:\n${input}${priorContext}\n\nYour role: ${roleHint}\n\nPresent your perspective on the topic. Address the previous argument if one is provided. Output only your argument.`
    }
    case 'hierarchical': {
      if (isManager) {
        return `Task:\n${input}\n\nYou are the manager/coordinator. Analyze the task and produce a clear plan that the team can follow. Break the work into sub-tasks and assign them conceptually to the team roles. Output only the plan.`
      }
      const managerOutput = truncateOutput(previousOutputs[0]?.output || '')
      const priorWorkers = previousOutputs.slice(1)
      const workerContext =
        priorWorkers.length > 0
          ? `\n\nSub-task results so far:\n${priorWorkers.map((r) => `### ${r.agentName}\n${truncateOutput(r.output)}`).join('\n\n')}`
          : ''
      return `Original task:\n${input}\n\nManager's plan:\n${managerOutput}${workerContext}\n\nYour role: ${roleHint}\n\nPlease complete your assigned sub-task based on the plan and any prior results. Output only your contribution.`
    }
    default:
      return input
  }
}

async function synthesize(
  taskId: string,
  input: string,
  outputs: Array<{ agentId: string; agentName: string; output: string }>,
  synthesizer: SquadAgentConfig,
  enableMcpTools: boolean,
  abortSignal: AbortSignal
): Promise<string> {
  pushEvent({ taskId, type: 'synthesis-start' })

  const contributions = outputs.map((r) => `### ${r.agentName}\n${truncateOutput(r.output)}`).join('\n\n')
  const prompt = `Original task:\n${input}\n\nIndividual contributions:\n\n${contributions}\n\nPlease synthesize the above contributions into a single coherent, well-structured final piece of writing. Remove redundancies, resolve contradictions, and ensure smooth flow. Output only the final text.`

  const finalOutput = await runAgent(taskId, synthesizer, prompt, enableMcpTools, abortSignal)
  pushEvent({ taskId, type: 'synthesis-done', content: finalOutput })
  return finalOutput
}

const activeRuns = new Map<string, AbortController>()

export async function runSquadExecution(req: SquadRunRequest): Promise<void> {
  const { taskId, mode, input, agents, enableMcpTools } = req
  if (agents.length === 0) {
    pushEvent({ taskId, type: 'error', error: 'No agents in squad' })
    return
  }

  const abortController = new AbortController()
  activeRuns.set(taskId, abortController)

  try {
    const outputs: Array<{ agentId: string; agentName: string; output: string }> = []
    const sortedAgents = mode === 'sequential' ? [...agents] : agents

    for (let i = 0; i < sortedAgents.length; i++) {
      if (abortController.signal.aborted) break
      const agent = sortedAgents[i]
      const isManager = mode === 'hierarchical' && i === 0
      const prompt = buildPrompt(mode, agent, input, outputs, isManager)
      const output = await runAgent(taskId, agent, prompt, enableMcpTools, abortController.signal)
      outputs.push({ agentId: agent.agentId, agentName: agent.agentName, output })
    }

    if (!abortController.signal.aborted) {
      const synthesizer = agents[0]
      await synthesize(taskId, input, outputs, synthesizer, enableMcpTools, abortController.signal)
    }

    pushEvent({ taskId, type: 'done' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    pushEvent({ taskId, type: 'error', error: message })
  } finally {
    activeRuns.delete(taskId)
  }
}

export function cancelSquadExecution(taskId: string): void {
  const controller = activeRuns.get(taskId)
  if (controller) {
    controller.abort()
    activeRuns.delete(taskId)
  }
}
