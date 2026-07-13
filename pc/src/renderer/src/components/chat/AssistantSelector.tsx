/**
 * AssistantSelector.tsx — 聊天智能体选择器
 * 从 API 提示词广场获取 agent 类型提示词作为智能体列表
 */

import type { ChatAssistant } from '@shared/types/chat'
import type { PromptListItem } from '@shared/types/prompts'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  /** 当前选中的助手 */
  selectedId?: string | null
  /** 选中变更 */
  onSelect: (assistant: ChatAssistant | null) => void
  /** 触发按钮额外的 class */
  className?: string
}

function promptToAssistant(p: PromptListItem, index: number): ChatAssistant {
  return {
    id: `prompt-${p.id}`,
    name: p.title || 'Untitled',
    emoji: '🤖',
    systemPrompt: '', // 按需加载，选中时 fetch detail
    description: (p.tags || []).join(', ') || 'Agent',
    isPreset: false,
    sortOrder: index,
    createdAt: p.created_at || new Date().toISOString(),
    updatedAt: p.updated_at || new Date().toISOString()
  }
}

export function AssistantSelector({ selectedId, onSelect, className = '' }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selecting, setSelecting] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 从 API 提示词广场获取 agent 类型提示词（仅在面板打开时请求）
  const { data, isLoading, isError } = useQuery({
    queryKey: ['promptLibrary', 'list', 'agent'],
    queryFn: () => window.api.promptLibrary.list({ type: 'agent', pageSize: 100 }),
    enabled: open,
    staleTime: 60_000,
    retry: false
  })

  const allAssistants = useMemo(() => {
    const items = data?.data || []
    return items.map((p, i) => promptToAssistant(p, i))
  }, [data])

  const filtered = useMemo(() => {
    if (!search.trim()) return allAssistants
    const q = search.toLowerCase()
    return allAssistants.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    )
  }, [allAssistants, search])

  const selected = useMemo(
    () => allAssistants.find((a) => a.id === selectedId) ?? null,
    [allAssistants, selectedId]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback(
    async (assistant: ChatAssistant) => {
      setSelecting(true)
      try {
        // 获取提示词详情以拿到 systemPrompt
        const promptId = Number(assistant.id.replace('prompt-', ''))
        const result = await window.api.promptLibrary.get(promptId)
        const fullAssistant: ChatAssistant = {
          ...assistant,
          systemPrompt: result.rendered || result.item.content || ''
        }
        onSelect(fullAssistant)
      } catch (err) {
        console.error('[AssistantSelector] Failed to fetch prompt detail:', err)
        onSelect(assistant)
      } finally {
        setSelecting(false)
        setOpen(false)
        setSearch('')
      }
    },
    [onSelect]
  )

  const handleReset = useCallback(() => {
    onSelect(null)
    setOpen(false)
    setSearch('')
  }, [onSelect])

  return (
    <div className='relative'>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 h-7 px-2 rounded-full text-xs font-medium transition-all duration-200 border ${className}`}
        style={{
          background: open ? 'var(--juhe-surface-2)' : 'transparent',
          color: selected ? 'var(--juhe-text)' : 'var(--juhe-text-2)',
          borderColor: open ? 'var(--juhe-cyan)' : 'var(--juhe-border)'
        }}
      >
        <span className='text-sm leading-none'>{selected?.emoji || '💬'}</span>
        <span className='max-w-32 truncate'>
          {selecting ? '…' : selected?.name || t('chat.assistant.default')}
        </span>
        <ChevronDown
          className='w-3 h-3 transition-transform duration-200'
          style={{
            color: 'var(--juhe-text-3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>

      {/* Popover panel */}
      {open && (
        <div
          ref={panelRef}
          className='absolute top-full left-0 mt-1 w-72 rounded-2xl border shadow-xl z-50 overflow-hidden'
          style={{
            background: 'var(--juhe-surface)',
            borderColor: 'var(--juhe-border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4)'
          }}
        >
          {/* Search */}
          <div className='flex items-center gap-2 px-3 py-2.5 border-b' style={{ borderColor: 'var(--juhe-border)' }}>
            <Search className='w-3.5 h-3.5 shrink-0' style={{ color: 'var(--juhe-text-3)' }} />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('chat.assistant.search')}
              className='flex-1 bg-transparent text-xs outline-none'
              style={{ color: 'var(--juhe-text)' }}
            />
          </div>

          {/* List */}
          <div className='max-h-64 overflow-y-auto p-1'>
            {/* Reset option */}
            <button
              type='button'
              onClick={handleReset}
              className='flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs transition-all duration-200 hover:bg-[var(--juhe-surface-2)]'
              style={{ color: 'var(--juhe-text-3)' }}
            >
              <span className='text-sm w-5 text-center'>💬</span>
              <span>{t('chat.assistant.default')}</span>
            </button>

            {/* Divider */}
            <div className='h-px mx-2 my-1' style={{ background: 'var(--juhe-border)' }} />

            {isLoading && (
              <div className='flex items-center justify-center py-6'>
                <Loader2 className='w-4 h-4 animate-spin' style={{ color: 'var(--juhe-text-3)' }} />
              </div>
            )}

            {isError && !isLoading && (
              <div className='px-3 py-6 text-center text-[11px]' style={{ color: 'var(--juhe-text-3)' }}>
                {t('chat.assistant.loadError')}
              </div>
            )}

            {!isLoading && !isError &&
              filtered.map((assistant) => {
                const isActive = assistant.id === selectedId
                return (
                  <button
                    key={assistant.id}
                    type='button'
                    onClick={() => handleSelect(assistant)}
                    disabled={selecting}
                    className='flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-left transition-all duration-200 disabled:opacity-50'
                    style={{
                      background: isActive ? 'rgba(0,240,255,0.08)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(0,240,255,0.2)' : 'transparent'}`
                    }}
                  >
                    <span className='text-base w-5 text-center shrink-0'>{assistant.emoji}</span>
                    <div className='min-w-0 flex-1'>
                      <div
                        className='text-xs font-semibold truncate'
                        style={{ color: isActive ? 'var(--juhe-cyan)' : 'var(--juhe-text)' }}
                      >
                        {assistant.name}
                      </div>
                      <div className='text-[10px] truncate' style={{ color: 'var(--juhe-text-3)' }}>
                        {assistant.description}
                      </div>
                    </div>
                  </button>
                )
              })}

            {!isLoading && !isError && filtered.length === 0 && (
              <div className='px-3 py-6 text-center text-[11px]' style={{ color: 'var(--juhe-text-3)' }}>
                {t('chat.assistant.noResults')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
