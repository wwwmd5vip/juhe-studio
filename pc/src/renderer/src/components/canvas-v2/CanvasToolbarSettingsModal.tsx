/**
 * CanvasToolbarSettingsModal.tsx — 图片工具栏自定义弹窗
 * 勾选/取消工具 + 显示/隐藏标签 + 实时预览
 */

import { Check, ImageIcon, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface QuickToolDef {
  id: string
  title: string
  label: string
  icon: React.ReactNode
  defaultVisible?: boolean
}

interface Props {
  open: boolean
  tools: QuickToolDef[]
  selectedIds: string[]
  showLabels: boolean
  onToggle: (id: string, visible: boolean) => void
  onShowLabelsChange: (value: boolean) => void
  onCancel: () => void
  onSave: () => void
}

export function CanvasToolbarSettingsModal({
  open,
  tools,
  selectedIds,
  showLabels,
  onToggle,
  onShowLabelsChange,
  onCancel,
  onSave
}: Props) {
  const { t } = useTranslation()
  const [previewSelectedIds, setPreviewSelectedIds] = useState<string[]>(selectedIds)
  const [previewShowLabels, setPreviewShowLabels] = useState(showLabels)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setPreviewSelectedIds(selectedIds)
      setPreviewShowLabels(showLabels)
    }
  }, [open, selectedIds, showLabels])

  const handleToggle = useCallback((id: string) => {
    setPreviewSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const handleSave = useCallback(() => {
    // Apply all toggles
    tools.forEach((t) => {
      const wasSelected = selectedIds.includes(t.id)
      const isSelected = previewSelectedIds.includes(t.id)
      if (wasSelected !== isSelected) {
        onToggle(t.id, isSelected)
      }
    })
    if (previewShowLabels !== showLabels) {
      onShowLabelsChange(previewShowLabels)
    }
    onSave()
  }, [tools, selectedIds, previewSelectedIds, showLabels, previewShowLabels, onToggle, onShowLabelsChange, onSave])

  if (!open) return null

  const visibleTools = tools.filter((t) => previewSelectedIds.includes(t.id))

  return (
    <div className='fixed inset-0 z-[95] flex items-center justify-center'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onCancel} />
      <div className='relative w-[680px] max-h-[85vh] overflow-y-auto rounded-2xl bg-[#1c1c1e] p-6 shadow-2xl'>
        {/* Header */}
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-base font-semibold text-white'>
            <Settings2 className='mr-2 inline size-4' />
            {t('canvas.toolbarSettings.title')}
          </h3>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-lg p-1 text-white/40 transition hover:bg-white/5 hover:text-white/60'
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='3' y1='3' x2='13' y2='13' />
              <line x1='13' y1='3' x2='3' y2='13' />
            </svg>
          </button>
        </div>

        <p className='mb-4 text-xs text-white/40'>{t('canvas.toolbarSettings.description')}</p>

        {/* Preview card */}
        <div className='mb-5 rounded-xl border border-white/10 p-4'>
          <div className='mb-2 flex items-center gap-2 text-xs text-white/40'>
            <Settings2 className='size-3.5' /> {t('canvas.toolbarSettings.nodePreview')}
          </div>

          {/* Toolbar preview */}
          <div
            ref={scrollRef}
            className='hide-scrollbar mb-3 overflow-x-auto rounded-[18px] border border-white/10 bg-white/[.03] shadow-sm'
          >
            <div className='flex items-center gap-0.5 px-1.5 py-1'>
              {visibleTools.map((tool) => (
                <div
                  key={tool.id}
                  className={`flex shrink-0 items-center rounded-xl px-2 py-1 text-xs transition ${
                    previewShowLabels ? 'gap-1.5' : 'justify-center'
                  }`}
                  style={{ color: 'currentColor' }}
                >
                  <span className='flex size-5 items-center justify-center opacity-60'>{tool.icon}</span>
                  {previewShowLabels && <span className='text-[11px] text-white/50'>{tool.label}</span>}
                </div>
              ))}
              {visibleTools.length > 0 && (
                <div
                  className={`flex shrink-0 items-center rounded-xl px-2 py-1 text-xs text-white/30 ${previewShowLabels ? 'gap-1.5' : 'justify-center'}`}
                >
                  <span className='flex size-5 items-center justify-center opacity-40'>
                    {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='2'>
                      <line x1='4' y1='2' x2='4' y2='6' />
                      <line x1='8' y1='2' x2='8' y2='6' />
                      <line x1='4' y1='6' x2='4' y2='10' />
                      <line x1='8' y1='6' x2='8' y2='10' />
                    </svg>
                  </span>
                  {previewShowLabels && <span className='text-[11px]'>{t('canvas.toolbarSettings.more')}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Mock node */}
          <div className='flex h-24 items-center justify-center rounded-xl border border-white/5'>
            <div className='flex flex-col items-center gap-1 text-white/20'>
              <ImageIcon className='size-6' />
              <span className='text-[11px]'>{t('canvas.toolbarSettings.imageNode')}</span>
            </div>
          </div>
        </div>

        {/* Tool selection grid */}
        <div className='mb-4 flex items-center justify-between'>
          <span className='text-xs text-white/50'>
            {t('canvas.toolbarSettings.quickTools')}
            <span className='ml-2 inline-flex items-center gap-0.5 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/60'>
              {previewSelectedIds.length}/{tools.length}
            </span>
          </span>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          {tools.map((tool) => {
            const isSelected = previewSelectedIds.includes(tool.id)
            return (
              <button
                key={tool.id}
                type='button'
                onClick={() => handleToggle(tool.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                  isSelected
                    ? 'border-[#2f80ff] bg-[#2f80ff]/10 text-[#2f80ff]'
                    : 'border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                <span className='flex size-5 shrink-0 items-center justify-center'>{tool.icon}</span>
                <span className='truncate'>{tool.label}</span>
                {isSelected && <Check className='ml-auto size-3.5 shrink-0' />}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className='mt-5 flex items-center justify-between border-t border-white/10 pt-4'>
          <label className='flex items-center gap-2 text-xs text-white/50'>
            <input
              type='checkbox'
              checked={previewShowLabels}
              onChange={(e) => setPreviewShowLabels(e.target.checked)}
              className='size-3.5 rounded accent-[#2f80ff]'
            />
            {t('canvas.toolbarSettings.showButtonLabels')}
          </label>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={onCancel}
              className='rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 transition hover:bg-white/5'
            >
              {t('canvas.toolbarSettings.cancel')}
            </button>
            <button
              type='button'
              onClick={handleSave}
              className='rounded-xl bg-[#2f80ff] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2f80ff]/90'
            >
              {t('canvas.toolbarSettings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
