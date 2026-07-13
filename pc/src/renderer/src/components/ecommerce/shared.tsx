/**
 * Shared UI components for ecommerce flows
 */

import { Download, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TaskModelSelector } from '@/components/common/TaskModelSelector'

// ---- Image Upload ----

export function ImageUploadArea({
  image,
  setImage,
  label,
  hint,
  accept = 'image/*'
}: {
  image: string | null
  setImage: (img: string | null) => void
  label: string
  hint: string
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => setImage(reader.result as string)
      reader.readAsDataURL(file)
    },
    [setImage]
  )

  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium' style={{ color: 'var(--juhe-text-2)' }}>
        {label}
      </div>
      <button
        type='button'
        onClick={() => inputRef.current?.click()}
        className='relative group w-full rounded-xl border-2 border-dashed transition-colors overflow-hidden'
        style={{
          aspectRatio: '4/3',
          borderColor: image ? 'var(--juhe-cyan)/30' : 'var(--juhe-border)',
          background: image ? 'transparent' : 'var(--juhe-surface-2)'
        }}
      >
        <input ref={inputRef} type='file' accept={accept} className='hidden' onChange={handleUpload} />
        {image ? (
          <>
            <img src={image} alt={label} className='w-full h-full object-cover' />
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                setImage(null)
              }}
              className='absolute top-2 right-2 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          </>
        ) : (
          <div
            className='absolute inset-0 flex flex-col items-center justify-center gap-2'
            style={{ color: 'var(--juhe-text-3)' }}
          >
            <ImagePlus className='w-8 h-8' />
            <span className='text-xs'>{hint}</span>
          </div>
        )}
      </button>
    </div>
  )
}

// ---- Model Selector ----

export function ModelSelector({
  providerId,
  model,
  setProvider,
  setModel
}: {
  providerId: string
  model: string
  setProvider: (id: string) => void
  setModel: (m: string) => void
}) {
  return (
    <div className='max-w-md'>
      <TaskModelSelector
        capabilities={['image']}
        providerId={providerId}
        model={model}
        onChange={({ providerId: pid, model: mid }) => {
          setProvider(pid)
          setModel(mid)
        }}
      />
    </div>
  )
}

// ---- Flow Layout (generate button + results grid) ----

export function FlowLayout({
  children,
  canGenerate,
  isGenerating,
  results,
  generate,
  resultsGrid,
  generateLabel
}: {
  children: React.ReactNode
  canGenerate: boolean
  isGenerating: boolean
  results: string[]
  generate: () => void
  resultsGrid: string
  generateLabel?: string
}) {
  const { t } = useTranslation()

  const handleDownload = (url: string, index: number) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `ecommerce-${Date.now()}-${index + 1}.png`
    a.target = '_blank'
    a.click()
  }

  return (
    <div className='space-y-6'>
      {children}
      <button
        type='button'
        onClick={generate}
        disabled={!canGenerate}
        className='w-full py-3 rounded-xl text-sm font-semibold transition-all'
        style={{
          background: isGenerating
            ? 'var(--juhe-magenta)/10'
            : canGenerate
              ? 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-violet))'
              : 'var(--juhe-surface-2)',
          color: canGenerate && !isGenerating ? 'white' : isGenerating ? 'var(--juhe-magenta)' : 'var(--juhe-text-3)',
          cursor: canGenerate ? 'pointer' : 'not-allowed'
        }}
      >
        {isGenerating ? (
          <span className='flex items-center justify-center gap-2'>
            <Loader2 className='w-4 h-4 animate-spin' />
            {t('ecommerce.generating')}
          </span>
        ) : (
          <span className='flex items-center justify-center gap-2'>
            <Sparkles className='w-4 h-4' />
            {generateLabel ?? t('ecommerce.generate')}
          </span>
        )}
      </button>
      {results.length > 0 && (
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold' style={{ color: 'var(--juhe-text)' }}>
              {t('ecommerce.results')}
            </h3>
            <span className='text-xs' style={{ color: 'var(--juhe-text-3)' }}>
              {results.length} {t('common.images')}
            </span>
          </div>
          <div className={`grid gap-3 ${resultsGrid}`}>
            {results.map((url, index) => (
              <div
                key={url}
                className='group relative rounded-xl border overflow-hidden'
                style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface-2)/20' }}
              >
                <img src={url} alt={`Result ${index + 1}`} className='w-full aspect-square object-cover' />
                <div
                  className='absolute inset-x-0 bottom-0 p-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity'
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }}
                >
                  <button
                    type='button'
                    onClick={() => handleDownload(url, index)}
                    className='p-1.5 rounded-md transition-colors'
                    style={{ background: 'white/90', color: 'var(--juhe-text)' }}
                  >
                    <Download className='w-3.5 h-3.5' />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
