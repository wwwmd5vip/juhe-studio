/**
 * 消息编辑器组件
 * 1:1 复刻 Cherry Studio 的 MessageEditor
 */

import type { ChatMessage, MessageBlock } from '@shared/types/chat'
import { Save, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface MessageEditorProps {
  message: ChatMessage
  onSave: (content: string, blocks?: MessageBlock[]) => void
  onResend?: (content: string, blocks?: MessageBlock[]) => void
  onCancel: () => void
}

export function MessageEditor({ message, onSave, onResend, onCancel }: MessageEditorProps) {
  const { t } = useTranslation()
  const [editContent, setEditContent] = useState(message.content)
  const [isProcessing, setIsProcessing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isUser = message.role === 'user'

  // 自动聚焦并滚动到底部
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }

    const isEnterPressed = event.key === 'Enter' && !event.nativeEvent.isComposing
    if (isEnterPressed) {
      if (!event.shiftKey && isUser && onResend) {
        event.preventDefault()
        handleResend()
        return
      }
      if (!event.shiftKey && !isUser) {
        event.preventDefault()
        handleSave()
        return
      }
    }
  }

  const handleSave = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      onSave(editContent.trim())
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResend = async () => {
    if (isProcessing || !onResend) return
    setIsProcessing(true)
    try {
      onResend(editContent.trim())
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className='space-y-2'>
      {/* Editor Container */}
      <div className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)]'>
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className='w-full px-4 py-3 rounded-xl bg-transparent text-sm resize-none min-h-[80px] max-h-[300px] focus:outline-none text-[var(--juhe-text)]'
          spellCheck={false}
        />
      </div>

      {/* Action Bar */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1'>
          {/* Attachment hint for user messages */}
          {isUser && (
            <span className='text-[10px] text-[var(--juhe-text-3)]/60'>Shift+Enter 换行 · Enter 重新发送</span>
          )}
          {!isUser && <span className='text-[10px] text-[var(--juhe-text-3)]/60'>Shift+Enter 换行 · Enter 保存</span>}
        </div>

        <div className='flex items-center gap-1.5'>
          {/* Cancel */}
          <button
            type='button'
            onClick={onCancel}
            className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X size={14} />
            <span>{t('common.cancel')}</span>
          </button>

          {/* Save */}
          <button
            type='button'
            onClick={handleSave}
            disabled={isProcessing || !editContent.trim()}
            className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors'
          >
            <Save size={14} />
            <span>{t('common.save')}</span>
          </button>

          {/* Resend - only for user messages */}
          {isUser && onResend && (
            <button
              type='button'
              onClick={handleResend}
              disabled={isProcessing || !editContent.trim()}
              className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors'
            >
              <Send size={14} />
              <span>{t('chat.regenerate')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
