import type { Memory, MemoryStatus, MemoryType } from '@shared/types/memory'
import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  Globe,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  User
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMemoryStore } from '@/stores/memory'

export const Route = createFileRoute('/memory')({
  component: MemoryPage
})

const TYPE_ICONS: Record<MemoryType, React.ReactNode> = {
  preference: <Settings className='w-3.5 h-3.5' />,
  profile: <User className='w-3.5 h-3.5' />,
  episodic_event: <Calendar className='w-3.5 h-3.5' />,
  semantic_fact: <BookOpen className='w-3.5 h-3.5' />,
  procedural_rule: <Target className='w-3.5 h-3.5' />
}

const TYPE_COLORS: Record<MemoryType, string> = {
  preference: 'bg-[var(--juhe-amber)]/10 text-[var(--juhe-amber)]',
  profile: 'bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]',
  episodic_event: 'bg-[var(--juhe-emerald)]/10 text-[var(--juhe-emerald)]',
  semantic_fact: 'bg-[var(--juhe-violet)]/10 text-[var(--juhe-violet)]',
  procedural_rule: 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'
}

const STATUS_ICONS: Record<MemoryStatus, React.ReactNode> = {
  active: <CheckCircle className='w-3.5 h-3.5 text-[var(--juhe-emerald)]' />,
  expired: <Clock className='w-3.5 h-3.5 text-amber-500' />,
  deleted: <AlertCircle className='w-3.5 h-3.5 text-[var(--juhe-magenta)]' />
}

function MemoryPage() {
  const { t } = useTranslation()
  const { memories, isLoading, loadMemories, searchMemory, deleteMemory, expireMemory } = useMemoryStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<MemoryType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<MemoryStatus | 'all'>('active')
  const [_isModalOpen, _setIsModalOpen] = useState(false)

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  const handleSearch = useCallback(async () => {
    await searchMemory({
      query: searchQuery || undefined,
      types: filterType === 'all' ? undefined : [filterType]
    })
  }, [searchQuery, filterType, searchMemory])

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300)
    return () => clearTimeout(timer)
  }, [handleSearch])

  const filteredMemories = memories.filter((m) => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false
    return true
  })

  const formatContent = (memory: Memory): string => {
    try {
      if (typeof memory.content === 'string') {
        const parsed = JSON.parse(memory.content)
        return parsed.statement || parsed.summary || JSON.stringify(parsed)
      }
      return JSON.stringify(memory.content)
    } catch {
      return String(memory.content)
    }
  }

  return (
    <div className='h-full flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='h-14 border-b border-[var(--juhe-border)] flex items-center justify-between px-4 shrink-0'>
        <div className='flex items-center gap-2'>
          <Brain className='w-5 h-5 text-[var(--juhe-cyan)]' />
          <h1 className='font-semibold'>{t('memory.title')}</h1>
          <span className='text-xs text-[var(--juhe-text-3)] ml-2'>
            ({memories.filter((m) => m.status === 'active').length} {t('memory.active')})
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className='px-4 py-2 border-b border-[var(--juhe-border)] flex flex-wrap items-center gap-2'>
        <div className='relative flex-1 min-w-[200px]'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('memory.search')}
            className='w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as MemoryType | 'all')}
          className='text-xs px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none'
        >
          <option value='all'>{t('memory.allTypes')}</option>
          <option value='preference'>{t('memory.type.preference')}</option>
          <option value='profile'>{t('memory.type.profile')}</option>
          <option value='episodic_event'>{t('memory.type.episodic')}</option>
          <option value='semantic_fact'>{t('memory.type.fact')}</option>
          <option value='procedural_rule'>{t('memory.type.rule')}</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as MemoryStatus | 'all')}
          className='text-xs px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none'
        >
          <option value='all'>{t('memory.allStatus')}</option>
          <option value='active'>{t('memory.status.active')}</option>
          <option value='expired'>{t('memory.status.expired')}</option>
          <option value='deleted'>{t('memory.status.deleted')}</option>
        </select>
      </div>

      {/* Memory List */}
      <div className='flex-1 overflow-y-auto p-4'>
        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <Sparkles className='w-5 h-5 animate-spin text-[var(--juhe-cyan)]' />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className='text-center py-12 text-[var(--juhe-text-3)]'>
            <Brain className='w-10 h-10 mx-auto mb-3 opacity-30' />
            <p className='text-sm'>{t('memory.empty')}</p>
            <p className='text-xs mt-1'>{t('memory.emptyHint')}</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {filteredMemories.map((memory) => (
              <div
                key={memory.id}
                className={`group rounded-lg border p-3 transition-all ${
                  memory.status === 'active'
                    ? 'border-[var(--juhe-border)] bg-[var(--juhe-surface)]'
                    : memory.status === 'expired'
                      ? 'border-[var(--juhe-amber)]/20 bg-[var(--juhe-amber)]/5'
                      : 'border-[var(--juhe-magenta)]/20 bg-[var(--juhe-magenta)]/5 opacity-60'
                }`}
              >
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <div className={`p-1 rounded-md ${TYPE_COLORS[memory.type]}`}>{TYPE_ICONS[memory.type]}</div>
                    <div className='min-w-0'>
                      <div className='flex items-center gap-1.5'>
                        <span className='text-xs font-medium'>{t(`memory.type.${memory.type}`)}</span>
                        {STATUS_ICONS[memory.status]}
                      </div>
                      <div className='text-sm mt-0.5 line-clamp-2'>{formatContent(memory)}</div>
                    </div>
                  </div>

                  <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2'>
                    {memory.status === 'active' && (
                      <button
                        type='button'
                        onClick={() => expireMemory(memory.id)}
                        className='p-1 rounded hover:bg-[var(--juhe-amber)]/10 text-[var(--juhe-amber)]'
                        title={t('memory.expire')}
                      >
                        <Clock className='w-3.5 h-3.5' />
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => deleteMemory(memory.id)}
                      className='p-1 rounded hover:bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'
                      title={t('common.delete')}
                    >
                      <Trash2 className='w-3.5 h-3.5' />
                    </button>
                  </div>
                </div>

                <div className='flex items-center gap-2 mt-2 text-[10px] text-[var(--juhe-text-3)]'>
                  <span className='flex items-center gap-0.5'>
                    {memory.scope === 'global' ? <Globe className='w-3 h-3' /> : <User className='w-3 h-3' />}
                    {memory.scope}
                  </span>
                  <span>·</span>
                  <span>
                    {t('memory.confidence')}: {memory.confidence}%
                  </span>
                  <span>·</span>
                  <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
                  {memory.sourceType === 'chat' && (
                    <>
                      <span>·</span>
                      <span className='flex items-center gap-0.5'>
                        <MessageSquare className='w-3 h-3' />
                        {t('memory.fromChat')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
