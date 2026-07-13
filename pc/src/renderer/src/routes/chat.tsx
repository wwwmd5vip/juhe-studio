/**
 * 聊天页面
 * 1:1 复刻 Cherry Studio 的 Chat.tsx 布局架构
 *
 * 核心布局原则：
 * - column-reverse: 消息列表倒序渲染，浏览器原生保持底部
 * - min-h-0: 严格 flex 约束防止溢出
 * - justify-between: Messages 和 Inputbar 分离
 */

import { createFileRoute, useSearch } from '@tanstack/react-router'
import { Bot, BookOpen, MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AssistantSelector } from '@/components/chat/AssistantSelector'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageList } from '@/components/chat/MessageList'
import PromptSelectorDrawer from '@/components/prompts/PromptSelectorDrawer'
import { SessionList } from '@/components/chat/SessionList'
import { useChatStore } from '@/stores/chat'
import { useNetworkStore } from '@/stores/network'

export const Route = createFileRoute('/chat')({
  component: ChatPage
})

function ChatPage() {
  const search = useSearch({ from: '/chat' }) as { session?: string }
  const {
    selectSession,
    loadAssistants,
    selectAssistant,
    flushQueue,
    createSession,
    sessions,
    activeSessionId,
    activeAssistantId,
    messages
  } = useChatStore()
  const { isOnline } = useNetworkStore()
  const { t } = useTranslation()
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false)
  const activeSession = sessions.find((session) => session.id === activeSessionId)

  // Load assistants on mount
  useEffect(() => {
    loadAssistants()
  }, [loadAssistants])

  useEffect(() => {
    if (search.session) {
      selectSession(search.session)
    }
  }, [search.session, selectSession])

  // 网络恢复时自动发送队列消息
  useEffect(() => {
    if (isOnline) {
      flushQueue()
    }
  }, [isOnline, flushQueue])

  return (
    <div className='h-[calc(100vh-3rem)] flex overflow-hidden' style={{ background: 'var(--juhe-void)' }}>
      {/* Left sidebar - Session list */}
      <div className='w-72 shrink-0 border-r border-[var(--juhe-border)] flex flex-col'>
        <SessionList />
      </div>

      {/* Right panel - Chat area */}
      <div className='flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-[var(--juhe-void-2)]'>
        <header className='h-14 shrink-0 border-b border-[var(--juhe-border)] px-4 flex items-center justify-between'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--juhe-cyan)]/15 to-[var(--juhe-violet)]/15 text-[var(--juhe-cyan)] flex items-center justify-center border border-[var(--juhe-border)]'>
              {activeSession ? <Bot className='w-4 h-4' /> : <MessageSquare className='w-4 h-4' />}
            </div>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <h1 className='text-sm font-semibold truncate'>{activeSession?.title || t('chat.newChat')}</h1>
                {/* 智能体选择器 - 紧凑按钮+弹出面板 */}
                <AssistantSelector selectedId={activeAssistantId} onSelect={selectAssistant} />
                {/* 提示词库选择 */}
                <button
                  type='button'
                  onClick={() => setPromptDrawerOpen(true)}
                  className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--juhe-surface-2)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-cyan)] hover:border-[var(--juhe-cyan)]/30 transition-colors text-[11px]'
                  title={t('prompts.selectAgentPrompt')}
                >
                  <BookOpen className='w-3 h-3' />
                  {t('prompts.promptsBtn')}
                </button>
              </div>
              <p className='text-[11px] text-[var(--juhe-text-3)] truncate'>
                {activeSession?.modelId || t('chat.selectModelHint')} · {messages.length} {t('chat.messageCount')}
              </p>
            </div>
          </div>
          <div className='text-[11px] text-[var(--juhe-text-3)]'>{isOnline ? t('chat.online') : t('chat.offline')}</div>
        </header>
        {/* Main chat area: Messages + Inputbar */}
        <div className='flex-1 flex flex-col min-h-0'>
          {/* Messages container: flex-1 占据剩余空间，column-reverse 保持底部 */}
          <MessageList />
          {/* Inputbar: 固定在底部 */}
          <ChatInput />
        </div>
      </div>

      {/* Prompt selector drawer */}
      <PromptSelectorDrawer
        type='agent'
        open={promptDrawerOpen}
        onSelect={async (content) => {
          const sessionId = await createSession(undefined, undefined, content)
          selectSession(sessionId)
        }}
        onClose={() => setPromptDrawerOpen(false)}
      />
    </div>
  )
}
