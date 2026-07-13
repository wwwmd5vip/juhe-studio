/**
 * 聊天状态管理 (Zustand)
 * 1:1 复刻 Cherry Studio 的消息 Block 架构
 */

import {
  type ChatAssistant,
  type ChatMessage,
  type ChatSession,
  type ChatStreamChunk,
  type ErrorMessageBlock,
  type MainTextMessageBlock,
  type MessageBlock,
  MessageBlockStatus,
  MessageBlockType,
  type ThinkingMessageBlock
} from '@shared/types/chat'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { error as toastError } from '@/components/ui/toast'
import { createApiProxy } from '@/utils/api-proxy'
import { useMemoryStore } from './memory'
import { useNetworkStore } from './network'

/** Maximum number of messages retained in memory per session to prevent unbounded growth */
const MAX_MESSAGES = 500

// 防御性代理 — preload 失败时给出清晰错误而非 "can't access property 'X', api is undefined"
const api = createApiProxy()

interface QueuedMessage {
  id: string
  content: string
  providerId: string
  modelId: string
  sessionId: string
}

interface ChatState {
  // 会话列表
  sessions: ChatSession[]
  // 当前活跃会话
  activeSessionId: string | null
  // 当前会话的消息
  messages: ChatMessage[]
  // 是否正在生成回复
  isGenerating: boolean
  // 流式消息的临时内容
  streamingContent: Record<string, string>
  // 流式思考内容
  streamingThinking: Record<string, string>
  // 错误信息
  error: string | null
  // 离线消息队列
  messageQueue: QueuedMessage[]
  // 是否正在自动发送队列
  isSendingQueued: boolean
  // 当前流式请求控制器（用于中断）
  abortController: AbortController | null
  // 聊天助手列表
  assistants: ChatAssistant[]
  // 当前选中的助手 ID
  activeAssistantId: string | null
  // 操作
  loadSessions: () => Promise<void>
  loadAssistants: () => Promise<void>
  createSession: (providerId?: string, modelId?: string, systemPrompt?: string) => Promise<string>
  selectSession: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  updateSessionTitle: (id: string, title: string) => Promise<void>
  selectAssistant: (assistant: ChatAssistant | null) => void
  sendMessage: (
    content: string,
    providerId: string,
    modelId: string,
    attachments?: Array<{ type: string; url: string; name?: string }>
  ) => Promise<void>
  stopGeneration: () => void
  handleStreamChunk: (chunk: ChatStreamChunk) => void
  getActiveSession: () => ChatSession | null
  getActiveSystemPrompt: () => string | undefined
  clearError: () => void
  flushQueue: () => Promise<void>
  regenerateMessage: (messageId: string) => void
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string) => void
  addErrorBlock: (messageId: string, error: { message: string; status?: number; providerId?: string }) => void
  // Block 操作
  updateMessageBlocks: (messageId: string, blocks: MessageBlock[]) => void
  appendToMainTextBlock: (messageId: string, text: string) => void
  createMainTextBlock: (messageId: string, content?: string) => string
  createThinkingBlock: (messageId: string, content?: string) => string
  updateThinkingBlock: (messageId: string, content: string) => void
  reset: () => void
}

// ============ Block 工具函数 ============

function createMainTextBlock(messageId: string, content = ''): MainTextMessageBlock {
  return {
    id: crypto.randomUUID(),
    messageId,
    type: MessageBlockType.MAIN_TEXT,
    status: MessageBlockStatus.STREAMING,
    content,
    createdAt: new Date().toISOString()
  }
}

function createThinkingBlock(messageId: string, content = ''): ThinkingMessageBlock {
  return {
    id: crypto.randomUUID(),
    messageId,
    type: MessageBlockType.THINKING,
    status: MessageBlockStatus.STREAMING,
    content,
    createdAt: new Date().toISOString()
  }
}

