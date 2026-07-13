import { Layers, LayoutGrid, Palette, Shuffle, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface VariantModalProps {
  sourceImage: string
  sourcePrompt: string
  onClose: () => void
  onGenerate: (params: { type: string; strength: number; count: number; style?: string }) => void
}

const variantTypes = [
  { key: 'style', labelKey: 'variantStyle', icon: Layers },
  { key: 'composition', labelKey: 'variantComposition', icon: LayoutGrid },
  { key: 'color', labelKey: 'variantColor', icon: Palette },
  { key: 'detail', labelKey: 'variantDetail', icon: Sparkles }
]

const styleOptions: { value: string; label: string }[] = [
  { value: 'vivid', label: 'Vivid' },
  { value: 'natural', label: 'Natural' },
  { value: 'digital-art', label: 'Digital Art' },
  { value: 'photographic', label: 'Photographic' },
  { value: 'anime', label: 'Anime' }
]

export function VariantModal({ sourceImage, sourcePrompt, onClose, onGenerate }: VariantModalProps) {
  const { t } = useTranslation()
  const [type, setType] = useState('style')
  const [strength, setStrength] = useState(50)
  const [count, setCount] = useState(2)
  const [style, setStyle] = useState('vivid')

  const handleGenerate = () => {
    onGenerate({
      type,
      strength,
      count,
      ...(type === 'style' ? { style } : {})
    })
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-[var(--juhe-surface)] rounded-xl border border-[var(--juhe-border)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
          <h3 className='font-semibold text-sm flex items-center gap-2 text-[var(--juhe-text)]'>
            <Shuffle className='w-4 h-4 text-[var(--juhe-cyan)]' />
            {t('generate.resultGallery.variantModalTitle')}
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='p-1 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors'
            aria-label={t('common.close')}
          >
            <X className='w-4 h-4 text-[var(--juhe-text-2)]' />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto p-4 space-y-5'>
          {/* Source Image Preview */}
          <div>
            <label className='text-xs font-medium text-[var(--juhe-text-3)] mb-2 block'>
              {t('generate.resultGallery.sourceImage')}
            </label>
            <div className='rounded-lg border border-[var(--juhe-border)] overflow-hidden bg-[var(--juhe-surface-2)]/30'>
              <img src={sourceImage} alt='Source' className='w-full max-h-48 object-contain' />
            </div>
            {sourcePrompt && (
              <p className='mt-2 text-xs text-[var(--juhe-text-3)] truncate' title={sourcePrompt}>
                {sourcePrompt}
              </p>
            )}
          </div>

          {/* Variant Type Selector */}
          <div>
            <label className='text-xs font-medium text-[var(--juhe-text-3)] mb-2 block'>
              {t('generate.resultGallery.variantType')}
            </label>
            <div className='grid grid-cols-2 gap-2'>
              {variantTypes.map((vt) => {
                const Icon = vt.icon
                const isActive = type === vt.key
                return (
                  <button
                    type='button'
                    key={vt.key}
                    onClick={() => setType(vt.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                      ${
                        isActive
                          ? 'bg-[var(--juhe-cyan)]/10 border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
                          : 'bg-[var(--juhe-surface)] border-[var(--juhe-border)] text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]/50'
                      }`}
                  >
                    <Icon className='w-3.5 h-3.5' />
                    {t(`generate.resultGallery.${vt.labelKey}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Style Selector (only for style variant) */}
          {type === 'style' && (
            <div>
              <label className='text-xs font-medium text-[var(--juhe-text-3)] mb-2 block'>
                {t('generate.params.style')}
              </label>
              <div className='flex flex-wrap gap-2'>
                {styleOptions.map((opt) => {
                  const isActive = style === opt.value
                  return (
                    <button
                      type='button'
                      key={opt.value}
                      onClick={() => setStyle(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                        ${
                          isActive
                            ? 'bg-[var(--juhe-cyan)]/10 border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
                            : 'bg-[var(--juhe-surface)] border-[var(--juhe-border)] text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]/50'
                        }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Strength Slider */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='text-xs font-medium text-[var(--juhe-text-3)]'>
                {t('generate.resultGallery.strength')}
              </label>
              <span className='text-xs font-medium text-[var(--juhe-text)]'>{strength}%</span>
            </div>
            <input
              type='range'
              min={0}
              max={100}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className='w-full h-2 bg-[var(--juhe-surface-2)] rounded-lg appearance-none cursor-pointer accent-[var(--juhe-cyan)]'
            />
            <div className='flex justify-between mt-1'>
              <span className='text-[10px] text-[var(--juhe-text-3)]'>{t('imageProcess.params.conservative')}</span>
              <span className='text-[10px] text-[var(--juhe-text-3)]'>{t('imageProcess.params.aggressive')}</span>
            </div>
          </div>

          {/* Count Selector */}
          <div>
            <label className='text-xs font-medium text-[var(--juhe-text-3)] mb-2 block'>
              {t('generate.resultGallery.variantCount')}
            </label>
            <div className='flex gap-2'>
              {[1, 2, 3, 4].map((n) => (
                <button
                  type='button'
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors
                    ${
                      count === n
                        ? 'bg-[var(--juhe-cyan)]/10 border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
                        : 'bg-[var(--juhe-surface)] border-[var(--juhe-border)] text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]/50'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='px-4 py-3 border-t border-[var(--juhe-border)] flex items-center justify-end gap-2'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 rounded-lg text-xs font-medium border border-[var(--juhe-border)] bg-[var(--juhe-surface)] hover:bg-[var(--juhe-surface-2)] transition-colors text-[var(--juhe-text)]'
          >
            {t('common.cancel')}
          </button>
          <button
            type='button'
            onClick={handleGenerate}
            className='px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 transition-colors flex items-center gap-1.5'
          >
            <Shuffle className='w-3.5 h-3.5' />
            {t('generate.resultGallery.variant')}
          </button>
        </div>
      </div>
    </div>
  )
}
