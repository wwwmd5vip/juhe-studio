import { GripVertical, ImagePlus, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation'

const MAX_IMAGES = 4

/**
 * Resize and compress image to avoid 431 Request Header Fields Too Large
 * Returns data URL with reduced dimensions and quality
 *
 * Default: 1536x1536 @ 90% quality - good balance between quality and size
 * High-res images can be 2-5MB+ which causes 431 errors
 */
function resizeImage(file: File, maxWidth = 1536, maxHeight = 1536, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Use JPEG for smaller size if no transparency needed, otherwise PNG
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }
    img.onerror = reject
    const reader = new FileReader()
    reader.onload = () => {
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export function ReferenceImages() {
  const { t } = useTranslation()
  const { params, setParams } = useGenerationStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const images = params.referenceImages || []
  const weights = params.referenceWeights || []
  const count = images.length
  const isMaxReached = count >= MAX_IMAGES

  const ensureWeights = (imgs: string[], wts: number[]) => {
    if (wts.length >= imgs.length) return wts
    return [...wts, ...Array(imgs.length - wts.length).fill(0.5)]
  }

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return

      const remainingSlots = MAX_IMAGES - count
      if (remainingSlots <= 0) return

      const toAdd = imageFiles.slice(0, remainingSlots)

      // 串行处理每张图片，确保顺序一致
      const newImages: string[] = []
      for (let i = 0; i < toAdd.length; i++) {
        const file = toAdd[i]
        // Resize and compress image before storing to avoid 431 header too large
        // Default: 1536x1536 @ 90% quality for better reference image quality
        const resized = await resizeImage(file)
        newImages.push(resized)
      }

      const nextImages = [...images, ...newImages]
      const nextWeights = ensureWeights(nextImages, [...weights, ...newImages.map(() => 0.5)])
      setParams({ referenceImages: nextImages, referenceWeights: nextWeights })
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: ignored using `--suppress`
    [count, images, weights, setParams, ensureWeights]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    const nextImages = images.filter((_, i) => i !== index)
    const nextWeights = weights.filter((_, i) => i !== index)
    setParams({ referenceImages: nextImages, referenceWeights: nextWeights })
    if (selectedIndex === index) {
      setSelectedIndex(null)
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const clearAll = () => {
    setParams({ referenceImages: [], referenceWeights: [] })
    setSelectedIndex(null)
  }

  const setImageWeight = (index: number, value: number) => {
    const nextWeights = [...weights]
    nextWeights[index] = value
    setParams({ referenceWeights: nextWeights })
  }

  const setGlobalWeight = (value: number) => {
    setParams({ referenceWeight: value })
  }

  const onDragOverBasket = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  const onDragLeaveBasket = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  const onDropBasket = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const onDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const onDropItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    const sourceIndex = Number(e.dataTransfer.getData('text/plain'))
    setDragOverIndex(null)
    if (sourceIndex === targetIndex) return
    if (sourceIndex < 0 || sourceIndex >= images.length) return

    const nextImages = [...images]
    const nextWeights = ensureWeights(images, [...weights])
    const [movedImg] = nextImages.splice(sourceIndex, 1)
    const [movedWt] = nextWeights.splice(sourceIndex, 1)
    nextImages.splice(targetIndex, 0, movedImg)
    nextWeights.splice(targetIndex, 0, movedWt)
    setParams({ referenceImages: nextImages, referenceWeights: nextWeights })

    if (selectedIndex === sourceIndex) {
      setSelectedIndex(targetIndex)
    } else if (selectedIndex !== null) {
      if (sourceIndex < selectedIndex && targetIndex >= selectedIndex) {
        setSelectedIndex(selectedIndex - 1)
      } else if (sourceIndex > selectedIndex && targetIndex <= selectedIndex) {
        setSelectedIndex(selectedIndex + 1)
      }
    }
  }

  return (
    <div className='space-y-3'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium text-[var(--juhe-text)]'>
            {t('generate.referenceImages.title')} ({count}/{MAX_IMAGES})
          </span>
          {isMaxReached && (
            <span className='text-xs text-[var(--juhe-amber)]'>{t('generate.referenceImages.maxReached')}</span>
          )}
        </div>
        {count > 0 && (
          <button
            type='button'
            onClick={clearAll}
            className='flex items-center gap-1 text-xs text-[var(--juhe-text-2)] hover:text-[var(--juhe-magenta)] transition-colors'
            title={t('generate.referenceImages.clearAll')}
          >
            <Trash2 className='w-3.5 h-3.5' />
            {t('generate.referenceImages.clearAll')}
          </button>
        )}
      </div>

      {/* Image basket */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      <div
        ref={scrollRef}
        onDragOver={onDragOverBasket}
        onDragLeave={onDragLeaveBasket}
        onDrop={onDropBasket}
        className={[
          'flex items-center gap-2 overflow-x-auto pb-1 rounded-lg border border-dashed p-2 transition-colors',
          isDraggingOver
            ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/5'
            : 'border-[var(--juhe-border)] bg-[var(--juhe-void-2)]'
        ].join(' ')}
      >
        {images.map((img, i) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
            key={`${img.slice(-20)}-${i}`}
            draggable
            onDragStart={(e) => onDragStart(e, i)}
            onDragOver={(e) => onDragOverItem(e, i)}
            onDrop={(e) => onDropItem(e, i)}
            onClick={() => setSelectedIndex(i)}
            className={[
              'group relative flex-shrink-0 w-20 h-24 rounded-lg overflow-hidden border cursor-pointer select-none transition-all',
              selectedIndex === i
                ? 'border-[var(--juhe-cyan)] ring-1 ring-[var(--juhe-cyan)] shadow-sm'
                : 'border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50',
              dragOverIndex === i ? 'scale-105' : ''
            ].join(' ')}
          >
            {/* 顺序编号 */}
            <div className='absolute top-0.5 left-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[10px] font-bold text-white shadow-sm'>
              {i + 1}
            </div>
            <img
              src={img}
              alt={t('generate.referenceImages.imageN', { n: i + 1 })}
              className='w-full h-14 object-cover'
            />
            <div className='absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
              <GripVertical className='w-3 h-3 text-white drop-shadow' />
            </div>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                removeImage(i)
              }}
              className='absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white
                         opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70'
            >
              <X className='w-2.5 h-2.5' />
            </button>
            <div className='absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5'>
              {Math.round((weights[i] ?? 0.5) * 100)}%
            </div>
            {/* Drag handle visual */}
            <div className='absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none'>
              <GripVertical className='w-5 h-5 text-white/70 drop-shadow-md' />
            </div>
          </div>
        ))}

        {/* Add button */}
        {!isMaxReached && (
          <button
            type='button'
            onClick={() => inputRef.current?.click()}
            className='flex-shrink-0 w-20 h-24 rounded-lg border border-dashed border-[var(--juhe-border)]
                       flex flex-col items-center justify-center gap-1 text-[var(--juhe-text-3)]
                       hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/50 transition-colors'
            title={t('generate.referenceImages.clickToAdd')}
          >
            <ImagePlus className='w-5 h-5' />
            <span className='text-[10px]'>{t('generate.referenceImages.clickToAdd')}</span>
          </button>
        )}

        {/* Empty drop zone hint */}
        {count === 0 && (
          <div className='flex-1 flex flex-col items-center justify-center gap-1 text-[var(--juhe-text-3)] py-4'>
            <Upload className='w-5 h-5' />
            <span className='text-xs'>{t('generate.referenceImages.dragDrop')}</span>
          </div>
        )}
      </div>

      {/* Selected image weight */}
      {selectedIndex !== null && images[selectedIndex] && (
        <div className='space-y-1'>
          <div className='flex items-center justify-between text-xs text-[var(--juhe-text-2)]'>
            <span>
              {t('generate.referenceImages.imageN', { n: selectedIndex + 1 })} — {t('generate.referenceImages.weight')}
            </span>
            <span>{Math.round((weights[selectedIndex] ?? 0.5) * 100)}%</span>
          </div>
          <input
            type='range'
            min={0}
            max={1}
            step={0.05}
            value={weights[selectedIndex] ?? 0.5}
            onChange={(e) => setImageWeight(selectedIndex, Number(e.target.value))}
            className='w-full accent-[var(--juhe-cyan)]'
          />
        </div>
      )}

      {/* Global weight */}
      <div className='space-y-1'>
        <div className='flex items-center justify-between text-xs text-[var(--juhe-text-2)]'>
          <span>{t('generate.referenceImages.globalWeight')}</span>
          <span>{Math.round((params.referenceWeight ?? 0.5) * 100)}%</span>
        </div>
        <input
          type='range'
          min={0}
          max={1}
          step={0.05}
          value={params.referenceWeight ?? 0.5}
          onChange={(e) => setGlobalWeight(Number(e.target.value))}
          className='w-full accent-[var(--juhe-cyan)]'
        />
      </div>

      {/* Reference mode selector */}
      <div className='space-y-1'>
        <span className='text-xs text-[var(--juhe-text-2)]'>{t('generate.referenceImages.fusionMode')}</span>
        <div className='flex gap-2'>
          {(['fusion', 'controlnet', 'ipadapter'] as const).map((mode) => (
            <button
              type='button'
              key={mode}
              onClick={() => setParams({ referenceMode: mode })}
              className={[
                'flex-1 text-xs py-1.5 rounded-md border transition-colors',
                params.referenceMode === mode || (mode === 'fusion' && !params.referenceMode)
                  ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  : 'border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/50'
              ].join(' ')}
            >
              {mode === 'fusion' && t('generate.referenceImages.modeFusion')}
              {mode === 'controlnet' && t('generate.referenceImages.modeControlNet')}
              {mode === 'ipadapter' && t('generate.referenceImages.modeIPAdapter')}
            </button>
          ))}
        </div>
      </div>

      <input ref={inputRef} type='file' accept='image/*' multiple onChange={handleFileSelect} className='hidden' />
    </div>
  )
}
