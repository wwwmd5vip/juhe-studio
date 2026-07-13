/**
 * LLMNode - 大模型对话节点
 * 多轮对话、流式响应
 */

import { Bot, Send, User } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface LLMNodeProps {
  node: CanvasNode
  scale: number
  isSelected: boolean
  isRelated: boolean
  isConnectionTarget: boolean
  isConnecting: boolean
  onMouseDown: (event: React.MouseEvent, nodeId: string) => void
  onResize: (nodeId: string, width: number, height: number, position?: Position) => void
  onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void
  onSend?: (nodeId: string, message: string) => void
}

export function LLMNode(props: LLMNodeProps) {
  return (
    <CanvasNodeView
      data={props.node}
      scale={props.scale}
      isSelected={props.isSelected}
      isRelated={props.isRelated}
      isConnectionTarget={props.isConnectionTarget}
      isConnecting={props.isConnecting}
      onMouseDown={props.onMouseDown}
      onResize={props.onResize}
      onConnectStart={props.onConnectStart}
      onContextMenu={props.onContextMenu}
      renderContent={(node, theme) => <LLMContent node={node} theme={theme} onSend={props.onSend} />}
    />
  )
}

function LLMContent({
  node,
  theme,
  onSend
}: {
  node: CanvasNode
  theme: CanvasTheme
  onSend?: (nodeId: string, message: string) => void
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = node.metadata?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    onSend?.(node.id, input.trim())
    setInput('')
  }, [input, node.id, onSend])

  const status = node.metadata?.status

  return (
    <div className='flex h-full w-full flex-col pt-8'>
      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-3 py-2'>
        {messages.length === 0 ? (
          <div className='flex h-full items-center justify-center text-xs' style={{ color: theme.node.placeholder }}>
            {t('canvas.llm.startConversation')}
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={idx} className='mb-3'>
                <div className='flex items-start gap-2'>
                  <div
                    className='flex size-5 shrink-0 items-center justify-center rounded-full'
                    style={{ background: msg.role === 'user' ? '#3b82f6' : '#10b981' }}
                  >
                    {msg.role === 'user' ? (
                      <User className='size-3 text-white' />
                    ) : (
                      <Bot className='size-3 text-white' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='text-[10px] font-medium opacity-50' style={{ color: theme.node.muted }}>
                      {msg.role === 'user' ? t('canvas.llm.you') : t('canvas.llm.ai')}
                    </div>
                    <div
                      className='mt-0.5 whitespace-pre-wrap text-xs leading-relaxed'
                      style={{ color: theme.node.text }}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {status === 'running' && (
              <div className='flex items-center gap-2 text-xs' style={{ color: theme.node.muted }}>
                <div className='flex gap-0.5'>
                  <span className='animate-bounce'>●</span>
                  <span className='animate-bounce' style={{ animationDelay: '0.1s' }}>
                    ●
                  </span>
                  <span className='animate-bounce' style={{ animationDelay: '0.2s' }}>
                    ●
                  </span>
                </div>
                {t('canvas.nodeContent.generating')}
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className='flex items-center gap-2 border-t p-2' style={{ borderColor: theme.node.stroke }}>
        <input
          type='text'
          className='min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none'
          style={{ borderColor: theme.node.stroke, color: theme.node.text }}
          placeholder={t('canvas.llm.inputPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <button
          type='button'
          className='flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors'
          style={{ background: input.trim() ? theme.node.activeStroke : theme.node.stroke, color: theme.node.fill }}
          onClick={handleSend}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Send className='size-3.5' />
        </button>
      </div>
    </div>
  )
}
