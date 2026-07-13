/**
 * 消息头部组件
 * 1:1 复刻 Cherry Studio 的 MessageHeader
 */

import type { ChatMessage } from '@shared/types/chat'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface MessageHeaderProps {
  message: ChatMessage
}

export function MessageHeader({ message }: MessageHeaderProps) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const avatarName = useMemo(() => {
    if (isUser) return t('chat.roles.user')[0]
    return t('chat.roles.assistant')[0]
  }, [isUser, t])

  const displayName = useMemo(() => {
    if (isUser) return t('chat.roles.user')
    return t('chat.roles.assistant')
  }, [isUser, t])

  const formattedTime = useMemo(() => {
    const date = new Date(message.createdAt)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [message.createdAt])

  return (
    <div className='message-header flex items-center gap-2.5 mb-2.5 relative'>
      {/* Avatar */}
      <div
        className={`w-[35px] h-[35px] rounded-[25%] shrink-0 flex items-center justify-center text-xs font-semibold cursor-pointer ${
          isUser
            ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground'
            : 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text)] border border-[var(--juhe-border)]'
        }`}
      >
        {avatarName}
      </div>

      {/* Name & Info */}
      <div className='flex flex-col justify-between flex-1'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold text-[var(--juhe-text)]'>{displayName}</span>
          {isAssistant && message.modelId && (
            <span className='text-[10px] text-[var(--juhe-text-3)]/70'>· {message.modelId}</span>
          )}
        </div>
        <div className='flex items-center gap-1 text-[10px] text-[var(--juhe-text-3)]/50'>
          <span>{formattedTime}</span>
          {isAssistant && message.tokensUsed && (
            <>
              <span>|</span>
              <span>{message.tokensUsed} tokens</span>
            </>
          )}
          {isAssistant && message.latency && (
            <>
              <span>|</span>
              <span>{message.latency}ms</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
