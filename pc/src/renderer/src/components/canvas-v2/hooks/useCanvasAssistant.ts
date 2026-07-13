/**
 * useCanvasAssistant.ts - 画布助手 Hook
 * 管理助手对话、处理 AI 流式响应、解析工具调用并应用到画布
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import type { CanvasConnection, CanvasNode } from '../types'
import type { CanvasAgentOp } from '../utils/canvas-agent-ops'
import { applyCanvasAgentOps, createSnapshot } from '../utils/canvas-agent-ops'
import { CANVAS_TOOLS, getToolDefinition, getToolDefinitions } from '../utils/canvas-tools'

const api = (
  window as unknown as {
    api: {
      chat: {
        send: (req: unknown) => Promise<{ messageId: string; content: string; error?: string }>
        onStream: (cb: (event: unknown, data: unknown) => void) => () => void
        cancel: () => Promise<{ cancelled: boolean }>
      }
    }
  }
).api

// ---- Types ----

export interface CanvasAssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: CanvasAssistantToolCall[]
  timestamp: number
}

export interface CanvasAssistantToolCall {
  id: string
  name: string
  params: Record<string, unknown>
  result?: { success: boolean; ops: CanvasAgentOp[] }
}

export interface CanvasAssistantSession {
  id: string
  messages: CanvasAssistantMessage[]
}

// ---- System Prompt Builder ----

function buildSystemPrompt(nodes: CanvasNode[], connections: CanvasConnection[]): string {
  const nodeList = nodes
    .map(
      (n) =>
        `- [${n.id}] type="${n.type}" title="${n.title}" pos=(${Math.round(n.position.x)},${Math.round(n.position.y)}) size=${n.width || 0}x${n.height || 0}`
    )
    .join('\n')

  const connList = connections.map((c) => `- [${c.id}] ${c.fromNodeId} → ${c.toNodeId}`).join('\n')

  const toolDesc = CANVAS_TOOLS.map(
    (t) =>
      `- **${t.name}**: ${t.description}${t.requiresConfirmation ? i18n.t('canvas.assistant.requiresConfirmation') : ''}`
  ).join('\n')

  return `你是聚合创作引擎（Juhe Studio）的画布创作助手。你帮助用户在无限画布上进行 AI 创作和编辑。

## 当前画布状态
- 节点数: ${nodes.length}
- 连接数: ${connections.length}

### 节点列表
${nodeList || '(空)'}

### 连接列表
${connList || '(空)'}

## 可用工具
你必须在回复中使用 \`\`\`tool_call 代码块来执行画布操作。每个代码块包含一个 JSON 数组，每项是一个工具调用：

\`\`\`tool_call
[
  { "name": "tool_name", "params": { ... } }
]
\`\`\`

可用工具：
${toolDesc}

## 行为准则
1. 用中文回复用户，语气友好专业
2. 用户请求涉及画布操作时，输出对应的 tool_call 块
3. 创建节点时使用合理的默认位置（x: 300-800, y: 100-500），避免重叠
4. 每次回复可以包含多个 tool_call 块，但每个块单独处理
5. 如果需要创建多个节点，尽量在同一个 tool_call 块中完成
6. 创建文生图流程时，先创建 text 节点（提示词），再创建 config 节点（生成配置），最后用 connect_nodes 连接
7. 生成图片/视频前确认 config 节点有有效提示词
8. 节点类型约束：text→config (有效), image→video/comfy (有效), 不要创建非法连接`
}

// ---- Content Extraction from Stream ----

function extractTextContent(delta: unknown): string | undefined {
  if (typeof delta === 'string') return delta
  if (delta && typeof delta === 'object' && 'textDelta' in (delta as Record<string, unknown>)) {
    return (delta as Record<string, unknown>).textDelta as string
  }
  return undefined
}

// ---- Tool Call Parser ----

const TOOL_CALL_REGEX = /```tool_call\s*\n([\s\S]*?)```/g

function parseToolCalls(text: string): Array<{ name: string; params: Record<string, unknown> }> {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = []
  let match
  // biome-ignore lint/suspicious/noAssignInExpressions: ignored using `--suppress`
  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.name && item.params) {
            calls.push({ name: item.name, params: item.params })
          }
        }
      } else if (parsed.name && parsed.params) {
        calls.push({ name: parsed.name, params: parsed.params })
      }
    } catch {
      // Skip invalid JSON
    }
  }
  return calls
}

function removeToolCallBlocks(text: string): string {
  return text.replace(TOOL_CALL_REGEX, '').trim()
}

// ---- Hook ----

export function useCanvasAssistant(
  nodes: CanvasNode[],
  connections: CanvasConnection[],
  onNodesChange: (nodes: CanvasNode[]) => void,
  onConnectionsChange: (connections: CanvasConnection[]) => void,
  onSelectionChange: (ids: string[]) => void,
  providerId: string,
  modelId: string
) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<CanvasAssistantMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string>('')
  const aborterRef = useRef<AbortController | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  // Initialize session
  useEffect(() => {
    sessionIdRef.current = `canvas-assistant-${Date.now()}`
    return () => {
      unsubRef.current?.()
    }
  }, [])

  // Builds tool definitions for the LLM
  const _toolDefinitions = getToolDefinitions()

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!providerId || !modelId) {
        setError(t('canvas.assistant.configureProvider'))
        return
      }

      if (!content.trim() || isThinking) return

      const userMsg: CanvasAssistantMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content,
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, userMsg])
      setIsThinking(true)
      setStreamingContent('')
      setError(null)

      const aborter = new AbortController()
      aborterRef.current = aborter

      // Register stream listener
      if (unsubRef.current) unsubRef.current()
      unsubRef.current = api.chat.onStream((_event, data) => {
        const text = extractTextContent(data)
        if (text) {
          setStreamingContent((prev) => prev + text)
        }
      })

      try {
        const systemPrompt = buildSystemPrompt(nodes, connections)

        await api.chat.send({
          sessionId: sessionIdRef.current,
          content,
          providerId,
          modelId,
          systemPrompt
          // Note: tools are defined in the system prompt as structured text,
          // not as OpenAI tool calling format, for broader model compatibility
        })

        // After stream ends, process final content
        setStreamingContent((finalContent) => {
          if (!finalContent) return finalContent

          // Parse tool calls from final content
          const toolCallDefs = parseToolCalls(finalContent)
          const cleanContent = removeToolCallBlocks(finalContent) || t('canvas.assistant.operationDone')

          const toolCalls: CanvasAssistantToolCall[] = []
          if (toolCallDefs.length > 0) {
            // Resolve tool calls to ops
            const ops: CanvasAgentOp[] = []
            for (const tc of toolCallDefs) {
              const tool = getToolDefinition(tc.name)
              if (tool) {
                try {
                  const toolOps = tool.toOps(tc.params)
                  ops.push(...toolOps)
                  toolCalls.push({
                    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: tc.name,
                    params: tc.params,
                    result: { success: true, ops: toolOps }
                  })
                } catch {
                  toolCalls.push({
                    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: tc.name,
                    params: tc.params,
                    result: { success: false, ops: [] }
                  })
                }
              }
            }

            // Apply ops to canvas
            if (ops.length > 0) {
              const snapshot = createSnapshot(nodes, connections)
              const newSnapshot = applyCanvasAgentOps(snapshot, ops)

              // Filter out transient ops
              const realOps = ops.filter((op) => op.action !== 'select_nodes' && op.action !== 'set_viewport')

              if (realOps.length > 0) {
                onNodesChange(newSnapshot.nodes)
                onConnectionsChange(newSnapshot.connections)
              }

              // Handle selection ops
              for (const op of ops) {
                if (op.action === 'select_nodes') {
                  onSelectionChange((op.params.ids as string[]) || [])
                }
              }
            }
          }

          const assistantMsg: CanvasAssistantMessage = {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: cleanContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            timestamp: Date.now()
          }

          setMessages((prev) => [...prev, assistantMsg])
          return ''
        })

        setIsThinking(false)
        setStreamingContent('')
      } catch (err) {
        const message = err instanceof Error ? err.message : t('canvas.assistant.sendFailed')
        if (err instanceof Error && err.name === 'AbortError') {
          setIsThinking(false)
          setStreamingContent('')
          return
        }

        setError(message)
        setIsThinking(false)
        setStreamingContent('')

        const errorMsg: CanvasAssistantMessage = {
          id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'system',
          content: `错误: ${message}`,
          timestamp: Date.now()
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        aborterRef.current = null
      }
    },
    [nodes, connections, providerId, modelId, isThinking, onNodesChange, onConnectionsChange, onSelectionChange, t]
  )

  // Stop generation
  const stopGeneration = useCallback(() => {
    aborterRef.current?.abort()
    api.chat.cancel().catch(() => {})
    setIsThinking(false)
    setStreamingContent('')

    // Save partial content as message
    setStreamingContent((current) => {
      if (!current) return current
      const partialMsg: CanvasAssistantMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: current,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, partialMsg])
      return ''
    })
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setStreamingContent('')
    sessionIdRef.current = `canvas-assistant-${Date.now()}`
  }, [])

  // Quick actions
  const quickAction = useCallback(
    (action: string) => {
      const prompts: Record<string, string> = {
        text2img: '创建一个文生图工作流，图片内容是一只在花丛中飞舞的蝴蝶，风格唯美油画，尺寸 1024x1024',
        text: '在画布上添加一个文本节点，内容是关于 AI 创作的简介',
        layout: '帮我整理画布上的节点，将它们排列整齐，间距约 200px'
      }
      const prompt = prompts[action] || action
      sendMessage(prompt)
    },
    [sendMessage]
  )

  return {
    messages,
    isThinking,
    streamingContent,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    quickAction
  }
}
