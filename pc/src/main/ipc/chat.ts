/**
 * Chat IPC Handlers
 * 处理聊天会话管理、消息发送、流式输出
 * 1:1 复刻 Cherry Studio 的流式处理架构
 */

import type { StreamTextParams } from '@cherrystudio/ai-core'
import { streamText } from '@cherrystudio/ai-core'
import type {
  ChatStreamChunk,
  CreateSessionRequest,
  MainTextMessageBlock,
  MessageBlock,
  SendMessageRequest,
  ThinkingMessageBlock
} from '@shared/types/chat'
import { resolveProvider } from '@main/utils/provider-resolver'
import { consumeStream, type StreamHandlers } from '../services/ai-stream'
import { GENERATION_TOOLS } from '../services/generation-tools'
import { createRoutedGenerationTask } from '../services/generation-router'
import type { GenerationToolName } from '../services/generation-tools'
import { MessageBlockStatus, MessageBlockType } from '@shared/types/chat'
import { desc, eq } from 'drizzle-orm'
import { app, ipcMain } from 'electron'
import { db } from '../db'
import { chatAssistants, chatMessages, chatSessions } from '../db/schema'

// 主窗口引用，用于推送流式消息
let mainWindow: Electron.BrowserWindow | null = null

export function setChatMainWindow(win: Electron.BrowserWindow) {
  mainWindow = win
}

// 正在运行的 research:stream 任务，用于硬取消
const activeResearchControllers = new Map<string, AbortController>()
let activeChatController: AbortController | null = null
let activeChatMessageId: string | null = null

function pushStreamChunk(chunk: ChatStreamChunk) {
  if (!mainWindow) {
    console.error('[Chat] Cannot push stream chunk: mainWindow is null')
    return
  }
  if (mainWindow.isDestroyed()) {
    console.error('[Chat] Cannot push stream chunk: mainWindow is destroyed')
    return
  }
  if (!app.isPackaged && process.env.SENTRY_DSN) {
    console.log('[Chat] Pushing stream chunk:', {
      messageId: chunk.messageId,
      hasError: !!chunk.error,
      finishReason: chunk.finishReason,
      textDeltaLength: chunk.textDelta?.length
    })
  }
  mainWindow.webContents.send('chat:stream', chunk)
}

// ============ Block 序列化/反序列化 ============

function serializeBlocks(blocks: MessageBlock[]): string {
  return JSON.stringify(blocks)
}

function deserializeBlocks(blocksJson: string | null): MessageBlock[] | undefined {
  if (!blocksJson) return undefined
  try {
    return JSON.parse(blocksJson) as MessageBlock[]
  } catch {
    return undefined
  }
}

