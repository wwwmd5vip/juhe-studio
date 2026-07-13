/**
 * 消息工具栏
 * 参考 Cherry Studio 的 MessageMenubar
 */

import { Check, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface MessageToolbarProps {
  isVisible: boolean
  onCopy: () => void
  onRegenerate?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function MessageToolbar({ isVisible, onCopy, onRegenerate, onEdit, onDelete }: MessageToolbarProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [onCopy])

  if (!isVisible) return null

  return (
    <div className='flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
      <button
        type='button'
        onClick={handleCopy}
        className='flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
        title={t('chat.copy')}
      >
        {copied ? (
          <>
            <Check size={12} className='text-green-500' />
            <span>{t('chat.copied')}</span>
          </>
        ) : (
          <>
            <Copy size={12} />
            <span>{t('chat.copy')}</span>
          </>
        )}
      </button>

      {onRegenerate && (
        <button
          type='button'
          onClick={onRegenerate}
          className='flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          title={t('chat.regenerate')}
        >
          <RotateCcw size={12} />
          <span>{t('chat.regenerate')}</span>
        </button>
      )}

      {onEdit && (
        <button
          type='button'
          onClick={onEdit}
          className='flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          title={t('chat.edit')}
        >
          <Pencil size={12} />
          <span>{t('chat.edit')}</span>
        </button>
      )}

      {onDelete && (
        <button
          type='button'
          onClick={onDelete}
          className='flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10 transition-colors'
          title={t('chat.delete')}
        >
          <Trash2 size={12} />
          <span>{t('chat.delete')}</span>
        </button>
      )}
    </div>
  )
}
