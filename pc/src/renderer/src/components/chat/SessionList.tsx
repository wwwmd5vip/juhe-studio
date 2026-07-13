import { MessageSquare, Plus, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/stores/chat'

export function SessionList() {
  const { sessions, activeSessionId, loadSessions, selectSession, createSession, deleteSession } = useChatStore()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // 按标题过滤会话
  const filteredSessions = searchQuery.trim()
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        s.modelId?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : sessions

  return (
    <div className='h-full flex flex-col' style={{ background: 'var(--juhe-void-2)' }}>
      <div className='flex items-center justify-between p-3 border-b' style={{ borderColor: 'var(--juhe-border)' }}>
        <div className='flex items-center gap-2 min-w-0'>
          <MessageSquare className='w-4 h-4 text-[var(--juhe-cyan)]' />
          <h2 className='text-sm font-semibold truncate' style={{ color: 'var(--juhe-text)' }}>
            {t('chat.chats')}
          </h2>
        </div>
        <button
          type='button'
          onClick={() => createSession()}
          className='p-1.5 rounded-md transition-colors hover:bg-[var(--juhe-surface)]'
          style={{ color: 'var(--juhe-text-3)' }}
          title={t('chat.newChat')}
        >
          <Plus className='w-4 h-4' />
        </button>
      </div>

      <div className='p-2 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--juhe-void)] border border-[var(--juhe-border)] focus-within:border-[var(--juhe-cyan)]/50 transition-colors'>
          <Search className='w-3.5 h-3.5 shrink-0' style={{ color: 'var(--juhe-text-3)' }} />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className='flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--juhe-text-3)]'
          />
          {searchQuery && (
            <button
              type='button'
              onClick={() => setSearchQuery('')}
              className='p-0.5 rounded hover:bg-[var(--juhe-surface)]'
            >
              <X className='w-3 h-3' style={{ color: 'var(--juhe-text-3)' }} />
            </button>
          )}
        </div>
      </div>

      <div className='flex-1 overflow-y-auto'>
        {filteredSessions.length === 0 ? (
          <div className='p-4 text-sm text-center' style={{ color: 'var(--juhe-text-3)' }}>
            {t('chat.noChats')}
          </div>
        ) : (
          <div className='space-y-0.5 p-1'>
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                  activeSessionId === session.id ? 'bg-[var(--juhe-surface-2)]' : 'hover:bg-[var(--juhe-surface)]'
                }`}
                style={{ color: activeSessionId === session.id ? 'var(--juhe-cyan)' : 'var(--juhe-text-2)' }}
              >
                <button
                  type='button'
                  className='flex flex-1 items-center gap-2 min-w-0 text-left'
                  onClick={() => selectSession(session.id)}
                >
                  <MessageSquare className='w-4 h-4 shrink-0 text-[var(--juhe-text-3)]' />
                  <div className='flex-1 min-w-0'>
                    <div className='truncate'>{session.title}</div>
                    <div className='text-[10px] text-[var(--juhe-text-3)] truncate'>
                      {session.modelId || t('chat.selectModelHint')}
                    </div>
                  </div>
                </button>
                <button
                  type='button'
                  onClick={() => deleteSession(session.id)}
                  className='p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] hover:bg-[rgba(255,45,149,0.1)]'
                >
                  <X className='w-3 h-3' />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
