import type { GenerationOutput, GenerationParams, GenerationTask } from '@shared/types/generation'
import { Copy, Download, Heart, ImagePlus, Shuffle, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Masonry, { type MasonryItem } from '@/components/prompts/Masonry'
import { useFavoritesStore } from '@/stores/favorites'
import { useGenerationStore } from '@/stores/generation'
import { BatchResultGrid } from './BatchResultGrid'
import { VariantModal } from './VariantModal'

const imageCache = new Map<string, HTMLImageElement>()

function preloadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(src, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isVisible && src) {
      preloadImage(src).then(() => setIsLoaded(true)).catch(() => {
        // Image failed to load (e.g. 404 for missing files, network error)
        // Silently keep the placeholder — no need to crash
      })
    }
  }, [isVisible, src])

  return (
    <div ref={ref} className={`relative ${className}`}>
      {!isLoaded && <div className='absolute inset-0 bg-[var(--juhe-surface-2)] animate-pulse rounded-lg' />}
      {isVisible && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-auto object-cover rounded-lg transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading='lazy'
          decoding='async'
        />
      )}
    </div>
  )
}

function getOutputImageUrl(output: GenerationOutput): string | null {
  if (output.url) return output.url
  if (output.base64 && output.mediaType) return `data:${output.mediaType};base64,${output.base64}`
  return null
}

function getOutputAspectRatio(output: GenerationOutput): number | undefined {
  if (output.width && output.height && output.height > 0) {
    return output.width / output.height
  }
  return undefined
}

