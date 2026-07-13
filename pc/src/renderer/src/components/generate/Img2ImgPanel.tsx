import type { ImageSize } from '@shared/types/generation'
import { Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation'

export function Img2ImgSourceImage() {
  const { t } = useTranslation()
  const { params, setParams } = useGenerationStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const sourceImage = params.firstFrame || params.referenceImages?.[0]

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setParams({ firstFrame: base64, referenceImages: [base64] })
      }
      reader.readAsDataURL(file)
    },
    [setParams]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDraggingOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const clearImage = () => {
    setParams({ firstFrame: null, referenceImages: [] })
  }

  if (sourceImage) {
    return (
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-[var(--juhe-text)]'>{t('img2img.sourceImage')}</span>
          <button
            type='button'
            onClick={clearImage}
            className='flex items-center gap-1 text-xs text-[var(--juhe-text-2)] hover:text-[var(--juhe-magenta)] transition-colors'
          >
            <X className='w-3.5 h-3.5' />
            {t('common.clear')}
          </button>
        </div>
        <div className='relative rounded-lg border border-[var(--juhe-border)] overflow-hidden'>
          <img src={sourceImage} alt='source' className='w-full h-48 object-contain bg-[var(--juhe-surface)]/30' />
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      <span className='text-sm font-medium text-[var(--juhe-text)]'>{t('img2img.sourceImage')}</span>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors',
          isDraggingOver
            ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/5'
            : 'border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/30'
        ].join(' ')}
      >
        <Upload className='w-8 h-8 text-[var(--juhe-text-3)]' />
        <span className='text-sm text-[var(--juhe-text-2)]'>{t('img2img.dragDropOrClick')}</span>
        <span className='text-xs text-[var(--juhe-text-3)]'>{t('img2img.supportedFormats')}</span>
      </div>
      <input ref={inputRef} type='file' accept='image/*' onChange={handleInputChange} className='hidden' />
    </div>
  )
}

const TRANSFORMATIONS = [
  { id: 'style-transfer', labelKey: 'img2img.transformationStyleTransfer' },
  { id: 'upscale', labelKey: 'img2img.transformationUpscale' },
  { id: 'inpaint', labelKey: 'img2img.transformationInpaint' },
  { id: 'redraw', labelKey: 'img2img.transformationRedraw' },
  { id: 'variant', labelKey: 'img2img.transformationVariant' },
  { id: 'lineart', labelKey: 'img2img.transformationLineart' }
] as const

const STYLES = ['vivid', 'natural', 'digital-art', 'photographic', 'anime'] as const
const QUALITIES = ['standard', 'hd', 'high', 'medium', 'low'] as const
const SIZES: { labelKey: string; value: string }[] = [
  { labelKey: 'generate.sizes.1024x1024', value: '1024x1024' },
  { labelKey: 'generate.sizes.1024x1536', value: '1024x1536' },
  { labelKey: 'generate.sizes.1536x1024', value: '1536x1024' },
  { labelKey: 'generate.sizes.512x512', value: '512x512' },
  { labelKey: 'generate.sizes.768x768', value: '768x768' }
]

export function Img2ImgParameterPanel() {
  const { t } = useTranslation()
  const { params, setParams } = useGenerationStore()

  return (
    <div className='space-y-4'>
      {/* Transformation */}
      <div className='space-y-1.5'>
        <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('img2img.transformation')}</label>
        <div className='grid grid-cols-2 gap-1.5'>
          {TRANSFORMATIONS.map((tform) => (
            <button
              type='button'
              key={tform.id}
              onClick={() => setParams({ transformation: tform.id })}
              className={[
                'px-2 py-1.5 text-xs rounded-md border transition-colors text-left',
                params.transformation === tform.id
                  ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  : 'border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/50'
              ].join(' ')}
            >
              {t(tform.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className='space-y-1.5'>
        <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('generate.params.style')}</label>
        <div className='flex flex-wrap gap-1.5'>
          {STYLES.map((style) => (
            <button
              type='button'
              key={style}
              onClick={() => setParams({ style })}
              className={[
                'px-2.5 py-1 text-xs rounded-md border transition-colors',
                params.style === style
                  ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  : 'border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/50'
              ].join(' ')}
            >
              {t(`generate.styles.${style}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className='space-y-1.5'>
        <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('generate.params.quality')}</label>
        <div className='flex flex-wrap gap-1.5'>
          {QUALITIES.map((q) => (
            <button
              type='button'
              key={q}
              onClick={() => setParams({ quality: q })}
              className={[
                'px-2.5 py-1 text-xs rounded-md border transition-colors',
                params.quality === q
                  ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  : 'border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/50'
              ].join(' ')}
            >
              {t(`generate.qualities.${q}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className='space-y-1.5'>
        <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('generate.params.size')}</label>
        <div className='flex flex-wrap gap-1.5'>
          {SIZES.map((s) => (
            <button
              type='button'
              key={s.value}
              onClick={() => setParams({ size: s.value as ImageSize })}
              className={[
                'px-2.5 py-1 text-xs rounded-md border transition-colors',
                params.size === s.value
                  ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  : 'border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/50'
              ].join(' ')}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Strength / Reference Weight */}
      <div className='space-y-1.5'>
        <div className='flex items-center justify-between'>
          <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('img2img.strength')}</label>
          <span className='text-xs text-[var(--juhe-text-2)]'>
            {Math.round((params.referenceWeight ?? 0.5) * 100)}%
          </span>
        </div>
        <input
          type='range'
          min={0}
          max={1}
          step={0.05}
          value={params.referenceWeight ?? 0.5}
          onChange={(e) => setParams({ referenceWeight: Number(e.target.value) })}
          className='w-full accent-[var(--juhe-cyan)]'
        />
      </div>

      {/* Seed */}
      <div className='space-y-1.5'>
        <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('generate.params.seed')}</label>
        <div className='flex gap-2'>
          <input
            type='number'
            value={params.seed ?? ''}
            onChange={(e) => {
              const val = e.target.value
              const num = val ? Number(val) : undefined
              if (num !== undefined && (num < -99999999 || num > 99999999)) return
              setParams({ seed: num })
            }}
            placeholder={t('generate.params.random')}
            min={-99999999}
            max={99999999}
            className='flex-1 px-3 py-1.5 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-[var(--juhe-text)] focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
          />
          <button
            type='button'
            onClick={() => setParams({ seed: Math.floor(Math.random() * 99999999) })}
            className='px-3 py-1.5 text-xs rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)] transition-colors'
            title={t('generate.params.randomSeed')}
          >
            {t('generate.params.random')}
          </button>
        </div>
      </div>
    </div>
  )
}
