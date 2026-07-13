import type { PromptTemplate } from '@shared/types/prompt-system'
import type { LucideIcon } from 'lucide-react'
import { Bot, Check, Copy, Image, Loader2, Package, Wand2 } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export interface PromptLibraryCardProps {
  template: PromptTemplate
  onUse?: (prompt: string) => void
  onCopy?: () => void
  onPreview?: () => void
  onUseApplied?: (id: string) => void
  copiedId?: string | null
  actionLoading?: boolean
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; gradient: string; labelKey: string }> = {
  image: { icon: Image, gradient: 'from-purple-500 to-pink-400', labelKey: 'typeImage' },
  agent: { icon: Bot, gradient: 'from-cyan-500 to-blue-500', labelKey: 'typeAgent' },
  package: { icon: Package, gradient: 'from-emerald-500 to-teal-400', labelKey: 'typePackage' }
}

const FALLBACK_TYPE = { icon: Image, gradient: 'from-gray-500 to-slate-400', labelKey: 'typeUnknown' }

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || FALLBACK_TYPE
}

export default function PromptLibraryCard({
  template,
  onUse,
  onCopy,
  onPreview,
  onUseApplied,
  copiedId,
  actionLoading
}: PromptLibraryCardProps) {
  const { t } = useTranslation()
  const config = getTypeConfig(template.category)
  const Icon = config.icon

  const isCopied = copiedId === template.id
  const isUseCopied = copiedId === `use-${template.id}`

  const handleCopy = useCallback(() => {
    onCopy?.()
  }, [onCopy])

  const handleUse = useCallback(() => {
    onUse?.(template.prompt)
    onUseApplied?.(template.id)
  }, [onUse, onUseApplied, template.prompt, template.id])

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom interactive element, button semantics not appropriate
<div
      className='group relative flex flex-col overflow-hidden rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/40 hover:shadow-lg hover:shadow-[var(--juhe-cyan)]/5 transition-all duration-300'
      onClick={onPreview}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview?.()
        }
      }}
    >
      {/* Type gradient header */}
      <div
        className={`relative h-20 bg-gradient-to-br ${config.gradient} flex items-center justify-center overflow-hidden shrink-0`}
      >
        <div className='absolute inset-0 bg-black/10' />
        <Icon className='w-8 h-8 text-white/80 relative z-10' />
        <div className='absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10' />
        <div className='absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5' />

        {/* Type label */}
        <span className='absolute bottom-2 left-3 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 text-white text-[10px] font-medium backdrop-blur-sm'>
          <Icon className='w-3 h-3' />
          {t(`prompts.library.filters.${config.labelKey}`)}
        </span>
      </div>

      {/* Card body */}
      <div className='flex flex-col flex-1 p-4'>
        {/* Title */}
        <h3 className='font-semibold text-sm leading-tight text-[var(--juhe-text)] line-clamp-2 mb-1.5'>
          {template.name}
        </h3>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className='flex flex-wrap gap-1 mb-3'>
            {template.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className='inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] text-[10px] font-medium'
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 4 && (
              <span className='inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] text-[10px] font-medium'>
                +{template.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {template.description && (
          <p className='text-xs text-[var(--juhe-text-3)] line-clamp-2 leading-relaxed mb-2'>{template.description}</p>
        )}

        {/* Actions */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
        <div className='mt-auto flex gap-2' onClick={(e) => e.stopPropagation()}>
          <button
            type='button'
            onClick={handleUse}
            disabled={actionLoading}
            className='flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60'
          >
            {actionLoading ? (
              <Loader2 className='w-3.5 h-3.5 animate-spin' />
            ) : isUseCopied ? (
              <Check className='w-3.5 h-3.5' />
            ) : (
              <Wand2 className='w-3.5 h-3.5' />
            )}
            {actionLoading ? t('common.loading') : isUseCopied ? t('prompts.applied') : t('prompts.useTemplate')}
          </button>
          <button
            type='button'
            onClick={handleCopy}
            disabled={actionLoading}
            className='inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--juhe-surface-2)] border border-[var(--juhe-border)] text-[var(--juhe-text-2)] text-xs font-medium hover:border-[var(--juhe-cyan)]/30 hover:text-[var(--juhe-text)] transition-colors disabled:opacity-60'
            title={t('prompts.copyTemplate')}
          >
            {actionLoading ? (
              <Loader2 className='w-3.5 h-3.5 animate-spin' />
            ) : isCopied ? (
              <Check className='w-3.5 h-3.5 text-[var(--juhe-emerald)]' />
            ) : (
              <Copy className='w-3.5 h-3.5' />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
