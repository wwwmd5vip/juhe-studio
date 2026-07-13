/**
 * Quick Phrases Popover
 * 聊天输入框的快捷短语选择弹窗
 */

import { Check, Edit3, Plus, Star, Trash2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import { useQuickPhrasesStore } from '@/stores/quick-phrases'

interface QuickPhrasesPopoverProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (content: string) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export function QuickPhrasesPopover({ isOpen, onClose, onSelect, anchorRef }: QuickPhrasesPopoverProps) {
  const { t } = useTranslation()
  const { phrases, loadPhrases, createPhrase, deletePhrase, updatePhrase } = useQuickPhrasesStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadPhrases()
    }
  }, [isOpen, loadPhrases])

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorRef])

  const filteredPhrases = searchQuery.trim()
    ? phrases.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : phrases

  const handleSelect = useCallback(
    (content: string) => {
      onSelect(content)
      onClose()
      setSearchQuery('')
    },
    [onSelect, onClose]
  )

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    await createPhrase(newTitle.trim(), newContent.trim())
    setNewTitle('')
    setNewContent('')
    setIsAdding(false)
  }, [newTitle, newContent, createPhrase])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTargetId(id)
  }, [])

  const handleStartEdit = useCallback((phrase: (typeof phrases)[0], e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(phrase.id)
    setEditTitle(phrase.title)
    setEditContent(phrase.content)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return
    await updatePhrase(editingId, { title: editTitle.trim(), content: editContent.trim() })
    setEditingId(null)
  }, [editingId, editTitle, editContent, updatePhrase])

  const handleToggleFavorite = useCallback(
    async (phrase: (typeof phrases)[0], e: React.MouseEvent) => {
      e.stopPropagation()
      await updatePhrase(phrase.id, { isFavorite: !phrase.isFavorite })
    },
    [updatePhrase]
  )

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className='absolute z-50 w-80 bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-xl shadow-lg overflow-hidden'
      style={{
        bottom: '100%',
        left: 0,
        marginBottom: 8
      }}
    >
      {/* Header */}
      <div className='flex items-center justify-between px-3 py-2 border-b border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/50'>
        <div className='flex items-center gap-1.5'>
          <Zap className='w-3.5 h-3.5 text-[var(--juhe-cyan)]' />
          <span className='text-xs font-medium'>{t('quickPhrases.title')}</span>
        </div>
        <button
          type='button'
          onClick={() => setIsAdding(!isAdding)}
          className='p-1 rounded hover:bg-[var(--juhe-surface-2)] transition-colors'
          title={t('quickPhrases.add')}
        >
          <Plus className='w-3.5 h-3.5' />
        </button>
      </div>

      {/* Search */}
      <div className='px-3 py-2 border-b border-[var(--juhe-border)]'>
        <input
          type='text'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('quickPhrases.search')}
          className='w-full px-2 py-1 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
        />
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className='px-3 py-2 border-b border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30 space-y-2'>
          <input
            type='text'
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('quickPhrases.titlePlaceholder')}
            className='w-full px-2 py-1 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t('quickPhrases.contentPlaceholder')}
            rows={2}
            className='w-full px-2 py-1 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] resize-none'
          />
          <div className='flex justify-end gap-1'>
            <button
              type='button'
              onClick={() => setIsAdding(false)}
              className='px-2 py-0.5 text-xs rounded hover:bg-[var(--juhe-surface-2)] transition-colors'
            >
              {t('common.cancel')}
            </button>
            <button
              type='button'
              onClick={handleAdd}
              disabled={!newTitle.trim() || !newContent.trim()}
              className='px-2 py-0.5 text-xs rounded bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors'
            >
              {t('common.add')}
            </button>
          </div>
        </div>
      )}

      {/* Phrases List */}
      <div className='max-h-64 overflow-y-auto'>
        {filteredPhrases.length === 0 ? (
          <div className='px-3 py-4 text-center text-xs text-[var(--juhe-text-3)]'>
            {searchQuery ? t('quickPhrases.noResults') : t('quickPhrases.empty')}
          </div>
        ) : (
          filteredPhrases.map((phrase) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
              key={phrase.id}
              className='group relative px-3 py-2 hover:bg-[var(--juhe-surface-2)]/50 cursor-pointer border-b border-[var(--juhe-border)]/50 last:border-b-0 transition-colors'
              onClick={() => {
                if (editingId !== phrase.id) {
                  handleSelect(phrase.content)
                }
              }}
            >
              {editingId === phrase.id ? (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div className='space-y-1.5' onClick={(e) => e.stopPropagation()}>
                  <input
                    type='text'
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className='w-full px-1.5 py-0.5 text-xs rounded border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    className='w-full px-1.5 py-0.5 text-xs rounded border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] resize-none'
                  />
                  <div className='flex justify-end gap-1'>
                    <button
                      type='button'
                      onClick={() => setEditingId(null)}
                      className='p-0.5 rounded hover:bg-[var(--juhe-surface-2)]'
                    >
                      <X className='w-3 h-3' />
                    </button>
                    <button
                      type='button'
                      onClick={handleSaveEdit}
                      className='p-0.5 rounded hover:bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)]'
                    >
                      <Check className='w-3 h-3' />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className='flex items-center gap-1.5 pr-14'>
                    <span className='text-xs font-medium truncate'>{phrase.title}</span>
                    {phrase.isFavorite && <Star className='w-3 h-3 text-amber-500 fill-amber-500 shrink-0' />}
                  </div>
                  <div className='text-[10px] text-[var(--juhe-text-3)] truncate mt-0.5'>{phrase.content}</div>

                  {/* Actions */}
                  <div className='absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                    <button
                      type='button'
                      onClick={(e) => handleToggleFavorite(phrase, e)}
                      className='p-1 rounded hover:bg-[var(--juhe-surface-2)]'
                      title={phrase.isFavorite ? t('quickPhrases.unfavorite') : t('quickPhrases.favorite')}
                    >
                      <Star
                        className={`w-3 h-3 ${phrase.isFavorite ? 'text-amber-500 fill-amber-500' : 'text-[var(--juhe-text-3)]'}`}
                      />
                    </button>
                    <button
                      type='button'
                      onClick={(e) => handleStartEdit(phrase, e)}
                      className='p-1 rounded hover:bg-[var(--juhe-surface-2)]'
                      title={t('common.edit')}
                    >
                      <Edit3 className='w-3 h-3 text-[var(--juhe-text-3)]' />
                    </button>
                    <button
                      type='button'
                      onClick={(e) => handleDelete(phrase.id, e)}
                      className='p-1 rounded hover:bg-[var(--juhe-magenta)]/10'
                      title={t('common.delete')}
                    >
                      <Trash2 className='w-3 h-3 text-[var(--juhe-magenta)]' />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <ConfirmModal
        open={deleteTargetId !== null}
        title={t('quickPhrases.confirmDelete') as string}
        description={t('quickPhrases.confirmDelete') as string}
        confirmText={t('common.delete') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={async () => {
          if (deleteTargetId) {
            await deletePhrase(deleteTargetId)
          }
          setDeleteTargetId(null)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}
