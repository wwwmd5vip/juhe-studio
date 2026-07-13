import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation'

export function PromptInput() {
  const { t } = useTranslation()
  const { params, setParams } = useGenerationStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParams({ prompt: e.target.value })
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`
  }

  const handleNegativePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setParams({ negativePrompt: e.target.value })
  }

  return (
    <div className='space-y-3'>
      <div>
        <label className='block text-sm font-medium mb-1.5 text-[var(--juhe-text)]'>
          {t('generate.prompt')}
          <span className='text-xs text-[var(--juhe-text-2)] ml-2'>{params.prompt.length} chars</span>
        </label>
        <textarea
          ref={textareaRef}
          value={params.prompt}
          onChange={handlePromptChange}
          placeholder={t('generate.promptPlaceholder')}
          className='w-full px-3 py-2.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)]
                     resize-none min-h-[80px] max-h-[300px]
                     focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30
                     placeholder:text-[var(--juhe-text-3)]'
        />
      </div>

      <details className='group'>
        <summary className='text-sm text-[var(--juhe-text-2)] cursor-pointer hover:text-[var(--juhe-text)] transition-colors list-none flex items-center gap-1'>
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
          <svg
            className='w-4 h-4 transition-transform group-open:rotate-90'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
          {t('generate.negativePrompt')}
        </summary>
        <textarea
          value={params.negativePrompt || ''}
          onChange={handleNegativePromptChange}
          placeholder={t('generate.negativePromptPlaceholder')}
          className='w-full mt-2 px-3 py-2.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)]
                     resize-none min-h-[60px]
                     focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30
                     placeholder:text-[var(--juhe-text-3)]'
        />
      </details>
    </div>
  )
}
