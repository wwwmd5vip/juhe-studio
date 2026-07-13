import type { PresetCategory, PresetTag } from '@shared/types/prompt-system'
import { getPopularTags, getTagsByCategory, presetCategories, presetTags, searchTags } from '@shared/utils/preset-tags'
import type { LucideIcon } from 'lucide-react'
import {
  Brush,
  Camera,
  ChevronRight,
  Clock,
  Cloud,
  Droplets,
  Flame,
  Focus,
  Mountain,
  Move,
  Palette,
  Search,
  Sparkles,
  Sun,
  User,
  X
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ICON_MAP: Record<string, LucideIcon> = {
  Palette,
  Brush,
  Camera,
  Sun,
  Sparkles,
  Droplets,
  Cloud,
  Focus,
  User,
  Mountains: Mountain,
  Move,
  Clock
}

interface PresetPanelProps {
  onInsert: (text: string) => void
  onClose: () => void
}

export default function PresetPanel({ onInsert, onClose }: PresetPanelProps) {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState<PresetCategory | 'popular'>('popular')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())

  const displayedTags = useMemo(() => {
    if (searchQuery.trim()) {
      return searchTags(searchQuery)
    }
    if (activeCategory === 'popular') {
      return getPopularTags(24)
    }
    return getTagsByCategory(activeCategory)
  }, [activeCategory, searchQuery])

  const toggleTag = (tag: PresetTag) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag.id)) {
        next.delete(tag.id)
      } else {
        next.add(tag.id)
      }
      return next
    })
  }

  const handleInsertSelected = () => {
    const tags = presetTags.filter((t) => selectedTags.has(t.id))
    const text = tags.map((t) => t.en).join(', ')
    if (text) onInsert(text)
    setSelectedTags(new Set())
  }

  return (
    <div className='flex flex-col h-full glass-card border-l border-[var(--juhe-border)]'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <h3 className='font-semibold text-sm text-[var(--juhe-text)]'>{t('generate.presetPanel.title')}</h3>
        <button
          type='button'
          onClick={onClose}
          className='p-1 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors text-[var(--juhe-text-2)]'
        >
          <X className='w-4 h-4' />
        </button>
      </div>

      {/* Search */}
      <div className='px-3 py-2'>
        <div className='relative'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('generate.presetPanel.searchPlaceholder')}
            className='w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--juhe-surface-2)] rounded-md border-0 text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30 outline-none'
          />
        </div>
      </div>

      {/* Categories */}
      {!searchQuery && (
        <div className='flex gap-1 px-3 pb-2 overflow-x-auto'>
          <button
            type='button'
            onClick={() => setActiveCategory('popular')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              activeCategory === 'popular'
                ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
            }`}
          >
            <Flame className='w-3 h-3' />
            {t('generate.presetPanel.hot')}
          </button>
          {presetCategories.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || Palette
            return (
              <button
                type='button'
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                    : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                }`}
              >
                <Icon className='w-3 h-3' />
                {cat.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Tags Grid */}
      <div className='flex-1 overflow-y-auto px-3 py-2'>
        <div className='flex flex-wrap gap-1.5'>
          {displayedTags.map((tag) => {
            const isSelected = selectedTags.has(tag.id)
            return (
              <button
                type='button'
                key={tag.id}
                onClick={() => toggleTag(tag)}
                onDoubleClick={() => onInsert(tag.en)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                  isSelected
                    ? 'bg-[var(--juhe-cyan)]/10 border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
                    : 'bg-[var(--juhe-surface-2)]/50 border-transparent hover:bg-[var(--juhe-surface-2)] hover:border-[var(--juhe-border)] text-[var(--juhe-text-2)]'
                }`}
                title={`${tag.zh} — ${tag.en}${tag.popular ? ` (${t('generate.presetPanel.hot')})` : ''}`}
              >
                <span className='flex items-center gap-1'>
                  {tag.label}
                  {tag.popular && <Flame className='w-2.5 h-2.5 text-[var(--juhe-amber)]' />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Bar */}
      {selectedTags.size > 0 && (
        <div className='px-3 py-2 border-t border-[var(--juhe-border)] bg-[var(--juhe-surface)]/30'>
          <div className='flex items-center justify-between'>
            <span className='text-xs text-[var(--juhe-text-2)]'>
              {t('generate.presetPanel.selectedCount', { count: selectedTags.size })}
            </span>
            <button
              type='button'
              onClick={handleInsertSelected}
              className='flex items-center gap-1 px-3 py-1.5 text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white rounded-md hover:opacity-90 transition-colors'
            >
              {t('generate.presetPanel.insertSelected')}
              <ChevronRight className='w-3 h-3' />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
