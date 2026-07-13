/**
 * 消息项组件
 * 1:1 复刻 Cherry Studio 的 Message 组件架构
 */

import type { ChatMessage } from '@shared/types/chat'
import { useCallback, useRef, useState } from 'react'
import { MessageBlocks } from './MessageBlocks'
import { MessageEditor } from './MessageEditor'
import { MessageHeader } from './MessageHeader'
import { MessageMenubar } from './MessageMenubar'

interface MessageItemProps {
  message: ChatMessage
  isLast?: boolean
  onRegenerate?: (messageId: string) => void
  onEdit?: (messageId: string, content: string) => void
  onDelete?: (messageId: string) => void
}

export function MessageItem({ message, isLast, onRegenerate, onEdit, onDelete }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isSystem = message.role === 'system'
  const isProcessing = message.status === 'sending' || message.status === 'streaming'
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = message.content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }, [message.content])

  const handleRegenerate = useCallback(() => {
    onRegenerate?.(message.id)
  }, [message.id, onRegenerate])

  const handleEditStart = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleEditSave = useCallback(
    (content: string) => {
      onEdit?.(message.id, content)
      setIsEditing(false)
    },
    [message.id, onEdit]
  )

  const handleEditResend = useCallback(
    (content: string) => {
      onEdit?.(message.id, content)
      setIsEditing(false)
      onRegenerate?.(message.id)
    },
    [message.id, onEdit, onRegenerate]
  )

  const handleEditCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleDelete = useCallback(() => {
    onDelete?.(message.id)
  }, [message.id, onDelete])

  if (isSystem) {
    return (
      <div className='flex justify-center my-2'>
        <div className='px-3 py-1 rounded-full bg-[var(--juhe-surface-2)]/50 text-xs text-[var(--juhe-text-3)]'>
          {message.content}
        </div>
      </div>
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className={`group flex flex-col w-full py-2.5 px-3 transition-colors duration-200 rounded-[10px] relative ${
        isHovered ? 'bg-[var(--juhe-surface-2)]/15' : ''
      } ${isUser ? 'message-user' : 'message-assistant'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Message Header: Avatar + Name + Time */}
      <MessageHeader message={message} />

      {/* Message Editor (edit mode) */}
      {isEditing && (
        <div className='ml-[46px] mt-1'>
          <MessageEditor
            message={message}
            onSave={handleEditSave}
            onResend={isUser ? handleEditResend : undefined}
            onCancel={handleEditCancel}
          />
        </div>
      )}

      {/* Message Content (view mode) */}
      {!isEditing && (
        <>
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className='flex flex-wrap gap-2 mb-2 ml-[46px]'>
              {message.attachments.map((att, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={index} className='rounded-lg overflow-hidden border border-[var(--juhe-border)]/50'>
                  {att.type === 'image' ? (
                    <img
                      src={att.url}
                      alt='Attachment'
                      className='max-w-[200px] max-h-[150px] object-cover'
                      loading='lazy'
                    />
                  ) : (
                    <div className='flex items-center gap-2 px-3 py-2 bg-[var(--juhe-surface-2)]/50 text-xs'>
                      {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                      <svg
                        className='w-4 h-4 text-[var(--juhe-text-3)]'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                        />
                      </svg>
                      <span className='max-w-[150px] truncate'>{att.name || 'File'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div ref={contentRef} className='message-content-container ml-[46px] max-w-full'>
            <MessageBlocks message={message} isStreaming={isProcessing} />
          </div>

          {/* Menubar */}
          {!isProcessing && (
            <div className='MessageFooter ml-[46px] mt-0.5'>
              <MessageMenubar
                message={message}
                isLastMessage={isLast || false}
                onCopy={handleCopy}
                onRegenerate={isAssistant && isLast ? handleRegenerate : undefined}
                onEdit={handleEditStart}
                onDelete={handleDelete}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
