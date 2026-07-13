import type { PromptTemplate } from '@shared/types/prompt-system'
import { Check, Copy, LayoutTemplate, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface TemplateLibraryProps {
  onApply: (prompt: string) => void
  onClose: () => void
}

export default function TemplateLibrary({ onApply, onClose }: TemplateLibraryProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PromptTemplate | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.api.prompt.listTemplates().then((list) => {
      setTemplates(list as PromptTemplate[])
    }).catch((err) => {
      console.error('[TemplateLibrary] Failed to load templates:', err)
    })
  }, [])

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  )

  const applyTemplate = () => {
    if (!selected) return
    let prompt = selected.prompt
    // Fill variables with defaults
    for (const v of selected.variables) {
      const placeholder = `{{${v.name}}}`
      const value = v.default || (v.type === 'text' ? '' : v.options?.[0] || '')
      prompt = prompt.replace(placeholder, value)
    }
    onApply(prompt)
    onClose()
  }

  const copyTemplate = () => {
    if (!selected) return
    navigator.clipboard.writeText(selected.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className='flex flex-col h-full glass-card border-l border-[var(--juhe-border)]'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <h3 className='font-semibold text-sm flex items-center gap-2 text-[var(--juhe-text)]'>
          <LayoutTemplate className='w-4 h-4' />
          {t('generate.templateLibrary.title')}
        </h3>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('generate.templateLibrary.searchPlaceholder')}
            className='w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--juhe-surface-2)] rounded-md border-0 text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30 outline-none'
          />
        </div>
      </div>

      {/* Content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Template List */}
        <div className='w-1/2 overflow-y-auto border-r border-[var(--juhe-border)]'>
          {filtered.map((t) => (
            <button
              type='button'
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full text-left px-3 py-2.5 border-b border-[var(--juhe-border)] transition-colors ${
                selected?.id === t.id ? 'bg-[var(--juhe-cyan)]/5' : 'hover:bg-[var(--juhe-surface-2)]/50'
              }`}
            >
              <div className='text-sm font-medium text-[var(--juhe-text)]'>{t.name}</div>
              <div className='text-xs text-[var(--juhe-text-2)] line-clamp-1 mt-0.5'>{t.description}</div>
              <div className='flex gap-1 mt-1'>
                {t.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className='text-[10px] px-1.5 py-0.5 bg-[var(--juhe-surface-2)] rounded-full text-[var(--juhe-text-2)]'
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className='w-1/2 overflow-y-auto p-3'>
          {selected ? (
            <div className='space-y-3'>
              <div>
                <div className='text-sm font-semibold text-[var(--juhe-text)]'>{selected.name}</div>
                <div className='text-xs text-[var(--juhe-text-2)] mt-0.5'>{selected.description}</div>
              </div>

              <div className='bg-[var(--juhe-surface-2)] rounded-md p-2 text-xs font-mono whitespace-pre-wrap text-[var(--juhe-text)]'>
                {selected.prompt}
              </div>

              {selected.variables.length > 0 && (
                <div className='space-y-1.5'>
                  <div className='text-xs font-medium text-[var(--juhe-text)]'>
                    {t('generate.templateLibrary.variables')}
                  </div>
                  {selected.variables.map((v) => (
                    <div key={v.name} className='flex items-center justify-between text-xs'>
                      <span className='text-[var(--juhe-text-2)]'>
                        {v.label}{' '}
                        <code className='bg-[var(--juhe-surface-2)] px-1 rounded text-[var(--juhe-text)]'>
                          {'{{'}
                          {v.name}
                          {'}}'}
                        </code>
                      </span>
                      <span className='text-[var(--juhe-text-2)]'>{v.default || '-'}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.example && (
                <div className='space-y-1'>
                  <div className='text-xs font-medium text-[var(--juhe-text)]'>
                    {t('generate.templateLibrary.example')}
                  </div>
                  <div className='text-xs text-[var(--juhe-text-2)] bg-[var(--juhe-surface)]/50 rounded-md p-2'>
                    {selected.example}
                  </div>
                </div>
              )}

              <div className='flex gap-2 pt-2'>
                <button
                  type='button'
                  onClick={applyTemplate}
                  className='flex-1 py-1.5 text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white rounded-md hover:opacity-90 transition-colors'
                >
                  {t('generate.templateLibrary.applyTemplate')}
                </button>
                <button
                  type='button'
                  onClick={copyTemplate}
                  className='px-3 py-1.5 text-xs bg-[var(--juhe-surface-2)] rounded-md hover:bg-[var(--juhe-surface-3)] transition-colors text-[var(--juhe-text-2)]'
                >
                  {copied ? (
                    <Check className='w-3.5 h-3.5 text-[var(--juhe-emerald)]' />
                  ) : (
                    <Copy className='w-3.5 h-3.5' />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className='flex items-center justify-center h-full text-xs text-[var(--juhe-text-3)]'>
              {t('generate.templateLibrary.selectTemplate')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
