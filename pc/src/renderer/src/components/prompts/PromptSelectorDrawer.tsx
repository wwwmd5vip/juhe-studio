/**
 * PromptSelectorDrawer — shared prompt selection drawer for chat & agent pages.
 *
 * Opens a right-side drawer listing prompts filtered by `type`.
 * On select: fetches detail, collects variable values if needed,
 * renders locally, and calls `onSelect` with the final content.
 * For `package` type, calls renderPackage to get multi-step content.
 */

import type { PromptListItem } from '@shared/types/prompts'
import { renderTemplate } from '@shared/ecommerce-workflow/utils'
import { Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import VariableInputModal from './VariableInputModal'

export interface PromptSelectorDrawerProps {
  type: 'agent' | 'package'
  open: boolean
  onSelect: (renderedContent: string, prompt: PromptListItem) => void
  onClose: () => void
}

interface Category {
  id: number
  name: string
}

export default function PromptSelectorDrawer({ type, open, onSelect, onClose }: PromptSelectorDrawerProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<PromptListItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [varModal, setVarModal] = useState<{ content: string; vars: Record<string, string>; prompt: PromptListItem } | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.promptLibrary.list({ type, page, pageSize: 20, keyword, category_id: categoryId })
      if (res) {
        setItems(res.data || [])
        setTotalPages(res.pagination?.totalPages || 1)
      }
    } catch {
      // network error — keep empty list
    } finally {
      setLoading(false)
    }
  }, [type, page, keyword, categoryId])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await window.api.promptLibrary.categories(type)
      if (Array.isArray(res)) {
        setCategories(res.map((c: unknown) => {
          const cat = c as { id?: number; name?: string }
          return { id: cat.id ?? 0, name: cat.name ?? 'Unknown' }
        }))
      }
    } catch {
      // ignore
    }
  }, [type])

  useEffect(() => {
    if (open) {
      setPage(1)
      setKeyword('')
      setCategoryId(undefined)
      fetchCategories()
    }
  }, [open, fetchCategories])

  useEffect(() => {
    if (open) fetchList()
  }, [open, fetchList])

  // Debounced keyword search
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1)
      else fetchList()
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  const handleSelect = useCallback(
    async (item: PromptListItem) => {
      if (actionLoadingId) return
      setActionLoadingId(String(item.id))
      try {
        const result = await window.api.promptLibrary.get(item.id)
        if (!result) {
          setActionLoadingId(null)
          return
        }

        const content = result.item.content
        if (!content) {
          setActionLoadingId(null)
          return
        }

        const vars = result.item.variables
        if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
          setVarModal({ content, vars, prompt: item })
          setActionLoadingId(null)
          return
        }

        // No variables — render directly
        if (type === 'package') {
          const pkgResult = await window.api.juhePrompts.renderPackage({ id: item.id, variables: {} })
          const pkgItems = (pkgResult as { data?: { title?: string; content?: string }[] })?.data || []
          if (Array.isArray(pkgItems) && pkgItems.length > 0) {
            const assembled = pkgItems
              .map((entry: { title?: string; content?: string }, idx: number) => `## 步骤 ${idx + 1}${entry.title ? `: ${entry.title}` : ''}\n\n${entry.content || ''}`)
              .join('\n\n---\n\n')
            onSelect(assembled, item)
          } else {
            onSelect(content, item)
          }
        } else {
          onSelect(content, item)
        }
        onClose()
      } catch {
        // network error
      } finally {
        setActionLoadingId(null)
      }
    },
    [actionLoadingId, type, onSelect, onClose]
  )

  const handleVarConfirm = useCallback(
    async (values: Record<string, string>) => {
      if (!varModal) return
      const rendered = renderTemplate(varModal.content, values)

      if (type === 'package') {
        try {
          const pkgResult = await window.api.juhePrompts.renderPackage({ id: varModal.prompt.id, variables: values })
          const pkgItems = (pkgResult as { data?: { title?: string; content?: string }[] })?.data || []
          if (Array.isArray(pkgItems) && pkgItems.length > 0) {
            const assembled = pkgItems
              .map((entry: { title?: string; content?: string }, idx: number) => `## 步骤 ${idx + 1}${entry.title ? `: ${entry.title}` : ''}\n\n${entry.content || ''}`)
              .join('\n\n---\n\n')
            onSelect(assembled, varModal.prompt)
          } else {
            onSelect(rendered, varModal.prompt)
          }
        } catch {
          onSelect(rendered, varModal.prompt)
        }
      } else {
        onSelect(rendered, varModal.prompt)
      }
      setVarModal(null)
      onClose()
    },
    [varModal, type, onSelect, onClose]
  )

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <button type='button' className='fixed inset-0 z-40 bg-black/50' aria-label='Close' onClick={onClose} />

      {/* Drawer */}
      <div className='fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-[90vw] bg-[var(--juhe-void-2)] border-l border-[var(--juhe-border)] flex flex-col shadow-2xl'>
        {/* Header */}
        <div className='h-14 shrink-0 flex items-center justify-between px-4 border-b border-[var(--juhe-border)]'>
          <h2 className='text-sm font-semibold text-[var(--juhe-text)]'>
            {type === 'agent' ? t('prompts.selectAgentPrompt') : t('prompts.selectPackagePrompt')}
          </h2>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 rounded-md text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Search + filters */}
        <div className='shrink-0 px-4 py-3 space-y-2 border-b border-[var(--juhe-border)]'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
            <input
              type='text'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('prompts.searchPlaceholder')}
              className='w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-xs text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 transition-all'
            />
          </div>
          {categories.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              <button
                type='button'
                onClick={() => { setCategoryId(undefined); setPage(1) }}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  categoryId === undefined
                    ? 'bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)]'
                    : 'bg-[var(--juhe-surface)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                }`}
              >
                {t('prompts.allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type='button'
                  onClick={() => { setCategoryId(cat.id); setPage(1) }}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    categoryId === cat.id
                      ? 'bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)]'
                      : 'bg-[var(--juhe-surface)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className='flex-1 overflow-y-auto p-3 space-y-2'>
          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='w-5 h-5 animate-spin text-[var(--juhe-text-3)]' />
            </div>
          ) : items.length === 0 ? (
            <div className='text-center py-12 text-xs text-[var(--juhe-text-3)]'>{t('prompts.noPromptsFound')}</div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type='button'
                onClick={() => handleSelect(item)}
                disabled={actionLoadingId === String(item.id)}
                className='w-full text-left p-3 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/40 hover:shadow-md hover:shadow-[var(--juhe-cyan)]/5 transition-all disabled:opacity-60'
              >
                <div className='flex items-start justify-between gap-2'>
                  <h3 className='text-sm font-medium text-[var(--juhe-text)] line-clamp-1'>{item.title}</h3>
                  {actionLoadingId === String(item.id) && <Loader2 className='w-3.5 h-3.5 animate-spin text-[var(--juhe-cyan)] shrink-0' />}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className='flex flex-wrap gap-1 mt-1.5'>
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className='px-1.5 py-0.5 rounded-md bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] text-[10px]'>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {item.variables && Object.keys(item.variables).length > 0 && (
                  <p className='text-[10px] text-[var(--juhe-text-3)] mt-1'>
                    {Object.keys(item.variables).length} {t('prompts.variables')}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='shrink-0 flex items-center justify-center gap-2 py-2 border-t border-[var(--juhe-border)]'>
            <button
              type='button'
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className='px-3 py-1 rounded-md text-[10px] text-[var(--juhe-text-2)] bg-[var(--juhe-surface)] border border-[var(--juhe-border)] disabled:opacity-40 hover:border-[var(--juhe-cyan)]/30 transition-colors'
            >
              {t('common.previous')}
            </button>
            <span className='text-[10px] text-[var(--juhe-text-3)]'>{page} / {totalPages}</span>
            <button
              type='button'
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className='px-3 py-1 rounded-md text-[10px] text-[var(--juhe-text-2)] bg-[var(--juhe-surface)] border border-[var(--juhe-border)] disabled:opacity-40 hover:border-[var(--juhe-cyan)]/30 transition-colors'
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </div>

      {/* Variable input modal */}
      {varModal && (
        <VariableInputModal
          variables={varModal.vars}
          onConfirm={handleVarConfirm}
          onCancel={() => setVarModal(null)}
        />
      )}
    </>
  )
}
