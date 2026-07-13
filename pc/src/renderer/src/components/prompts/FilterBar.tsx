import { RotateCcw, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface FilterValue {
  keyword: string
  type?: 'image' | 'agent' | 'package'
  category_id?: number
}

interface CategoryInfo {
  id: number
  name: string
  type: string
}

interface FilterBarProps {
  value: FilterValue
  onChange: (value: FilterValue) => void
  onSearch?: (keyword: string) => void
  disabled?: boolean
}

const TYPE_TABS = [
  { key: undefined, labelKey: 'prompts.library.filters.typeAll' },
  { key: 'image' as const, labelKey: 'prompts.library.filters.typeImage' },
  { key: 'agent' as const, labelKey: 'prompts.library.filters.typeAgent' },
  { key: 'package' as const, labelKey: 'prompts.library.filters.typePackage' }
]

export default function FilterBar({ value, onChange, onSearch, disabled }: FilterBarProps) {
  const { t } = useTranslation()
  const baseId = useId()
  const [categories, setCategories] = useState<CategoryInfo[]>([])

  // Fetch categories for current type
  useEffect(() => {
    let cancelled = false
    window.api.promptLibrary
      .categories(value.type || 'image')
      .then((res) => {
        if (!cancelled) setCategories(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [value.type])

  const tabs = useMemo(
    () =>
      TYPE_TABS.map((tab) => ({
        ...tab,
        label: t(tab.labelKey)
      })),
    [t]
  )

  const handleReset = () => {
    onChange({ keyword: '' })
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--juhe-text-3)] pointer-events-none' />
        <input
          id={`${baseId}-filter-keyword`}
          name='keyword'
          type='text'
          value={value.keyword}
          onChange={(e) => onChange({ ...value, keyword: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSearch?.(value.keyword)
            }
          }}
          placeholder={t('prompts.library.searchPlaceholder')}
          disabled={disabled}
          className='w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors disabled:opacity-50'
        />
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {tabs.map((tab) => (
          <button
            key={String(tab.key ?? '__all__')}
            type='button'
            onClick={() => onChange({ ...value, type: tab.key, category_id: undefined })}
            disabled={disabled}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
              value.type === tab.key
                ? 'bg-[var(--juhe-cyan)]/15 text-[var(--juhe-cyan)] border border-[var(--juhe-cyan)]/30'
                : 'bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:border-[var(--juhe-cyan)]/30'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Category dropdown */}
        {categories.length > 0 && (
          <select
            id={`${baseId}-filter-category`}
            value={value.category_id ?? ''}
            onChange={(e) => onChange({ ...value, category_id: e.target.value ? Number(e.target.value) : undefined })}
            disabled={disabled}
            className='px-2 py-1.5 rounded-md bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-xs text-[var(--juhe-text)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 disabled:opacity-50'
          >
            <option value=''>{t('prompts.library.filters.all')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        )}

        <button
          type='button'
          onClick={handleReset}
          disabled={disabled}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--juhe-border)] text-xs text-[var(--juhe-text-2)] hover:border-[var(--juhe-cyan)]/30 hover:text-[var(--juhe-text)] transition-colors disabled:opacity-50'
        >
          <RotateCcw className='w-3.5 h-3.5' />
          {t('prompts.library.resetFilters')}
        </button>
      </div>
    </div>
  )
}