function createErrorBlock(
  messageId: string,
  error: { message: string; status?: number; providerId?: string }
): ErrorMessageBlock {
  return {
    id: crypto.randomUUID(),
    messageId,
    type: MessageBlockType.ERROR,
    status: MessageBlockStatus.ERROR,
    error: {
      message: error.message,
      status: error.status,
      providerId: error.providerId
    },
    createdAt: new Date().toISOString()
  }
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      messages: [],
      isGenerating: false,
      streamingContent: {},
      streamingThinking: {},
      error: null,
      messageQueue: [],
      isSendingQueued: false,
      abortController: null,
      assistants: [],
      activeAssistantId: null,

      loadSessions: async () => {
        try {
          const result = await api.chat.listSessions()
          const sessions = result as ChatSession[]
          set({ sessions, error: null })

          // 如果有持久化的 activeSessionId，自动加载该会话的消息
          const { activeSessionId } = get()
          if (activeSessionId) {
            const sessionExists = sessions.some((s) => s.id === activeSessionId)
            if (sessionExists) {
              try {
                const messages = await api.chat.listMessages(activeSessionId)
                set({
                  messages: (messages as ChatMessage[]).map((m) => ({
                    ...m,
                    status: m.status || 'success'
                  })),
                  streamingContent: {},
                  streamingThinking: {}
                })
              } catch (msgErr) {
                console.error('[ChatStore] Failed to load messages for session:', activeSessionId, msgErr)
              }
            } else {
              // 会话已不存在，清除 activeSessionId
              set({ activeSessionId: null, messages: [] })
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load sessions'
          console.error('[ChatStore] Failed to load sessions:', err)
          toastError({ title: 'Chat Error', description: message })
          set({ error: message })
        }
      },

      loadAssistants: async () => {
        try {
          const result = await api.chat.listAssistants()
          const assistants = result as ChatAssistant[]
          set({ assistants })
        } catch (err) {
          console.error('[ChatStore] Failed to load assistants:', err)
        }
      },

      selectAssistant: (assistant) => {
        if (!assistant) {
          set({ activeAssistantId: null })
          return
        }
        set({ activeAssistantId: assistant.id })

        // 更新当前 session 的 provider/model/systemPrompt
        const { activeSessionId, sessions } = get()
        if (activeSessionId && (assistant.providerId || assistant.modelId || assistant.systemPrompt)) {
          const session = sessions.find((s) => s.id === activeSessionId)
          if (session) {
            const updates: Record<string, string> = {}
            if (assistant.providerId) updates.providerId = assistant.providerId
            if (assistant.modelId) updates.modelId = assistant.modelId
            if (assistant.systemPrompt) updates.systemPrompt = assistant.systemPrompt

            api.chat.updateSession(activeSessionId, updates).catch((err) => {
              console.error('[ChatStore] Failed to update session from assistant:', err)
            })
            set((state) => ({
              sessions: state.sessions.map((s) => (s.id === activeSessionId ? { ...s, ...updates } : s))
            }))
          }
        }
      },

      createSession: async (providerId, modelId, systemPrompt) => {
        const result = await api.chat.createSession({ providerId, modelId, systemPrompt })
        const session = {
          id: result.id,
          title: result.title,
          providerId,
          modelId,
          systemPrompt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as ChatSession
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: result.id,
          messages: systemPrompt
            ? [
                {
                  id: crypto.randomUUID(),
                  sessionId: result.id,
                  role: 'system',
                  content: systemPrompt,
                  status: 'success',
                  createdAt: new Date().toISOString()
                }
              ]
            : []
        }))
        return result.id
      },

      selectSession: async (id) => {
        const messages = await api.chat.listMessages(id)
        set({
          activeSessionId: id,
          messages: (messages as ChatMessage[]).map((m) => ({
            ...m,
            status: m.status || 'success'
          })),
          streamingContent: {},
          streamingThinking: {}
        })
      },

      deleteSession: async (id) => {
        await api.chat.deleteSession(id)
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          messages: state.activeSessionId === id ? [] : state.messages,
          messageQueue: state.messageQueue.filter((m) => m.sessionId !== id)
        }))
      },

      updateSessionTitle: async (id, title) => {
        await api.chat.updateSession(id, { title })
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s))
        }))
      },

      sendMessage: async (content, providerId, modelId, attachments) => {
        const { activeSessionId, sessions } = get()
        if (!activeSessionId) {
          set({ error: 'No active session' })
          return
        }

        // 防止并发重复调用
        if (get().isGenerating) return

        // 检查是否需要自动生成会话标题（第一条用户消息时）
        const session = sessions.find((s) => s.id === activeSessionId)
        const messages = get().messages.filter((m) => m.sessionId === activeSessionId)
        const isFirstMessage = messages.length === 0 || (messages.length === 1 && messages[0].role === 'system')
        if (isFirstMessage && session?.title === 'New Chat') {
          // 生成标题：取前 30 个字符
          const title = content.trim().slice(0, 30) + (content.length > 30 ? '...' : '')
          get().updateSessionTitle(activeSessionId, title || 'New Chat')
        }

        // 离线时加入队列
        if (!useNetworkStore.getState().isOnline) {
          const queued: QueuedMessage = {
            id: crypto.randomUUID(),
            content,
            providerId,
            modelId,
            sessionId: activeSessionId
          }
          set((state) => ({
            messageQueue: [...state.messageQueue, queued],
            error: null
          }))
          return
        }

        set({ isGenerating: true, error: null })

        // 创建 AbortController 用于中断生成
        const abortController = new AbortController()
        set({ abortController })

        // 乐观更新：立即显示用户消息
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sessionId: activeSessionId,
          role: 'user',
          content,
          status: 'success',
          attachments: attachments?.map((a) => ({ type: a.type, url: a.url })),
          createdAt: new Date().toISOString()
        }
        set((state) => ({
          messages: [...state.messages.slice(-(MAX_MESSAGES - 1)), userMsg]
        }))

        // Auto-extract memories from user message (fire and forget)
        if (content) {
          useMemoryStore
            .getState()
            .extractFromMessage(userMsg.id, content)
            .catch((err) => {
              console.error('[ChatStore] Memory extraction from user message failed:', err)
            })
        }

        // 创建助手消息占位 - 带 MAIN_TEXT block
        const assistantMsgId = crypto.randomUUID()
        const mainTextBlock = createMainTextBlock(assistantMsgId)
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          sessionId: activeSessionId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          providerId,
          modelId,
          blocks: [mainTextBlock],
          createdAt: new Date().toISOString()
        }
        set((state) => ({
          messages: [...state.messages.slice(-(MAX_MESSAGES - 1)), assistantMsg]
        }))

        try {
          // 构建消息内容（包含 Skills 上下文）
          let messageContent = content

          // 如果有启用的 Skills，将 Skills 内容拼接到 system context
          try {
            const { useSkillsStore } = await import('./skills')
            const skillsStore = useSkillsStore.getState()
            const activeSkillsContent = skillsStore.getActiveSkillsContent()
            if (activeSkillsContent) {
              // 将 skills 内容作为 system prompt 的一部分传递
              // 实际通过 API 的 systemPrompt 字段传递
              messageContent = content // 用户消息保持原样，skills 通过其他方式传递
            }
          } catch {
            // Skills store 可能未加载，忽略
          }

          const result = (await api.chat.send({
            sessionId: activeSessionId,
            content: messageContent,
            providerId,
            modelId,
            attachments: attachments?.map((a) => ({ type: a.type, url: a.url })),
            messageId: assistantMsgId, // 传递前端生成的消息 ID，确保流式事件匹配
            systemPrompt: get().getActiveSystemPrompt() // 传递当前助手的 system prompt
          })) as { messageId?: string; content?: string; error?: string }

          // 检查后端返回的错误
          if (result?.error) {
            console.error('[ChatStore] Backend returned error:', result.error)
            toastError({ title: 'Chat Error', description: result.error })
            set({ error: result.error, isGenerating: false, abortController: null })
            get().addErrorBlock(assistantMsgId, {
              message: result.error,
              status: 500,
              providerId
            })
          }
        } catch (error) {
          // 如果是用户主动中断，不显示错误
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('[ChatStore] Generation aborted by user')
            set({ isGenerating: false, abortController: null })
            // 更新助手消息状态为 cancelled
            set((state) => ({
              messages: state.messages.map((m) => {
                if (m.id !== assistantMsgId) return m
                return { ...m, status: 'cancelled' as const }
              })
            }))
            return
          }

          const message = error instanceof Error ? error.message : 'Failed to send message'
          console.error('Send message error:', error)
          toastError({
            title: 'Chat Error',
            description: message.length > 80 ? `${message.slice(0, 80)}...` : message
          })
          set({ error: message, isGenerating: false, abortController: null })

          // 添加错误块到助手消息
          const err = error as Error & { status?: number }
          get().addErrorBlock(assistantMsgId, {
            message: err.message || 'Unknown error',
            status: err.status,
            providerId
          })
        }
      },

      handleStreamChunk: (chunk) => {
        console.log('[ChatStore] Received chunk:', {
          messageId: chunk.messageId,
          textDelta: chunk.textDelta?.slice(0, 20),
          thinkingDelta: chunk.thinkingDelta?.slice(0, 20),
          finishReason: chunk.finishReason,
          hasError: !!chunk.error
        })

        const { messages } = get()
        const message = messages.find((m) => m.id === chunk.messageId)
        if (!message) {
          console.warn('[ChatStore] Message not found:', chunk.messageId)
          return
        }

        // 处理错误事件（优先级最高）
        if (chunk.error) {
          const error = chunk.error
          console.log('[ChatStore] Error chunk received:', error.message)

          // 清理临时内容，重置生成状态
          set((state) => ({
            streamingContent: { ...state.streamingContent, [chunk.messageId]: '' },
            streamingThinking: { ...state.streamingThinking, [chunk.messageId]: '' },
            isGenerating: false,
            abortController: null,
            error: error.message
          }))

          // 添加 ERROR block 到消息
          set((state) => ({
            messages: state.messages.map((m) => {
              if (m.id !== chunk.messageId) return m

              const errorBlock = createErrorBlock(m.id, {
                message: error.message,
                status: error.status,
                providerId: error.providerId
              })

              // 将 MAIN_TEXT 和 THINKING block 状态设为 ERROR
              const updatedBlocks = (m.blocks || []).map((b) => {
                if (b.type === MessageBlockType.MAIN_TEXT || b.type === MessageBlockType.THINKING) {
                  return { ...b, status: MessageBlockStatus.ERROR }
                }
                return b
              })

              return {
                ...m,
                status: 'error' as const,
                content: m.content || error.message,
                blocks: [...updatedBlocks, errorBlock]
              }
            })
          }))
          return
        }

        // 处理思考内容
        if (chunk.thinkingDelta) {
          set((state) => ({
            streamingThinking: {
              ...state.streamingThinking,
              [chunk.messageId]: (state.streamingThinking[chunk.messageId] || '') + chunk.thinkingDelta
            }
          }))

          // 更新或创建 THINKING block
          set((state) => ({
            messages: state.messages.map((m) => {
              if (m.id !== chunk.messageId) return m

              const blocks = m.blocks || []
              const thinkingBlockIndex = blocks.findIndex((b) => b.type === MessageBlockType.THINKING)

              if (thinkingBlockIndex >= 0) {
                // 更新现有 thinking block
                const updatedBlocks = [...blocks]
                updatedBlocks[thinkingBlockIndex] = {
                  ...updatedBlocks[thinkingBlockIndex],
                  content: (updatedBlocks[thinkingBlockIndex] as ThinkingMessageBlock).content + chunk.thinkingDelta
                } as ThinkingMessageBlock
                return { ...m, blocks: updatedBlocks }
              } else {
                // 创建新的 thinking block
                const newBlock = createThinkingBlock(m.id, chunk.thinkingDelta)
                return { ...m, blocks: [...blocks, newBlock] }
              }
            })
          }))
        }

        // 流结束信号
        if (chunk.finishReason) {
          console.log('[ChatStore] Stream finished:', chunk.finishReason)

          // 清理临时内容
          set((state) => ({
            streamingContent: { ...state.streamingContent, [chunk.messageId]: '' },
            streamingThinking: { ...state.streamingThinking, [chunk.messageId]: '' },
            isGenerating: false,
            abortController: null
          }))

          // 更新消息状态和 blocks
          set((state) => ({
            messages: state.messages.map((m) => {
              if (m.id !== chunk.messageId) return m

              const updatedBlocks = (m.blocks || []).map((b) => {
                if (b.type === MessageBlockType.MAIN_TEXT || b.type === MessageBlockType.THINKING) {
                  return { ...b, status: MessageBlockStatus.SUCCESS }
                }
                return b
              })

              return {
                ...m,
                status: chunk.finishReason === 'error' ? ('error' as const) : ('success' as const),
                content: m.content,
                blocks: updatedBlocks
              }
            })
          }))

          // Auto-extract memories from the completed assistant message
          if (chunk.finishReason !== 'error') {
            const assistantMessage = get().messages.find((m) => m.id === chunk.messageId)
            if (assistantMessage?.content) {
              // Fire and forget - don't block UI
              useMemoryStore
                .getState()
                .extractFromMessage(chunk.messageId, assistantMessage.content)
                .catch((err) => {
                  console.error('[ChatStore] Memory extraction failed:', err)
                })
            }
          }

          return
        }

        // 更新流式内容 - 更新 MAIN_TEXT block
        if (chunk.textDelta) {
          const newContent = (get().streamingContent[chunk.messageId] || '') + chunk.textDelta
          set((state) => ({
            streamingContent: {
              ...state.streamingContent,
              [chunk.messageId]: newContent
            }
          }))

          // 更新消息 content 和 MAIN_TEXT block
          set((state) => ({
            messages: state.messages.map((m) => {
              if (m.id !== chunk.messageId) return m

              const blocks = m.blocks || []
              const mainTextIndex = blocks.findIndex((b) => b.type === MessageBlockType.MAIN_TEXT)

              let updatedBlocks: MessageBlock[]
              if (mainTextIndex >= 0) {
                updatedBlocks = [...blocks]
                updatedBlocks[mainTextIndex] = {
                  ...updatedBlocks[mainTextIndex],
                  content: (updatedBlocks[mainTextIndex] as MainTextMessageBlock).content + chunk.textDelta,
                  status: MessageBlockStatus.STREAMING
                } as MainTextMessageBlock
              } else {
                updatedBlocks = [...blocks, createMainTextBlock(m.id, chunk.textDelta)]
              }

              return {
                ...m,
                content: newContent,
                status: 'streaming' as const,
                blocks: updatedBlocks
              }
            })
          }))
        }
      },

      stopGeneration: () => {
        const { abortController } = get()
        if (abortController) {
          abortController.abort()
          set({ abortController: null })
        }
        api.chat.cancel().catch((err) => {
          console.error('[ChatStore] Failed to cancel chat request:', err)
        })
        // isGenerating is reset when the stream ends with finishReason=cancel, not here
      },

      getActiveSession: () => {
        const { activeSessionId, sessions } = get()
        return sessions.find((s) => s.id === activeSessionId) || null
      },

      getActiveSystemPrompt: () => {
        const { activeAssistantId, assistants } = get()
        if (activeAssistantId) {
          const assistant = assistants.find((a) => a.id === activeAssistantId)
          if (assistant?.systemPrompt) return assistant.systemPrompt
        }
        const session = get().getActiveSession()
        return session?.systemPrompt || undefined
      },

      clearError: () => {
        set({ error: null })
      },

      flushQueue: async () => {
        const { messageQueue, activeSessionId, isSendingQueued, isGenerating } = get()
        if (isSendingQueued || messageQueue.length === 0) return
        if (!activeSessionId) return
        if (isGenerating) return // prevent concurrent sends

        set({ isSendingQueued: true, isGenerating: true, error: null })

        const toSend = messageQueue.filter((m) => m.sessionId === activeSessionId)
        const remaining = messageQueue.filter((m) => m.sessionId !== activeSessionId)

        for (const msg of toSend) {
          const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            sessionId: msg.sessionId,
            role: 'user',
            content: msg.content,
            status: 'success',
            createdAt: new Date().toISOString()
          }
          set((state) => ({
            messages: [...state.messages.slice(-(MAX_MESSAGES - 1)), userMsg]
          }))

          try {
            await api.chat.send({
              sessionId: msg.sessionId,
              content: msg.content,
              providerId: msg.providerId,
              modelId: msg.modelId
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send message'
            console.error('Flush queue error:', error)
            toastError({
              title: 'Chat Error',
              description: message.length > 80 ? `${message.slice(0, 80)}...` : message
            })
            set({ error: message, isSendingQueued: false, isGenerating: false })
            return
          }
        }

        set({ messageQueue: remaining, isSendingQueued: false, isGenerating: false })
      },

      regenerateMessage: async (messageId: string) => {
        const { messages, isGenerating } = get()
        if (isGenerating) return // prevent regenerating while already generating

        const messageIndex = messages.findIndex((m) => m.id === messageId)
        if (messageIndex === -1) return

        // 找到对应的用户消息（向前查找）
        let userMessageIndex = -1
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            userMessageIndex = i
            break
          }
        }
        if (userMessageIndex === -1) return

        const userMessage = messages[userMessageIndex]
        const providerId = messages[messageIndex].providerId || userMessage.providerId
        const modelId = messages[messageIndex].modelId || userMessage.modelId

        // Save truncated messages for recovery on failure
        const deletedMessages = messages.slice(messageIndex)

        // 删除当前助手消息及之后的所有消息
        set((state) => ({
          messages: state.messages.slice(0, messageIndex)
        }))

        // 重新发送
        // sendMessage handles all errors internally (AbortError, network, API errors)
        // and never re-throws, so no catch block is needed here.
        await get().sendMessage(userMessage.content, providerId || '', modelId || '')
      },

      deleteMessage: (messageId: string) => {
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== messageId)
        }))
      },

      editMessage: (messageId: string, content: string) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m

            // 更新 content 和 MAIN_TEXT block
            const blocks = m.blocks || []
            const mainTextIndex = blocks.findIndex((b) => b.type === MessageBlockType.MAIN_TEXT)

            let updatedBlocks: MessageBlock[]
            if (mainTextIndex >= 0) {
              updatedBlocks = [...blocks]
              updatedBlocks[mainTextIndex] = {
                ...updatedBlocks[mainTextIndex],
                content
              } as MainTextMessageBlock
            } else {
              updatedBlocks = [...blocks, createMainTextBlock(m.id, content)]
            }

            return { ...m, content, blocks: updatedBlocks }
          })
        }))
      },

      addErrorBlock: (messageId: string, error: { message: string; status?: number; providerId?: string }) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m

            const errorBlock = createErrorBlock(messageId, error)

            // 将 MAIN_TEXT 和 THINKING block 状态设为 ERROR
            const updatedBlocks = (m.blocks || []).map((b) => {
              if (b.type === MessageBlockType.MAIN_TEXT || b.type === MessageBlockType.THINKING) {
                return { ...b, status: MessageBlockStatus.ERROR }
              }
              return b
            })

            return {
              ...m,
              status: 'error',
              blocks: [...updatedBlocks, errorBlock]
            }
          })
        }))
      },

      // ============ Block 操作 ============

      updateMessageBlocks: (messageId: string, blocks: MessageBlock[]) => {
        set((state) => ({
          messages: state.messages.map((m) => (m.id === messageId ? { ...m, blocks } : m))
        }))
      },

      appendToMainTextBlock: (messageId: string, text: string) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m

            const blocks = m.blocks || []
            const mainTextIndex = blocks.findIndex((b) => b.type === MessageBlockType.MAIN_TEXT)

            let updatedBlocks: MessageBlock[]
            if (mainTextIndex >= 0) {
              updatedBlocks = [...blocks]
              updatedBlocks[mainTextIndex] = {
                ...updatedBlocks[mainTextIndex],
                content: (updatedBlocks[mainTextIndex] as MainTextMessageBlock).content + text
              } as MainTextMessageBlock
            } else {
              updatedBlocks = [...blocks, createMainTextBlock(m.id, text)]
            }

            return { ...m, content: m.content + text, blocks: updatedBlocks }
          })
        }))
      },

      createMainTextBlock: (messageId: string, content = '') => {
        const block = createMainTextBlock(messageId, content)
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m
            return { ...m, blocks: [...(m.blocks || []), block] }
          })
        }))
        return block.id
      },

      createThinkingBlock: (messageId: string, content = '') => {
        const block = createThinkingBlock(messageId, content)
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m
            return { ...m, blocks: [...(m.blocks || []), block] }
          })
        }))
        return block.id
      },

      updateThinkingBlock: (messageId: string, content: string) => {
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m

            const blocks = m.blocks || []
            const thinkingIndex = blocks.findIndex((b) => b.type === MessageBlockType.THINKING)

            let updatedBlocks: MessageBlock[]
            if (thinkingIndex >= 0) {
              updatedBlocks = [...blocks]
              updatedBlocks[thinkingIndex] = {
                ...updatedBlocks[thinkingIndex],
                content
              } as ThinkingMessageBlock
            } else {
              updatedBlocks = [...blocks, createThinkingBlock(m.id, content)]
            }

            return { ...m, blocks: updatedBlocks }
          })
        }))
      },

      reset: () => {
        set({ sessions: [], messages: [], activeSessionId: null, activeAssistantId: null, messageQueue: [] })
      }
    }),
    {
      name: 'cherrystudio-chat',
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
        activeAssistantId: state.activeAssistantId,
        messageQueue: state.messageQueue
      })
    }
  )
)

// 注册流式监听
let unsubChat: (() => void) | null = null

export function initChatStreamListener() {
  // 清理旧的监听器，重新注册
  if (unsubChat) {
    unsubChat()
    unsubChat = null
  }
  console.log('[ChatStore] Registering stream listener')
  unsubChat = api.chat.onStream((_event, data) => {
    console.log('[ChatStore] Stream event received:', {
      messageId: (data as ChatStreamChunk).messageId,
      hasError: !!(data as ChatStreamChunk).error,
      finishReason: (data as ChatStreamChunk).finishReason
    })
    const chunk = data as ChatStreamChunk
    useChatStore.getState().handleStreamChunk(chunk)
  })
}

export function cleanupChatStreamListener() {
  unsubChat?.()
  unsubChat = null
}
