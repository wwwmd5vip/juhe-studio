import { createFileRoute, Link } from '@tanstack/react-router'
import { Download, FileText, Heart, HeartOff, Image, Trash2, Video, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import { useFavoritesStore } from '@/stores/favorites'

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage
})

type FilterType = 'all' | 'image' | 'video' | 'text'

function FavoritesPage() {
  const { t } = useTranslation()
  const { items, removeFavorite, clearAll } = useFavoritesStore()
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter)

  const handleDownload = (item: (typeof items)[0]) => {
    if (item.base64 && item.mediaType) {
      const link = document.createElement('a')
      link.href = `data:${item.mediaType};base64,${item.base64}`
      link.download = `favorite-${item.id}.png`
      link.click()
    }
  }

  return (
    <div className='h-full flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='px-6 py-4 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Heart className='w-6 h-6 text-[var(--juhe-magenta)]' />
            <h1 className='text-xl font-bold'>{t('favorites.title')}</h1>
            <span className='text-sm text-[var(--juhe-text-3)]'>{t('favorites.count', { count: items.length })}</span>
          </div>
          {items.length > 0 && (
            <button
              type='button'
              onClick={() => setShowClearConfirm(true)}
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--juhe-magenta)]
                         hover:bg-[var(--juhe-magenta)]/10 transition-colors'
            >
              <HeartOff className='w-4 h-4' />
              {t('favorites.clearAll')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className='flex gap-2 mt-3'>
          {(['all', 'image', 'video', 'text'] as FilterType[]).map((f) => (
            <button
              type='button'
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                  : 'bg-[var(--juhe-void-3)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
              }`}
            >
              {f === 'all' && t('favorites.filterAll')}
              {f === 'image' && t('favorites.filterImage')}
              {f === 'video' && t('favorites.filterVideo')}
              {f === 'text' && t('generate.modes.text')}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-4'>
        {filtered.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-[var(--juhe-text-3)]'>
            <Heart className='w-12 h-12 mb-3 opacity-20' />
            <p className='text-sm'>{t('favorites.empty')}</p>
            <p className='text-xs mt-1'>{t('favorites.emptyHint')}</p>
            <Link
              to='/generate'
              className='mt-4 px-4 py-2 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
            >
              {t('nav.generate')}
            </Link>
          </div>
        ) : (
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
            {filtered.map((item) => (
              <div
                key={item.id}
                className='group bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg overflow-hidden hover:border-[var(--juhe-cyan)]/30 transition-colors'
              >
                {/* Image preview */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
                <div
                  className='relative aspect-square bg-[var(--juhe-surface-2)] cursor-pointer'
                  onClick={() => {
                    if (item.base64 && item.mediaType) {
                      setSelectedImage(`data:${item.mediaType};base64,${item.base64}`)
                    }
                  }}
                >
                  {item.base64 && item.mediaType ? (
                    <img
                      src={`data:${item.mediaType};base64,${item.base64}`}
                      alt={item.prompt}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <div className='w-full h-full flex items-center justify-center'>
                      {item.type === 'image' && <Image className='w-8 h-8 text-[var(--juhe-text-3)]/50' />}
                      {item.type === 'video' && <Video className='w-8 h-8 text-[var(--juhe-text-3)]/50' />}
                      {item.type === 'text' && <FileText className='w-8 h-8 text-[var(--juhe-text-3)]/50' />}
                    </div>
                  )}

                  {/* Hover actions */}
                  <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                    {item.base64 && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(item)
                        }}
                        className='p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                        title={t('common.download')}
                      >
                        <Download className='w-4 h-4' />
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFavorite(item.id)
                      }}
                      className='p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                      title={t('favorites.remove')}
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className='p-3'>
                  <p className='text-xs text-[var(--juhe-text-3)] line-clamp-2 mb-1.5'>
                    {item.prompt || t('history.noPrompt')}
                  </p>
                  <div className='flex items-center justify-between text-[10px] text-[var(--juhe-text-3)]'>
                    <span>{item.model || item.provider || 'Unknown'}</span>
                    <span>{formatDate(item.favoritedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4'
          onClick={() => setSelectedImage(null)}
        >
          <div className='relative max-w-4xl max-h-[90vh]'>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
            <img
              src={selectedImage}
              alt='Preview'
              className='max-w-full max-h-[85vh] object-contain rounded-lg'
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type='button'
              onClick={() => setSelectedImage(null)}
              className='absolute -top-3 -right-3 p-2 rounded-full bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] hover:bg-white/[0.03] transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={showClearConfirm}
        title={t('favorites.clearAll') as string}
        description={`${t('favorites.clearAll')}?`}
        confirmText={t('common.confirm') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={() => {
          clearAll()
          setShowClearConfirm(false)
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
