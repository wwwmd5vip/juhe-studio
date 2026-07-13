/**
 * TemplateSelector — 行业模板选择器
 * 展示分类模板列表，支持变量填充和一键应用
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Sparkles } from 'lucide-react'
import { INDUSTRY_TEMPLATES, TEMPLATE_CATEGORIES, interpolateTemplate, type IndustryTemplate } from './templates'

interface TemplateSelectorProps {
  onApply: (prompt: string, negativePrompt?: string, size?: string) => void
  onClose?: () => void
}

export function TemplateSelector({ onApply, onClose }: TemplateSelectorProps) {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState('ecommerce')
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})

  const templates = useMemo(
    () => INDUSTRY_TEMPLATES.filter((t) => t.category === activeCategory),
    [activeCategory]
  )

  const preview = useMemo(() => {
    if (!selectedTemplate) return null
    return interpolateTemplate(selectedTemplate, variableValues)
  }, [selectedTemplate, variableValues])

  const handleSelectTemplate = (t: IndustryTemplate) => {
    setSelectedTemplate(t)
    const initial: Record<string, string> = {}
    for (const v of t.variables) initial[v.key] = v.defaultValue || ''
    setVariableValues(initial)
  }

  const handleApply = () => {
    if (!selectedTemplate || !preview) return
    onApply(preview.prompt, preview.negativePrompt, selectedTemplate.size)
    onClose?.()
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />
      <div className='relative w-full max-w-2xl max-h-[80vh] rounded-2xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] shadow-2xl flex flex-col overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-3 border-b border-[var(--juhe-border)]'>
          <h2 className='text-sm font-semibold text-[var(--juhe-text)] flex items-center gap-2'>
            <Sparkles className='w-4 h-4 text-[var(--juhe-amber)]' />
            {t('industryTemplates.title')}
          </h2>
          {onClose && (
            <button type='button' onClick={onClose} className='p-1 rounded-md text-[var(--juhe-text-3)] hover:bg-[var(--juhe-surface)]'>✕</button>
          )}
        </div>

        {/* Categories */}
        <div className='flex gap-1.5 px-5 py-2.5 border-b border-[var(--juhe-border)] overflow-x-auto'>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type='button'
              onClick={() => { setActiveCategory(cat.id); setSelectedTemplate(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)]'
                  : 'text-[var(--juhe-text-3)] hover:bg-[var(--juhe-surface)]'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto'>
          {!selectedTemplate ? (
            <div className='p-4 grid grid-cols-1 sm:grid-cols-2 gap-2'>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type='button'
                  onClick={() => handleSelectTemplate(t)}
                  className='flex items-start gap-3 p-3 rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)]/50 hover:border-[var(--juhe-cyan)]/30 hover:bg-[var(--juhe-surface)] transition-all text-left group'
                >
                  <span className='text-2xl shrink-0 mt-0.5'>{t.icon}</span>
                  <div className='min-w-0 flex-1'>
                    <div className='text-xs font-semibold text-[var(--juhe-text)] flex items-center gap-1'>
                      {t.name}
                      <ChevronRight className='w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity' style={{ color: 'var(--juhe-cyan)' }} />
                    </div>
                    <p className='text-[10px] text-[var(--juhe-text-3)] mt-0.5 line-clamp-2'>{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className='p-4 space-y-4'>
              {/* Back + template info */}
              <button type='button' onClick={() => setSelectedTemplate(null)} className='text-[11px] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] flex items-center gap-1'>
                {t('industryTemplates.backToList')}
              </button>
              <div className='flex items-center gap-2'>
                <span className='text-xl'>{selectedTemplate.icon}</span>
                <div>
                  <h3 className='text-sm font-semibold text-[var(--juhe-text)]'>{selectedTemplate.name}</h3>
                  <p className='text-[10px] text-[var(--juhe-text-3)]'>{selectedTemplate.description}</p>
                </div>
              </div>

              {/* Variables */}
              {selectedTemplate.variables.length > 0 && (
                <div className='space-y-2.5'>
                  <span className='text-[10px] font-medium text-[var(--juhe-text-3)] uppercase tracking-wider'>{t('industryTemplates.fillVariables')}</span>
                  {selectedTemplate.variables.map((v) => (
                    <div key={v.key}>
                      <label className='block text-[11px] font-medium text-[var(--juhe-text-2)] mb-1'>{v.label} ({`${v.key}`})</label>
                      <input
                        type='text'
                        value={variableValues[v.key] || ''}
                        onChange={(e) => setVariableValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                        placeholder={v.placeholder}
                        className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-xs text-[var(--juhe-text)] outline-none focus:border-[var(--juhe-cyan)]'
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div className='space-y-2'>
                  <span className='text-[10px] font-medium text-[var(--juhe-text-3)] uppercase tracking-wider'>{t('industryTemplates.previewGeneration')}</span>
                  <div className='p-3 rounded-lg bg-[var(--juhe-void)] border border-[var(--juhe-border)]'>
                    <p className='text-[11px] text-[var(--juhe-text-2)] leading-relaxed line-clamp-6'>{preview.prompt}</p>
                    {preview.negativePrompt && (
                      <p className='text-[10px] text-[var(--juhe-text-3)] mt-2 line-clamp-2'>
                        <span className='font-medium'>{t('industryTemplates.exclude')}</span>{preview.negativePrompt}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <button
                type='button'
                onClick={handleApply}
                className='w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-br from-[#f59e0b] to-[#d97706] hover:shadow-lg transition-all flex items-center justify-center gap-2'
              >
                <Sparkles className='w-3.5 h-3.5' />
                {t('industryTemplates.applyToInput')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