export function ResultGallery() {
  const { t } = useTranslation()
  const { tasks, isGenerating, activeTaskId, createTask, setParams, loadHistory, historyLoaded } = useGenerationStore()
  const { toggleFavorite, isFavorite } = useFavoritesStore()
  const [processImage, setProcessImage] = useState<string | null>(null)
  const [variantModal, setVariantModal] = useState<{ image: string; prompt: string } | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(12)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load history from database on mount (non-blocking) - only once
  useEffect(() => {
    if (!historyLoaded && !isLoadingHistory) {
      setIsLoadingHistory(true)
      const load = () => {
        const start = performance.now()
        console.log(`[ResultGallery] ⏱️ loadHistory() started at ${start.toFixed(1)}ms`)
        loadHistory(20)
          .then(() => {
            const end = performance.now()
            console.log(
              `[ResultGallery] ⏱️ loadHistory() completed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms)`
            )
          })
          .catch((err) => {
            const end = performance.now()
            console.error(
              `[ResultGallery] ⏱️ loadHistory() failed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms):`,
              err
            )
          })
          .finally(() => setIsLoadingHistory(false))
      }
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(load, { timeout: 500 })
      } else {
        setTimeout(load, 100)
      }
    }
  }, [historyLoaded, isLoadingHistory, loadHistory])

  const activeTask = tasks.find((t) => t.id === activeTaskId)

  // 所有正在运行/排队的任务
  const runningTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'processing' || t.status === 'pending')
  }, [tasks])

  // Flatten all completed outputs into a single stream, newest first
  const allOutputs = useMemo(() => {
    const items: { task: GenerationTask; output: GenerationOutput }[] = []
    for (const task of tasks) {
      if (task.status !== 'completed') continue
      for (const output of task.outputs) {
        items.push({ task, output })
      }
    }
    return items
  }, [tasks])

  const visibleOutputs = allOutputs.slice(0, visibleCount)
  const hasMore = visibleOutputs.length < allOutputs.length

  // Cleanup old image cache entries
  useEffect(() => {
    const usedUrls = new Set<string>()
    visibleOutputs.forEach(({ output }) => {
      const url = getOutputImageUrl(output)
      if (url) usedUrls.add(url)
    })
    if (activeTask) {
      activeTask.outputs.forEach((o) => {
        const url = getOutputImageUrl(o)
        if (url) usedUrls.add(url)
      })
    }
    if (imageCache.size > 20) {
      const entriesToDelete = imageCache.size - 20
      let deleted = 0
      for (const [key] of imageCache) {
        if (!usedUrls.has(key)) {
          imageCache.delete(key)
          deleted++
          if (deleted >= entriesToDelete) break
        }
      }
    }
    for (const [key] of imageCache) {
      if (!usedUrls.has(key)) {
        imageCache.delete(key)
      }
    }
  }, [visibleOutputs, activeTask])

  const _handleRegenerate = useCallback(
    (taskType: string, params: (typeof tasks)[0]['params']) => {
      setParams({ ...params, seed: undefined })
      const type = taskType === 'video' ? 'video' : 'image'
      createTask(type, { ...params, seed: undefined })
    },
    [createTask, setParams]
  )

  const handleGenerateVariant = useCallback((sourceImage: string, sourcePrompt: string) => {
    setVariantModal({ image: sourceImage, prompt: sourcePrompt })
  }, [])

  const handleVariantGenerate = useCallback(
    (params: { type: string; strength: number; count: number; style?: string }) => {
      if (!variantModal) return

      const { type, strength, count, style } = params
      const basePrompt = variantModal.prompt || ''

      let variantPrompt = basePrompt
      switch (type) {
        case 'style':
          variantPrompt = basePrompt
            ? `${basePrompt}, different artistic style variation`
            : 'Different artistic style variation'
          break
        case 'composition':
          variantPrompt = basePrompt
            ? `${basePrompt}, different composition and framing`
            : 'Different composition and framing variation'
          break
        case 'color':
          variantPrompt = basePrompt
            ? `${basePrompt}, different color palette and tone`
            : 'Different color palette and tone variation'
          break
        case 'detail':
          variantPrompt = basePrompt
            ? `${basePrompt}, different details and textures`
            : 'Different details and textures variation'
          break
      }

      createTask('image', {
        prompt: variantPrompt,
        n: count,
        style: style as GenerationParams['style'],
        referenceImages: [variantModal.image],
        referenceWeight: 0.7 + strength * 0.0025,
        referenceMode: 'ipadapter',
        seed: undefined
      })

      setVariantModal(null)
    },
    [variantModal, createTask]
  )

  const masonryItems: MasonryItem[] = useMemo(
    () =>
      visibleOutputs.map(({ task, output }) => {
        const imageUrl = getOutputImageUrl(output)
        const isVideo = output.type === 'video'
        const key = `${task.id}-${output.id}`
        return {
          key,
          imageUrl: imageUrl ?? undefined,
          aspectRatio: getOutputAspectRatio(output),
          node: (
            <ResultCard
              task={task}
              output={output}
              imageUrl={imageUrl}
              isVideo={isVideo}
              isFav={isFavorite(output.id)}
              onToggleFavorite={toggleFavorite}
              onZoom={setZoomImage}
              onProcess={setProcessImage}
              onVariant={handleGenerateVariant}
              onUseAsReference={(url) => setParams({ firstFrame: url })}
            />
          )
        }
      }),
    [visibleOutputs, isFavorite, toggleFavorite, handleGenerateVariant]
  )

  return (
    <div className='h-full flex flex-col'>
      <h2 className='text-lg font-semibold mb-4 text-[var(--juhe-text)]'>{t('generate.resultGallery.results')}</h2>

      {/* Running/Pending/Failed task queue */}
      {runningTasks.length > 0 && (
        <div className='mb-4 space-y-2'>
          {runningTasks.map((task) => (
            <div
              key={task.id}
              className={`p-3 rounded-xl border ${
                task.status === 'failed'
                  ? 'border-[var(--juhe-magenta)]/30 bg-[var(--juhe-magenta)]/5'
                  : 'border-[var(--juhe-border)] glass-card'
              }`}
            >
              <div className='flex items-center gap-2 mb-2'>
                {task.status === 'failed' ? (
                  <span className='text-xs text-[var(--juhe-magenta)] font-medium'>✕ 失败</span>
                ) : (
                  <>
                    <div className='w-2 h-2 rounded-full bg-[var(--juhe-cyan)] animate-pulse' style={{ boxShadow: '0 0 8px var(--juhe-cyan)' }} />
                    <span className='text-xs font-medium uppercase tracking-wider text-[var(--juhe-cyan)]' style={{ fontFamily: 'var(--font-mono)' }}>
                      {task.stage || task.status}
                    </span>
                    <span className='text-[10px] text-[var(--juhe-text-3)] ml-auto' style={{ fontFamily: 'var(--font-mono)' }}>
                      {task.progress}%
                    </span>
                  </>
                )}
              </div>
              {task.status !== 'failed' && (
                <div className='w-full h-1.5 bg-[var(--juhe-surface-2)] rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-gradient-to-r from-[var(--juhe-cyan)] to-[var(--juhe-violet)] rounded-full transition-all duration-500'
                    style={{ width: `${task.progress}%`, boxShadow: '0 0 8px rgba(0,240,255,0.3)' }}
                  />
                </div>
              )}
              <p className='mt-1.5 text-xs text-[var(--juhe-text-2)] truncate'>{task.params.prompt}</p>
              {task.error && (
                <p className='mt-1 text-xs text-[var(--juhe-magenta)] break-all'>{task.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Active task progress (batch mode) */}
      {activeTask &&
        isGenerating &&
        !runningTasks.find((rt) => rt.id === activeTask.id) &&
        activeTask.params.n && activeTask.params.n > 1 && (
          <BatchResultGrid task={activeTask} />
        )}

      {/* Result stream */}
      <div ref={containerRef} className='flex-1 overflow-y-auto'>
        {isLoadingHistory && masonryItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-64 text-[var(--juhe-text-2)] text-sm'>
            <div className='w-6 h-6 border-2 border-[var(--juhe-cyan)] border-t-transparent rounded-full animate-spin mb-3' />
            {t('common.loading')}
          </div>
        ) : masonryItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-64 text-[var(--juhe-text-3)]'>
            <div
              className='w-16 h-16 rounded-2xl flex items-center justify-center mb-4'
              style={{ background: 'var(--juhe-surface)', border: '1px solid var(--juhe-border)' }}
            >
              <Sparkles className='w-8 h-8 opacity-30' />
            </div>
            <p className='text-sm mb-1'>{t('generate.resultGallery.noResults')}</p>
            <p className='text-xs opacity-60'>
              {t('generate.resultGallery.configureProviderHint', {
                defaultValue: '配置 Provider 并开始你的第一次创作'
              })}
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            <Masonry
              items={masonryItems}
              breakpoints={[
                { minWidth: 900, columns: 3 },
                { minWidth: 640, columns: 2 },
                { minWidth: 0, columns: 1 }
              ]}
              gap={12}
              className='w-full'
            />

            {hasMore && (
              <div className='flex justify-center py-4'>
                <button
                  type='button'
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  disabled={isLoadingHistory}
                  className='px-5 py-2 rounded-lg text-xs font-medium border border-[var(--juhe-border)] bg-[var(--juhe-surface)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/30 hover:bg-[var(--juhe-surface-2)] transition-colors disabled:opacity-50'
                >
                  {t('generate.resultGallery.loadMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div
          className='fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4'
          onClick={() => setZoomImage(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setZoomImage(null)
          }}
          role='dialog'
          aria-modal='true'
          tabIndex={-1}
        >
          <div className='relative max-w-[90vw] max-h-[90vh]'>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
            <div onClick={(e) => e.stopPropagation()}>
              <img
                src={zoomImage}
                alt={t('generate.resultGallery.zoomed')}
                className='max-w-full max-h-[90vh] object-contain rounded-lg'
              />
            </div>
            <button
              type='button'
              onClick={() => setZoomImage(null)}
              className='absolute -top-3 -right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors'
              aria-label={t('common.close')}
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>
      )}

      {/* Image Process Modal */}
      {processImage && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='glass-card rounded-xl border border-[var(--juhe-glass-border)] shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col'>
            <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
              <h3 className='font-semibold text-sm text-[var(--juhe-text)]'>
                {t('generate.resultGallery.imageProcess')}
              </h3>
              <button
                type='button'
                onClick={() => setProcessImage(null)}
                className='p-1 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors text-[var(--juhe-text-2)]'
                aria-label={t('common.close')}
              >
                <X className='w-4 h-4' />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto p-4'>
              <img src={processImage} alt={t('generate.resultGallery.toProcess')} className='w-full rounded-lg mb-4' />
              <p className='text-xs text-[var(--juhe-text-2)] text-center'>
                {t('generate.resultGallery.clickProcessButton')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Variant Generation Modal */}
      {variantModal && (
        <VariantModal
          sourceImage={variantModal.image}
          sourcePrompt={variantModal.prompt}
          onClose={() => setVariantModal(null)}
          onGenerate={handleVariantGenerate}
        />
      )}
    </div>
  )
}

/* ===== Result Card (Masonry item) ===== */
function ResultCard({
  task,
  output,
  imageUrl,
  isVideo,
  isFav,
  onToggleFavorite,
  onZoom,
  onProcess,
  onVariant,
  onUseAsReference
}: {
  task: GenerationTask
  output: GenerationOutput
  imageUrl: string | null
  isVideo: boolean
  isFav: boolean
  onToggleFavorite: (item: {
    id: string
    type: 'image' | 'video' | 'text'
    prompt: string
    model?: string
    provider?: string
    base64?: string
    mediaType?: string
    createdAt: number
  }) => void
  onZoom: (url: string) => void
  onProcess: (url: string) => void
  onVariant: (image: string, prompt: string) => void
  onUseAsReference?: (url: string) => void
}) {
  const { t } = useTranslation()

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite({
      id: output.id,
      type: output.type as 'image' | 'video' | 'text',
      prompt: task.params.prompt || '',
      model: task.params.model,
      provider: task.params.providerId,
      base64: output.base64,
      mediaType: output.mediaType,
      createdAt: task.createdAt
    })
  }

  const handleCardClick = () => {
    if (imageUrl) {
      onZoom(imageUrl)
    }
  }

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation()
    action()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      aria-label={task.params.prompt || t('generate.resultGallery.generated')}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      className='relative group rounded-xl overflow-hidden cursor-pointer'
      style={{ background: 'var(--juhe-surface)', border: '1px solid var(--juhe-border)' }}
    >
      {imageUrl ? (
        isVideo ? (
          <video
            src={imageUrl}
            className='w-full h-auto object-cover'
            controls
            preload='metadata'
            crossOrigin='anonymous'
            onClick={(e) => e.stopPropagation()}
          >
            <track kind='captions' src='' srcLang='zh' label={t('common.loading')} default />
          </video>
        ) : (
          <LazyImage src={imageUrl} alt={t('generate.resultGallery.generated')} className='w-full' />
        )
      ) : (
        <div className='w-full aspect-square bg-[var(--juhe-surface-2)] flex items-center justify-center'>
          <span className='text-xs text-[var(--juhe-text-3)]'>{t('generate.resultGallery.noImage')}</span>
        </div>
      )}

      {/* Hover overlay */}
      <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3'>
        <p className='text-xs text-white/90 line-clamp-2 mb-2' title={task.params.prompt}>
          {task.params.prompt || t('generate.resultGallery.noImage')}
        </p>
        {imageUrl && (
          <div className='flex items-center gap-1.5'>
            <a
              href={imageUrl}
              download={`generated-${output.id}.${isVideo ? 'mp4' : 'png'}`}
              onClick={(e) => e.stopPropagation()}
              className='p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
              title={t('common.download')}
            >
              <Download className='w-3.5 h-3.5' />
            </a>
            <button
              type='button'
              onClick={(e) => handleActionClick(e, () => navigator.clipboard.writeText(imageUrl))}
              className='p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
              title={t('generate.resultGallery.copyBase64')}
            >
              <Copy className='w-3.5 h-3.5' />
            </button>
            {!isVideo && (
              <>
                <button
                  type='button'
                  onClick={(e) => handleActionClick(e, () => onUseAsReference?.(imageUrl))}
                  className='p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                  title='用作参考图'
                >
                  <ImagePlus className='w-3.5 h-3.5' />
                </button>
                <button
                  type='button'
                  onClick={(e) => handleActionClick(e, () => onProcess(imageUrl))}
                  className='p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                  title={t('generate.resultGallery.processImage')}
                >
                  <SlidersHorizontal className='w-3.5 h-3.5' />
                </button>
                <button
                  type='button'
                  onClick={(e) => handleActionClick(e, () => onVariant(imageUrl, task.params.prompt))}
                  className='p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                  title={t('generate.resultGallery.variant')}
                >
                  <Shuffle className='w-3.5 h-3.5' />
                </button>
              </>
            )}
            <button
              type='button'
              onClick={handleFavoriteClick}
              className={`p-1.5 rounded-full transition-colors ${
                isFav ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title={isFav ? t('favorites.remove') : t('favorites.add')}
            >
              <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
