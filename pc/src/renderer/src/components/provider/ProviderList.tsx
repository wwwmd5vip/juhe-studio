import { useProviderStore } from '@renderer/stores/providers'
import type { Provider } from '@shared/types/provider'
import { PROVIDER_PRESETS } from '@shared/utils/provider-presets'
import { ChevronRight, Copy, Edit, GripVertical, MoreVertical, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'

export function ProviderList() {
  const { t } = useTranslation()
  const {
    providers,
    isLoading,
    selectedProviderId,
    selectProvider,
    setShowAddModal,
    deleteProvider,
    duplicateProvider,
    setEditingProvider,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter
  } = useProviderStore()

  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>())

  useEffect(() => {
    if (!selectedProviderId) return
    const frame = requestAnimationFrame(() => {
      const el = itemRefs.current.get(selectedProviderId)
      const scroller = scrollerRef.current
      if (!el || !scroller) return
      const itemRect = el.getBoundingClientRect()
      const scrollerRect = scroller.getBoundingClientRect()
      const visible = itemRect.top >= scrollerRect.top && itemRect.bottom <= scrollerRect.bottom
      if (!visible) {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedProviderId])

  const providerModelsIndex = useMemo(() => {
    if (!searchQuery.trim()) return null
    const map = new Map<string, string>()
    for (const p of providers) {
      const names = p.models.map((m) => `${m.name} ${m.displayName ?? ''}`).join(' ')
      map.set(p.id, names)
    }
    return map
  }, [providers, searchQuery])

  const filteredProviders = useMemo(() => {
    const keywords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    return providers.filter((provider) => {
      if (filter === 'enabled' && !provider.isEnabled) return false
      if (filter === 'disabled' && provider.isEnabled) return false
      if (keywords.length === 0) return true
      const haystack = `${provider.name} ${providerModelsIndex?.get(provider.id) ?? ''}`.toLowerCase()
      return keywords.every((k) => haystack.includes(k))
    })
  }, [providers, filter, searchQuery, providerModelsIndex])

  const grouped = useMemo(() => {
    const byPreset = new Map<string, Provider[]>()
    const singles: Provider[] = []
    for (const p of filteredProviders) {
      const preset = p.presetId
      if (!preset) {
        singles.push(p)
        continue
      }
      const list = byPreset.get(preset) ?? []
      list.push(p)
      byPreset.set(preset, list)
    }
    return { byPreset, singles }
  }, [filteredProviders])

  const toggleGroup = useCallback((presetId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [presetId]: !prev[presetId] }))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setContextMenuId(null)
    setDeleteTargetId(id)
  }, [])

  const handleDuplicate = useCallback(
    async (id: string) => {
      await duplicateProvider(id)
      setContextMenuId(null)
    },
    [duplicateProvider]
  )

  const handleEdit = useCallback(
    (provider: Provider) => {
      setEditingProvider(provider)
      setContextMenuId(null)
    },
    [setEditingProvider]
  )

  const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }, [])

  const renderProviderRow = (provider: Provider, inGroup = false) => {
    const selected = provider.id === selectedProviderId
    const contextOpen = contextMenuId === provider.id
    const firstLetter = provider.name?.[0]?.toUpperCase() ?? '?'
    const preset = provider.presetId ? PROVIDER_PRESETS.find((p) => p.id === provider.presetId) : undefined

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
        key={provider.id}
        ref={(el) => setItemRef(provider.id, el)}
        className={`group/row relative flex items-center gap-2 px-3 py-2.5 text-sm transition-colors cursor-pointer
          ${selected ? 'bg-[var(--juhe-surface-2)]/60 text-[var(--juhe-text)]' : 'hover:bg-[var(--juhe-surface-2)]/30'}
          ${inGroup ? 'pl-9' : ''}`}
        onClick={() => selectProvider(provider.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenuId(provider.id)
        }}
      >
        <GripVertical
          size={14}
          className='shrink-0 text-[var(--juhe-text-3)]/40 opacity-0 group-hover/row:opacity-100'
        />
        <div
          className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
          style={{
            backgroundColor: stringToColor(preset?.name ?? provider.name),
            color: '#fff'
          }}
        >
          {firstLetter}
        </div>
        <div className='flex min-w-0 flex-1 flex-col'>
          <span className={`truncate ${selected ? 'font-medium' : ''}`}>{provider.name}</span>
          <span className='text-xs text-[var(--juhe-text-3)]'>
            {t('providerSettings.modelCount', { count: provider.models.length, defaultValue: '{{count}} models' })}
          </span>
        </div>
        {provider.isEnabled && (
          <span
            className='h-2 w-2 shrink-0 rounded-full bg-green-500'
            aria-label={t('providerSettings.enabled', { defaultValue: 'Enabled' })}
          />
        )}
        <div className='relative'>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              setContextMenuId(contextOpen ? null : provider.id)
            }}
            className='rounded-md p-1 text-[var(--juhe-text-3)] opacity-0 transition-colors hover:bg-[var(--juhe-surface-2)] group-hover/row:opacity-100'
          >
            <MoreVertical size={14} />
          </button>
          {contextOpen && (
            <div className='absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-1 shadow-md'>
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(provider)
                }}
                className='flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--juhe-surface-2)]'
              >
                <Edit size={12} />
                {t('providerSettings.edit')}
              </button>
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  handleDuplicate(provider.id)
                }}
                className='flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--juhe-surface-2)]'
              >
                <Copy size={12} />
                {t('providerSettings.duplicate')}
              </button>
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(provider.id)
                }}
                className='flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10'
              >
                <Trash2 size={12} />
                {t('providerSettings.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <aside className='flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--juhe-border)] bg-[var(--juhe-surface)]'>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-[var(--juhe-border)] px-4 py-3'>
        <h2 className='font-semibold text-[var(--juhe-text)]'>{t('providerSettings.title')}</h2>
      </div>

      {/* Search */}
      <div className='px-3 pt-3'>
        <div className='relative'>
          <Search size={14} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--juhe-text-3)]' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('providerSettings.searchProviders')}
            className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] py-1.5 pl-8 pr-7 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
          />
          {searchQuery && (
            <button
              type='button'
              onClick={() => setSearchQuery('')}
              className='absolute right-2 top-1/2 -translate-y-1/2 text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
            >
              <span className='sr-only'>{t('common.clear')}</span>
              <span className='text-xs'>×</span>
            </button>
          )}
          <button
            type='button'
            onClick={() => setShowAddModal(true)}
            className='absolute -right-7 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
            title={t('providerSettings.addProvider')}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className='flex gap-1 px-3 pb-2 pt-2'>
        {(['all', 'enabled', 'disabled'] as const).map((f) => (
          <button
            type='button'
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors
              ${filter === f ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground' : 'text-[var(--juhe-text-3)] hover:bg-[var(--juhe-surface-2)]/50 hover:text-[var(--juhe-text)]'}`}
          >
            {t(`providerSettings.${f}`)}
          </button>
        ))}
      </div>

      {/* List */}
      <div ref={scrollerRef} className='min-h-0 flex-1 overflow-y-auto px-2 pb-2'>
        {isLoading && <div className='px-3 py-4 text-sm text-[var(--juhe-text-3)]'>{t('common.loading')}</div>}

        {!isLoading && filteredProviders.length === 0 && (
          <div className='px-3 py-8 text-center text-sm text-[var(--juhe-text-3)]'>
            {t('providerSettings.noProviders')}
          </div>
        )}

        {!isLoading && (
          <div className='space-y-1'>
            {grouped.singles.map((p) => renderProviderRow(p))}
            {Array.from(grouped.byPreset.entries()).map(([presetId, members]) => {
              const preset = PROVIDER_PRESETS.find((p) => p.id === presetId)
              const label = preset?.name ?? presetId
              const expanded = searchQuery.trim().length > 0 ? true : (expandedGroups[presetId] ?? false)
              const containsSelected = members.some((m) => m.id === selectedProviderId)
              return (
                <div key={presetId} className='rounded-lg border border-transparent'>
                  <button
                    type='button'
                    onClick={() => toggleGroup(presetId)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors
                      ${containsSelected ? 'bg-[var(--juhe-surface-2)]/20' : 'hover:bg-[var(--juhe-surface-2)]/20'}`}
                  >
                    <ChevronRight
                      size={12}
                      className={`shrink-0 text-[var(--juhe-text-3)] transition-transform ${expanded ? 'rotate-90' : ''}`}
                    />
                    <div
                      className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold'
                      style={{
                        backgroundColor: stringToColor(label),
                        color: '#fff'
                      }}
                    >
                      {label[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className='flex-1 truncate text-left'>{label}</span>
                    <span className='rounded-full bg-[var(--juhe-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--juhe-text-3)]'>
                      {members.length}
                    </span>
                  </button>
                  {expanded && (
                    <div className='mt-0.5 space-y-0.5'>{members.map((m) => renderProviderRow(m, true))}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add button */}
      <div className='border-t border-[var(--juhe-border)] p-2'>
        <button
          type='button'
          onClick={() => setShowAddModal(true)}
          className='flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--juhe-border)] py-2 text-sm font-medium text-[var(--juhe-text-3)] transition-colors hover:border-[var(--juhe-cyan)] hover:text-[var(--juhe-cyan)]'
        >
          <Plus size={14} />
          {t('providerSettings.addProvider')}
        </button>
      </div>

      {/* Click outside to close context menu */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {contextMenuId && <div className='fixed inset-0 z-40' onClick={() => setContextMenuId(null)} />}

      <ConfirmModal
        open={deleteTargetId !== null}
        title={t('providerSettings.delete', { defaultValue: 'Delete Provider' }) as string}
        description={t('providerSettings.confirmDelete', { defaultValue: 'Delete this provider?' }) as string}
        confirmText={t('providerSettings.delete', { defaultValue: 'Delete' }) as string}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' }) as string}
        danger
        onConfirm={() => {
          if (deleteTargetId) {
            deleteProvider(deleteTargetId)
          }
          setDeleteTargetId(null)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </aside>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue} 70% 45%)`
}
