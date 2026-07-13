import { Keyboard, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useShortcutsStore } from '@/stores/shortcuts'

interface ShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

const categoryOrder: Array<'navigation' | 'generation' | 'chat' | 'global'> = [
  'navigation',
  'generation',
  'chat',
  'global'
]

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const { t } = useTranslation()
  const { shortcuts } = useShortcutsStore()
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    },
    [isOpen, onClose]
  )

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  const grouped = categoryOrder.map((cat) => ({
    category: cat,
    items: shortcuts.filter((s) => s.category === cat && s.isEnabled)
  }))

  const categoryLabels: Record<string, string> = {
    navigation: t('shortcuts.categoryNavigation'),
    generation: t('shortcuts.categoryGeneration'),
    chat: t('shortcuts.categoryChat'),
    global: t('shortcuts.categoryGlobal')
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-dismiss
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled separately
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'
    >
      <div className='w-full max-w-lg max-h-[80vh] mx-4 bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-2xl shadow-2xl flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2'>
            <Keyboard className='w-5 h-5 text-[var(--juhe-cyan)]' />
            <h2 className='text-lg font-semibold'>{t('shortcuts.shortcutsHelp')}</h2>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 rounded-lg hover:bg-[var(--juhe-surface-2)] transition-colors'
            aria-label={t('shortcuts.close')}
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-6 space-y-6'>
          {grouped.map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.category}>
                  <h3 className='text-xs font-semibold uppercase tracking-wider text-[var(--juhe-text-3)] mb-3'>
                    {categoryLabels[group.category]}
                  </h3>
                  <div className='space-y-2'>
                    {group.items.map((s) => (
                      <div
                        key={s.id}
                        className='flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--juhe-surface-2)]/50'
                      >
                        <div>
                          <p className='text-sm font-medium'>{s.name}</p>
                          <p className='text-xs text-[var(--juhe-text-3)]'>{s.description}</p>
                        </div>
                        <kbd className='shrink-0 ml-4 px-2 py-1 text-xs font-mono bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] rounded-md shadow-sm'>
                          {s.currentKey}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>

        {/* Footer */}
        <div className='px-6 py-3 border-t border-[var(--juhe-border)] text-center text-xs text-[var(--juhe-text-3)]'>
          {t('shortcuts.pressKey')}
        </div>
      </div>
    </div>
  )
}
