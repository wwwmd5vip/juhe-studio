/**
 * 消息操作栏
 * 1:1 复刻 Cherry Studio 的 MessageMenubar
 *
 * 设计要点：
 * - 默认 opacity: 0，hover 时显示
 * - 最后一消息默认显示 (show class)
 * - flex-row-reverse 当最后一条且 plain 样式时
 */

import type { ChatMessage } from '@shared/types/chat'
import { Check, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface MessageMenubarProps {
  message: ChatMessage
  isLastMessage: boolean
  onCopy: () => void
  onRegenerate?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function MessageMenubar({
  message,
  isLastMessage,
  onCopy,
  onRegenerate,
  onEdit,
  onDelete
}: MessageMenubarProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const _isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const handleCopy = useCallback(() => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [onCopy])

  return (
    <div className={`menubar flex items-center gap-2 ${isLastMessage ? 'show' : ''}`}>
      {/* Copy */}
      <button
        type='button'
        onClick={handleCopy}
        className='message-action-button flex items-center justify-center w-[26px] h-[26px] rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-all duration-200'
        title={t('chat.copy')}
      >
        {copied ? <Check size={14} className='text-[var(--juhe-cyan)]' /> : <Copy size={14} />}
      </button>

      {/* Regenerate - 仅助手消息最后一条 */}
      {isAssistant && isLastMessage && onRegenerate && (
        <button
          type='button'
          onClick={onRegenerate}
          className='message-action-button flex items-center justify-center w-[26px] h-[26px] rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-all duration-200'
          title={t('chat.regenerate')}
        >
          <RotateCcw size={14} />
        </button>
      )}

      {/* Edit */}
      {onEdit && (
        <button
          type='button'
          onClick={onEdit}
          className='message-action-button flex items-center justify-center w-[26px] h-[26px] rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-all duration-200'
          title={t('chat.edit')}
        >
          <Pencil size={14} />
        </button>
      )}

      {/* Delete */}
      {onDelete && (
        <button
          type='button'
          onClick={onDelete}
          className='message-action-button flex items-center justify-center w-[26px] h-[26px] rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10 transition-all duration-200'
          title={t('chat.delete')}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