function deserializeAttachments(
  attachmentsJson: string | null
): Array<{ type: string; url: string; name?: string }> | undefined {
  if (!attachmentsJson) return undefined
  try {
    const parsed = JSON.parse(attachmentsJson)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function registerChatIpc() {
  // 创建会话
  ipcMain.handle('chat:session:create', async (_event, req: CreateSessionRequest) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.insert(chatSessions).values({
      id,
      title: req.title || 'New Chat',
      providerId: req.providerId,
      modelId: req.modelId,
      systemPrompt: req.systemPrompt,
      createdAt: now,
      updatedAt: now
    })
    return { id, title: req.title || 'New Chat' }
  })

  // 获取会话列表
  ipcMain.handle('chat:session:list', async () => {
    const result = await db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt)).limit(100)
    return result
  })

  // 更新会话
  ipcMain.handle('chat:session:update', async (_event, id: string, data: Record<string, unknown>) => {
    const allowed: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    const safeFields = ['title', 'providerId', 'modelId', 'systemPrompt', 'isFavorite'] as const
    for (const field of safeFields) {
      if (field in data) {
        allowed[field] = data[field]
      }
    }
    await db
      .update(chatSessions)
      .set(allowed)
      .where(eq(chatSessions.id, id))
    return true
  })

  // 删除会话
  ipcMain.handle('chat:session:delete', async (_event, id: string) => {
    // 在事务中先删除消息，再删除会话
    await db.transaction(async (tx) => {
      await tx.delete(chatMessages).where(eq(chatMessages.sessionId, id))
      await tx.delete(chatSessions).where(eq(chatSessions.id, id))
    })
    return true
  })

  // 获取会话消息
  ipcMain.handle('chat:messages:list', async (_event, sessionId: string) => {
    const result = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
      .limit(500)

    // 反序列化 blocks 和 attachments，并剥离 base64 防止 OOM
    return result.map((m) => {
      const msg: Record<string, unknown> = {
        ...m,
        blocks: deserializeBlocks(m.blocks as string | null),
        attachments: deserializeAttachments(m.attachments as string | null)
      }
      // Strip base64 data URLs from attachments to avoid large IPC payloads
      if (Array.isArray(msg.attachments)) {
        msg.attachments = (msg.attachments as Record<string, unknown>[]).map((att) => {
          const { data, ...rest } = att
          return rest
        })
      }
      return msg
    })
  })

  // 发送消息（流式）
  ipcMain.handle('chat:send', async (_event, req: SendMessageRequest) => {
    const startTime = Date.now()
    const messageId = req.messageId || crypto.randomUUID()
    const abortController = new AbortController()
    activeChatController?.abort()
    activeChatController = abortController
    activeChatMessageId = messageId

    try {
      const now = new Date().toISOString()

      // 1. 保存用户消息
      await db.insert(chatMessages).values({
        id: crypto.randomUUID(),
        sessionId: req.sessionId,
        role: 'user',
        content: req.content,
        attachments: req.attachments ? JSON.stringify(req.attachments) : null,
        createdAt: now
      })

      // 2. 获取历史消息（最近 20 条）
      const history = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, req.sessionId))
        .orderBy(chatMessages.createdAt)
        .limit(20)

      // 构建消息，支持多模态（图片附件）
      const messages = history.map((m) => {
        const msg: {
          role: 'user' | 'assistant' | 'system'
          content: string | Array<{ type: string; text?: string; image?: string; mediaType?: string }>
        } = {
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        }
        // 如果消息有图片附件，构建多模态内容数组
        if (m.attachments) {
          try {
            const attachments = JSON.parse(m.attachments as string) as Array<{ type: string; url: string }>
            const imageAttachments = attachments.filter((a) => a.type === 'image' && a.url)
            if (imageAttachments.length > 0) {
              const contentParts: Array<{ type: string; text?: string; image?: string; mediaType?: string }> = []
              if (m.content) {
                contentParts.push({ type: 'text', text: m.content })
              }
              for (const img of imageAttachments) {
                // ai SDK v6 image part: { type: 'image', image: string | Uint8Array | URL, mediaType?: string }
                // base64 data URL format: data:image/png;base64,...
                // Extract mediaType from data URL if present
                let mediaType: string | undefined
                if (img.url.startsWith('data:')) {
                  const match = img.url.match(/data:([^;]+);/)
                  if (match) mediaType = match[1]
                }
                console.log('[Chat] Adding image attachment:', {
                  urlLength: img.url.length,
                  urlPrefix: img.url.slice(0, 50),
                  isDataUrl: img.url.startsWith('data:'),
                  mediaType
                })
                const imagePart: { type: string; image: string; mediaType?: string } = {
                  type: 'image',
                  image: img.url
                }
                if (mediaType) {
                  imagePart.mediaType = mediaType
                }
                contentParts.push(imagePart)
              }
              msg.content = contentParts
            }
          } catch (e) {
            console.error('[Chat] Failed to parse attachments:', e)
          }
        }
        return msg
      }) as NonNullable<StreamTextParams['messages']>

      // Log the final messages for debugging
      console.log(
        '[Chat] Messages prepared:',
        messages.map((m, i) => ({
          index: i,
          role: m.role,
          contentType: typeof m.content === 'string' ? 'string' : 'array',
          contentLength: typeof m.content === 'string' ? m.content.length : m.content.length,
          hasImage: typeof m.content !== 'string' && m.content.some((p: { type: string }) => p.type === 'image')
        }))
      )

      // 3. 解析 Provider 配置（查询 + 解密 API Key + 映射类型）
      const resolved = await resolveProvider(req.providerId)

      // 4. 构建 ai-core 设置
      const settings: Record<string, string> = {}
      if (resolved.apiKey) settings.apiKey = resolved.apiKey
      if (resolved.baseURL) settings.baseURL = resolved.baseURL

      const providerId = resolved.providerId

      // 5. 创建初始 MAIN_TEXT block
      const mainTextBlock: MessageBlock = {
        id: crypto.randomUUID(),
        messageId,
        type: MessageBlockType.MAIN_TEXT,
        status: MessageBlockStatus.STREAMING,
        content: '',
        createdAt: new Date().toISOString()
      }
      const initialBlocks: MessageBlock[] = [mainTextBlock]

      // 6. 先插入一条空的 assistant 消息（带 blocks）
      await db.insert(chatMessages).values({
        id: messageId,
        sessionId: req.sessionId,
        role: 'assistant',
        content: '',
        modelId: req.modelId,
        blocks: serializeBlocks(initialBlocks),
        createdAt: new Date().toISOString()
      })

      // 7. 注入系统提示词（role: system）
      if (req.systemPrompt?.trim()) {
        messages.unshift({ role: 'system', content: req.systemPrompt.trim() })
        console.log('[Chat] System prompt injected:', req.systemPrompt.slice(0, 100))
      }

      // 8. 调用 streamText（可选启用生成工具）
      console.log('[Chat] Calling streamText with provider:', providerId, 'model:', req.modelId, 'tools:', !!req.enableGenerationTools)

      const streamParams: StreamTextParams = {
        model: req.modelId,
        messages,
        maxRetries: 0,
        abortSignal: abortController.signal
      }

      if (req.enableGenerationTools) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(streamParams as any).tools = GENERATION_TOOLS
        ;(streamParams as any).stopWhen = ({ steps }: { steps: Array<{ finishReason?: string }> }) => {
          const last = steps[steps.length - 1]
          return (
            !last ||
            (last.finishReason !== 'tool-calls' && last.finishReason !== 'error') ||
            steps.length >= 10
          )
        }
      }

      const result = await streamText(providerId as Parameters<typeof streamText>[0], settings as never, streamParams)

      // 8. 消费流并推送
      let fullText = ''
      let finishReason = ''
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
      let chunkCount = 0
      const currentBlocks: MessageBlock[] = [...initialBlocks]

      try {
        const streamHandlers: StreamHandlers = {
          onText: (delta) => {
            if (abortController.signal.aborted) {
              throw new Error('Aborted')
            }
            chunkCount++
            fullText += delta

            // 更新 MAIN_TEXT block
            const mainTextIndex = currentBlocks.findIndex((b) => b.type === MessageBlockType.MAIN_TEXT)
            if (mainTextIndex >= 0) {
              const existingBlock = currentBlocks[mainTextIndex] as MainTextMessageBlock
              currentBlocks[mainTextIndex] = {
                ...existingBlock,
                content: existingBlock.content + delta
              }
            }

            pushStreamChunk({
              sessionId: req.sessionId,
              messageId,
              textDelta: delta
            })
          },
          onReasoning: (delta) => {
            if (abortController.signal.aborted) {
              throw new Error('Aborted')
            }
            chunkCount++

            const thinkingIndex = currentBlocks.findIndex((b) => b.type === MessageBlockType.THINKING)
            if (thinkingIndex >= 0) {
              const existingBlock = currentBlocks[thinkingIndex] as ThinkingMessageBlock
              currentBlocks[thinkingIndex] = {
                ...existingBlock,
                content: existingBlock.content + delta
              }
            } else {
              const newBlock: ThinkingMessageBlock = {
                id: crypto.randomUUID(),
                messageId,
                type: MessageBlockType.THINKING,
                status: MessageBlockStatus.STREAMING,
                content: delta,
                createdAt: new Date().toISOString()
              }
              currentBlocks.push(newBlock)
            }

            pushStreamChunk({
              sessionId: req.sessionId,
              messageId,
              thinkingDelta: delta
            })
          },
          onError: (error) => {
            // AI SDK 内部错误（如 RetryError）会以 error chunk 形式出现
            console.error('[Chat] Error chunk from stream:', error)
            throw error
          },
          onToolCall: (toolCall) => {
            console.log('[Chat] Tool call:', toolCall.toolName, 'args:', JSON.stringify(toolCall.args).slice(0, 200))
            // 推送 tool-call 事件到前端
            pushStreamChunk({
              sessionId: req.sessionId,
              messageId,
              toolCall: {
                id: toolCall.toolCallId,
                name: toolCall.toolName,
                arguments: toolCall.args as Record<string, unknown>
              }
            })
          },
          onToolResult: async (toolResult) => {
            console.log('[Chat] Tool result:', toolResult.toolName)

            // 对生成工具，自动创建实际的 GenerationTask
            const toolName = toolResult.toolName as GenerationToolName
            const toolArgs = toolResult.result as Record<string, unknown> | undefined

            // toolResult.result 实际上是 tool-call 时的 args（因为 execute 返回占位符）
            // 我们需要从 tool-call block 中获取 args。这里用 result 做 fallback
            try {
              let taskResult = ''
              if (toolName === 'generate_image' && toolArgs) {
                const task = await createRoutedGenerationTask({
                  providerId: req.providerId,
                  model: req.modelId,
                  prompt: String(toolArgs.prompt || ''),
                  size: '1024x1024',
                  n: (toolArgs.n as number) || 1
                })
                taskResult = `Image generation task created: ${task.id}. Status: ${task.status}. The image is being generated.`
              } else if (toolName === 'generate_video' && toolArgs) {
                const task = await createRoutedGenerationTask({
                  providerId: req.providerId,
                  model: req.modelId,
                  prompt: String(toolArgs.prompt || ''),
                  duration: (toolArgs.duration as number) || 5,
                  generationMode: 'video'
                })
                taskResult = `Video generation task created: ${task.id}. Status: ${task.status}. The video is being generated.`
              } else if (toolName === 'generate_product_set' && toolArgs) {
                taskResult = `Product set generation for "${toolArgs.product_name || 'product'}" will be created. Use the Ecommerce Showcase to upload a product image and generate the full set.`
              } else {
                taskResult = 'Task submitted successfully.'
              }

              pushStreamChunk({
                sessionId: req.sessionId,
                messageId,
                toolResult: {
                  id: toolResult.toolCallId,
                  name: toolResult.toolName,
                  result: taskResult
                }
              })
            } catch (err) {
              console.error('[Chat] Tool execution failed:', err)
              pushStreamChunk({
                sessionId: req.sessionId,
                messageId,
                toolResult: {
                  id: toolResult.toolCallId,
                  name: toolResult.toolName,
                  result: `Error: ${err instanceof Error ? err.message : String(err)}`,
                  error: true
                }
              })
            }
          },
          onFinish: (result) => {
            finishReason = result.finishReason ?? ''
            const totalUsage = result.usage as Record<string, number> | undefined
            usage = totalUsage
              ? {
                  promptTokens: totalUsage.promptTokens ?? 0,
                  completionTokens: totalUsage.completionTokens ?? 0,
                  totalTokens: totalUsage.totalTokens ?? 0
                }
              : undefined
          }
        }

        await consumeStream(result, streamHandlers)
        console.log('[Chat] Stream completed, chunks:', chunkCount, 'text length:', fullText.length)
      } catch (streamError) {
        console.error('[Chat] Stream error:', streamError)
        // 构建错误信息
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError)
        const errorStatus =
          (streamError as Error & { statusCode?: number }).statusCode ||
          (streamError as Error & { status?: number }).status ||
          500

        const isAborted =
          streamError instanceof Error && (streamError.name === 'AbortError' || streamError.message === 'Aborted')

        if (isAborted) {
          await db
            .update(chatMessages)
            .set({
              content: fullText,
              modelId: req.modelId,
              blocks: serializeBlocks(
                currentBlocks.map((block) => ({
                  ...block,
                  status: MessageBlockStatus.PAUSED
                }))
              )
            })
            .where(eq(chatMessages.id, messageId))

          pushStreamChunk({
            sessionId: req.sessionId,
            messageId,
            textDelta: '',
            finishReason: 'cancel',
            usage
          })

          return { messageId, content: fullText, cancelled: true }
        }

        // 添加 ERROR block
        const errorBlock: MessageBlock = {
          id: crypto.randomUUID(),
          messageId,
          type: MessageBlockType.ERROR,
          status: MessageBlockStatus.ERROR,
          error: {
            message: errorMessage,
            status: errorStatus,
            providerId: req.providerId,
            modelId: req.modelId
          },
          createdAt: new Date().toISOString()
        }
        currentBlocks.push(errorBlock)

        // 更新数据库中的消息（带错误 block）
        await db
          .update(chatMessages)
          .set({
            content: fullText || errorMessage,
            modelId: req.modelId,
            blocks: serializeBlocks(currentBlocks)
          })
          .where(eq(chatMessages.id, messageId))

        // 向前端推送错误事件（关键：让前端知道流已结束并显示错误）
        pushStreamChunk({
          sessionId: req.sessionId,
          messageId,
          textDelta: '',
          finishReason: 'error',
          error: {
            message: errorMessage,
            status: errorStatus,
            providerId: req.providerId,
            modelId: req.modelId
          }
        })

        throw streamError
      }

      // 9. 更新所有 block 状态为 SUCCESS
      const finalBlocks = currentBlocks.map((b) => ({
        ...b,
        status: MessageBlockStatus.SUCCESS
      }))

      // 10. 更新 assistant 消息为完整内容
      const latency = Date.now() - startTime
      await db
        .update(chatMessages)
        .set({
          content: fullText,
          modelId: req.modelId,
          tokensUsed: usage?.totalTokens,
          latency,
          blocks: serializeBlocks(finalBlocks)
        })
        .where(eq(chatMessages.id, messageId))

      // 11. 更新会话时间
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(chatSessions.id, req.sessionId))

      // 12. 发送完成事件
      pushStreamChunk({
        sessionId: req.sessionId,
        messageId,
        textDelta: '',
        finishReason,
        usage
      })

      return { messageId, content: fullText }
    } catch (error) {
      console.error('Chat send error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStatus =
        (error as Error & { statusCode?: number }).statusCode || (error as Error & { status?: number }).status || 500

      // 确保向前端推送错误事件（防止外层 catch 时前端仍显示 loading）
      // 关键：先推送错误事件，再抛出错误
      try {
        // 更新数据库中的消息（带错误 blocks）
        const errorBlock: MessageBlock = {
          id: crypto.randomUUID(),
          messageId,
          type: MessageBlockType.ERROR,
          status: MessageBlockStatus.ERROR,
          error: {
            message: errorMessage,
            status: errorStatus,
            providerId: req.providerId,
            modelId: req.modelId
          },
          createdAt: new Date().toISOString()
        }

        await db
          .update(chatMessages)
          .set({
            content: errorMessage,
            blocks: serializeBlocks([errorBlock])
          })
          .where(eq(chatMessages.id, messageId))

        // 推送错误事件给前端（同步推送，确保在 throw 前到达）
        pushStreamChunk({
          sessionId: req.sessionId,
          messageId,
          textDelta: '',
          finishReason: 'error',
          error: {
            message: errorMessage,
            status: errorStatus,
            providerId: req.providerId,
            modelId: req.modelId
          }
        })

        // 给 IPC 一点时间让事件到达前端
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (pushErr) {
        console.error('[Chat] Failed to push error event:', pushErr)
      }

      // 不再抛出错误，让 IPC 正常返回错误信息
      // 前端通过 chat:stream 事件处理错误显示
      return { messageId, content: '', error: errorMessage }
    } finally {
      if (activeChatMessageId === messageId) {
        activeChatController = null
        activeChatMessageId = null
      }
    }
  })

  ipcMain.handle('chat:cancel', async () => {
    if (!activeChatController) {
      return { cancelled: false }
    }

    activeChatController.abort()
    return { cancelled: true }
  })

  // ============ 深度研究：直接流式调用 AI（不保存到聊天数据库）============
  ipcMain.handle(
    'research:stream',
    async (
      _event,
      req: {
        providerId: string
        modelId: string
        prompt: string
        taskId: string
        systemPrompt?: string
        temperature?: number
      }
    ) => {
      const { providerId, modelId, prompt, taskId, systemPrompt, temperature } = req
      const _streamId = `research-${taskId}`

      try {
        // 1. 解析 provider 配置（查询 + 解密 API Key + 映射类型）
        const resolved = await resolveProvider(providerId)

        // 2. 构建 provider settings
        const providerIdForAiCore = resolved.providerId
        const settings = {
          apiKey: resolved.apiKey,
          baseURL: resolved.baseURL
        }

        // 3. 构建消息
        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
        if (systemPrompt?.trim()) {
          messages.push({ role: 'system', content: systemPrompt.trim() })
        }
        messages.push({ role: 'user', content: prompt })

        // 4. 调用 streamText
        const abortController = new AbortController()
        activeResearchControllers.set(taskId, abortController)

        const streamParams: StreamTextParams = {
          model: modelId,
          messages,
          maxRetries: 0,
          abortSignal: abortController.signal
        }
        if (typeof temperature === 'number') {
          streamParams.temperature = temperature
        }
        const result = await streamText(
          providerIdForAiCore as Parameters<typeof streamText>[0],
          settings as never,
          streamParams
        )

        // 5. 消费流并推送
        let fullText = ''
        let hasError = false

        try {
          await consumeStream(result, {
            onText: (delta) => {
              if (abortController.signal.aborted) {
                throw new Error('Aborted')
              }
              fullText += delta
              // 推送到前端（使用 research 专用 channel）
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('research:stream', {
                  taskId,
                  textDelta: delta,
                  done: false
                })
              }
            },
            onError: (error) => {
              hasError = true
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('research:stream', {
                  taskId,
                  error: errorMessage,
                  done: true
                })
              }
              throw error
            }
          })
        } catch (streamError) {
          const isAborted =
            streamError instanceof Error && (streamError.name === 'AbortError' || streamError.message === 'Aborted')
          if (isAborted) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('research:stream', {
                taskId,
                content: fullText,
                done: true,
                cancelled: true
              })
            }
            return { content: fullText, cancelled: true }
          }
          const errorMessage = streamError instanceof Error ? streamError.message : String(streamError)
          if (!hasError && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('research:stream', {
              taskId,
              error: errorMessage,
              done: true
            })
          }
          return { content: fullText, error: errorMessage }
        } finally {
          activeResearchControllers.delete(taskId)
        }

        // 6. 发送完成事件
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('research:stream', {
            taskId,
            content: fullText,
            done: true
          })
        }

        return { content: fullText }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('research:stream', {
            taskId,
            error: errorMessage,
            done: true
          })
        }
        return { content: '', error: errorMessage }
      } finally {
        activeResearchControllers.delete(taskId)
      }
    }
  )

  // 取消正在运行的 research:stream
  ipcMain.handle('research:cancel', (_event, taskId: string) => {
    const controller = activeResearchControllers.get(taskId)
    if (controller) {
      controller.abort()
      activeResearchControllers.delete(taskId)
      return { cancelled: true }
    }
    return { cancelled: false }
  })

  // ============ 聊天助手 (ChatAssistant) CRUD ============
  ipcMain.handle('chat:assistants:list', async () => {
    try {
      const rows = db.select().from(chatAssistants).orderBy(chatAssistants.sortOrder).all()
      return rows
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('chat:assistants:get', async (_event, id: string) => {
    try {
      const row = db.select().from(chatAssistants).where(eq(chatAssistants.id, id)).get()
      return row ?? null
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'chat:assistants:create',
    async (
      _event,
      data: {
        name: string
        emoji?: string
        systemPrompt?: string
        description?: string
        modelId?: string
        providerId?: string
        sortOrder?: number
      }
    ) => {
      try {
        const id = `asst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const now = new Date().toISOString()
        db.insert(chatAssistants)
          .values({
            id,
            name: data.name,
            emoji: data.emoji || '💬',
            systemPrompt: data.systemPrompt || '',
            description: data.description || '',
            modelId: data.modelId || null,
            providerId: data.providerId || null,
            isPreset: false,
            sortOrder: data.sortOrder ?? 0,
            createdAt: now,
            updatedAt: now
          })
          .run()
        return db.select().from(chatAssistants).where(eq(chatAssistants.id, id)).get()
      } catch (error) {
        console.error('[chat:assistants:create]', error)
        throw error
      }
    }
  )

  ipcMain.handle('chat:assistants:update', async (_event, id: string, data: Record<string, unknown>) => {
    try {
      const now = new Date().toISOString()
      const updateData: Record<string, unknown> = { updatedAt: now }
      if (data.name !== undefined) updateData.name = data.name
      if (data.emoji !== undefined) updateData.emoji = data.emoji
      if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt
      if (data.description !== undefined) updateData.description = data.description
      if (data.modelId !== undefined) updateData.modelId = data.modelId
      if (data.providerId !== undefined) updateData.providerId = data.providerId
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
      db.update(chatAssistants)
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle update with dynamic fields
        .set(updateData as any)
        .where(eq(chatAssistants.id, id))
        .run()
      return db.select().from(chatAssistants).where(eq(chatAssistants.id, id)).get()
    } catch (error) {
      console.error('[chat:assistants:update]', error)
      throw error
    }
  })

  ipcMain.handle('chat:assistants:delete', async (_event, id: string) => {
    try {
      db.delete(chatAssistants).where(eq(chatAssistants.id, id)).run()
      return { deleted: true }
    } catch (error) {
      console.error('[chat:assistants:delete]', error)
      throw error
    }
  })
}
