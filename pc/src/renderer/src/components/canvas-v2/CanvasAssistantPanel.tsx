/**
 * CanvasAssistantPanel.tsx - 画布助手聊天面板
 * 右侧可折叠面板，包含 AI 对话、工具调用可视化、快速操作
 */

import { Bot, LayoutGrid, Search, Square, Trash2, Type, Wand2, X } from 'lucide-react'
import { forwardRef, type KeyboardEvent, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import { type CanvasAssistantMessage, useCanvasAssistant } from './hooks/useCanvasAssistant'
import type { CanvasConnection, CanvasNode } from './types'

interface CanvasAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  onNodesChange: (nodes: CanvasNode[]) => void
  onConnectionsChange: (connections: CanvasConnection[]) => void
  onSelectionChange: (ids: string[]) => void
  providerId: string
  modelId: string
  providers?: Array<{ id: string; name: string }>
  models?: Array<{ id: string; name: string; displayName?: string }>
  onProviderChange?: (id: string) => void
  onModelChange?: (id: string) => void
  onOpenPromptLibrary?: () => void
}

export interface CanvasAssistantPanelHandle {
  sendText: (text: string) => void
}

export const CanvasAssistantPanel = forwardRef<CanvasAssistantPanelHandle, CanvasAssistantPanelProps>(
  function CanvasAssistantPanel(
    {
      isOpen,
      onClose,
      nodes,
      connections,
      onNodesChange,
      onConnectionsChange,
      onSelectionChange,
      providerId,
      modelId,
      providers,
      models,
      onProviderChange,
      onModelChange,
      onOpenPromptLibrary
    }: CanvasAssistantPanelProps,
    ref
  ) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const { messages, isThinking, streamingContent, error, sendMessage, stopGeneration, clearMessages, quickAction } =
      useCanvasAssistant(nodes, connections, onNodesChange, onConnectionsChange, onSelectionChange, providerId, modelId)

    // Theme
    const themeResolved = useThemeStore((s) => s.resolved)
    const t = canvasThemes[themeResolved]
    const accent = '#2f80ff'
    const colorBorder = t.toolbar.border
    const colorSurface = t.node.panel
    const colorText = t.node.text
    const colorMuted = t.node.muted
    const colorHover = t.toolbar.itemHover
    const colorBg = t.node.fill

    // Auto-scroll to bottom
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    // Focus input on open
    useEffect(() => {
      if (isOpen) {
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }, [isOpen])

    const handleSend = () => {
      const trimmed = input.trim()
      if (!trimmed || isThinking) return
      sendMessage(trimmed)
      setInput('')
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    // Expose sendText to parent through ref
    useImperativeHandle(
      ref,
      () => ({
        sendText: (text: string) => {
          setInput(text)
          // Auto-send on next tick after state update
          setTimeout(() => {
            sendMessage(text)
            setInput('')
          }, 50)
        }
      }),
      [sendMessage]
    )

    if (!isOpen) return null

    return (
      <div
        className='flex flex-col h-full w-[340px] border-l backdrop-blur'
        style={{ borderColor: colorBorder, background: colorSurface }}
      >
        {/* Header */}
        <div
          className='flex items-center justify-between px-3 py-2 shrink-0'
          style={{ borderBottom: `1px solid ${colorBorder}` }}
        >
          <div className='flex items-center gap-2'>
            <Bot className='w-4 h-4' style={{ color: accent }} />
            <span className='text-sm font-medium' style={{ color: colorText }}>
              画布助手
            </span>
            <span
              className='text-[10px] px-1.5 py-0.5 rounded-full'
              style={{ background: `${accent}1a`, color: accent }}
            >
              AI
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <button
              type='button'
              onClick={clearMessages}
              className='p-1.5 rounded transition-colors'
              style={{ color: colorMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colorHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              title='清除对话'
            >
              <Trash2 className='w-3.5 h-3.5' />
            </button>
            <button
              type='button'
              onClick={onClose}
              className='p-1.5 rounded transition-colors'
              style={{ color: colorMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colorHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>

        {/* Provider/Model selector */}
        {providers && providers.length > 0 && (
          <div className='flex gap-1.5 px-3 py-1.5 shrink-0' style={{ borderBottom: `1px solid ${colorBorder}` }}>
            <select
              value={providerId}
              onChange={(e) => onProviderChange?.(e.target.value)}
              className='flex-1 min-w-0 rounded-md border px-2 py-1 text-[10px] outline-none cursor-pointer'
              style={{ borderColor: colorBorder, background: colorBg, color: colorText }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {models && models.length > 0 && (
              <select
                value={modelId}
                onChange={(e) => onModelChange?.(e.target.value)}
                className='flex-1 min-w-0 rounded-md border px-2 py-1 text-[10px] outline-none cursor-pointer'
                style={{ borderColor: colorBorder, background: colorBg, color: colorText }}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName || m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Messages */}
        <div className='flex-1 overflow-y-auto px-3 py-2 space-y-3 thin-scrollbar'>
          {messages.length === 0 && !streamingContent && (
            <div
              className='flex flex-col items-center justify-center h-full text-center gap-3 px-4'
              style={{ color: colorMuted }}
            >
              <Bot className='w-10 h-10 opacity-20' />
              <div>
                <p className='text-sm font-medium'>你好！我是画布助手</p>
                <p className='text-xs mt-1 opacity-70'>
                  我可以在画布上创建节点、配置生成、整理布局。
                  <br />
                  试试下面的快速操作吧！
                </p>
              </div>

              {/* Quick Actions */}
              <div className='grid grid-cols-2 gap-2 w-full mt-2'>
                <button
                  type='button'
                  onClick={() => quickAction('text2img')}
                  className='flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-colors'
                  style={{ borderColor: colorBorder, color: colorMuted, background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colorHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Wand2 className='w-3 h-3' />
                  文生图流程
                </button>
                <button
                  type='button'
                  onClick={() => quickAction('text')}
                  className='flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-colors'
                  style={{ borderColor: colorBorder, color: colorMuted, background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colorHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Type className='w-3 h-3' />
                  添加文本
                </button>
                <button
                  type='button'
                  onClick={() => quickAction('layout')}
                  className='flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-colors'
                  style={{ borderColor: colorBorder, color: colorMuted, background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colorHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <LayoutGrid className='w-3 h-3' />
                  整理布局
                </button>
                <button
                  type='button'
                  onClick={onOpenPromptLibrary}
                  className='flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-colors'
                  style={{ borderColor: colorBorder, color: colorMuted, background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colorHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Search className='w-3 h-3' />
                  提示词库
                </button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <AssistantMessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className='flex gap-2'>
              <div
                className='w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5'
                style={{ background: `${accent}1a`, color: accent }}
              >
                <Bot className='w-3.5 h-3.5' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='text-xs whitespace-pre-wrap leading-relaxed' style={{ color: colorText }}>
                  {streamingContent}
                  <span
                    className='inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle'
                    style={{ background: accent }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className='px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400'>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className='px-3 py-2 shrink-0' style={{ borderTop: `1px solid ${colorBorder}` }}>
          <div className='flex gap-2 items-end'>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isThinking ? 'AI 正在思考...' : '描述你想在画布上做什么...'}
              disabled={isThinking}
              rows={2}
              className='flex-1 resize-none rounded-lg border px-3 py-1.5 text-xs focus:outline-none disabled:opacity-50 transition-colors'
              style={{ borderColor: colorBorder, background: colorBg, color: colorText }}
            />
            {isThinking ? (
              <button
                type='button'
                onClick={stopGeneration}
                className='p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0'
                title='停止生成'
              >
                <Square className='w-4 h-4' />
              </button>
            ) : (
              <button
                type='button'
                onClick={handleSend}
                disabled={!input.trim()}
                className='p-2 rounded-lg text-white hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0'
                style={{ background: accent }}
              >
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                <svg className='w-4 h-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M22 2L11 13' />
                  <path d='M22 2L15 22L11 13L2 9L22 2Z' />
                </svg>
              </button>
            )}
          </div>
          <div className='text-[10px] mt-1.5 text-center' style={{ color: colorMuted, opacity: 0.4 }}>
            Enter 发送 · Shift+Enter 换行
          </div>
        </div>
      </div>
    )
  }
)

// ---- Message Bubble ----

function AssistantMessageBubble({ message }: { message: CanvasAssistantMessage }) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const t = canvasThemes[themeResolved]
  const accent = '#2f80ff'

  if (message.role === 'system') {
    return (
      <div className='px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 text-center'>
        {message.content}
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div
          className='w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5'
          style={{ background: `${accent}1a`, color: accent }}
        >
          <Bot className='w-3.5 h-3.5' />
        </div>
      )}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div
          className='text-xs leading-relaxed whitespace-pre-wrap'
          style={
            isUser
              ? {
                  background: accent,
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '0.75rem 0.75rem 0.25rem 0.75rem'
                }
              : { color: t.node.text }
          }
        >
          {message.content}
        </div>

        {/* Tool Call Results */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className='mt-1.5 space-y-1'>
            {message.toolCalls.map((tc) => (
              <div
                key={tc.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${
                  tc.result?.success
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {tc.result?.success ? (
                  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed
<svg
                    className='w-3 h-3 shrink-0'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                  >
                    <path d='M20 6L9 17L4 12' />
                  </svg>
                ) : (
                  <X className='w-3 h-3 shrink-0' />
                )}
                <span className='truncate'>{toolCallLabel(tc.name, tc.params)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div
          className='w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5'
          style={{ background: `${accent}33`, color: accent }}
        >
          <span className='text-[10px] font-semibold'>你</span>
        </div>
      )}
    </div>
  )
}

// ---- Tool Call Label ----

function toolCallLabel(name: string, params: Record<string, unknown>): string {
  switch (name) {
    case 'canvas_create_node':
      return `创建节点: ${params.type} "${params.title || ''}"`
    case 'canvas_create_text_node':
      return `创建文本节点`
    case 'canvas_create_config_node':
      return `创建生成配置: ${(params.prompt as string)?.slice(0, 30) || ''}...`
    case 'canvas_create_image_prompt_flow':
      return `创建文生图工作流`
    case 'canvas_add_image_node':
      return `添加图片节点: ${params.title || ''}`
    case 'canvas_delete_nodes': {
      const ids = params.ids as string[]
      return `删除 ${ids?.length || 0} 个节点`
    }
    case 'canvas_move_nodes': {
      const moves = params.moves as Array<unknown>
      return `移动 ${moves?.length || 0} 个节点`
    }
    case 'canvas_resize_node':
      return `调整节点大小: ${params.width}x${params.height}`
    case 'canvas_connect_nodes':
      return `连接节点`
    case 'canvas_update_node':
      return `更新节点: ${params.id}`
    case 'canvas_select_nodes':
      return `选中 ${(params.ids as string[])?.length || 0} 个节点`
    case 'canvas_set_viewport':
      return `设置视口`
    case 'canvas_run_generation':
    case 'canvas_generate_image':
      return `触发生成: ${params.nodeId}`
    default:
      return name
  }
}
