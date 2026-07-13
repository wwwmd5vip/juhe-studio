/**
 * CanvasNodeUpscaleDialog.tsx - 图片超分/放大弹窗
 * 目标尺寸选择、算法选择、像素预览
 */

import { Sparkles, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

export interface UpscaleParams {
  targetLongEdge: number
  algorithm: 'high' | 'bilinear' | 'nearest'
}

interface Props {
  dataUrl: string
  open: boolean
  onClose: () => void
  onConfirm: (params: UpscaleParams) => void
}

const TARGETS = [
  { value: 1024, label: '1K', desc: '1024px' },
  { value: 2048, label: '2K', desc: '2048px' },
  { value: 4096, label: '4K', desc: '4096px' }
]

export function CanvasNodeUpscaleDialog({ dataUrl, open, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const algorithms = useMemo(
    () => [
      {
        value: 'high' as const,
        label: t('canvas.upscaleDialog.algorithm.high'),
        desc: t('canvas.upscaleDialog.algorithmDesc.high')
      },
      {
        value: 'bilinear' as const,
        label: t('canvas.upscaleDialog.algorithm.bilinear'),
        desc: t('canvas.upscaleDialog.algorithmDesc.bilinear')
      },
      {
        value: 'nearest' as const,
        label: t('canvas.upscaleDialog.algorithm.nearest'),
        desc: t('canvas.upscaleDialog.algorithmDesc.nearest')
      }
    ],
    [t]
  )
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [target, setTarget] = useState(2048)
  const [algorithm, setAlgorithm] = useState<'high' | 'bilinear' | 'nearest'>('high')

  useEffect(() => {
    if (!dataUrl || !open) return
    const img = new Image()
    img.onload = () => setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = dataUrl
  }, [dataUrl, open])

  if (!open) return null

  const longEdge = Math.max(imageSize.w, imageSize.h)
  const ratio = imageSize.w / imageSize.h
  const outputW = imageSize.w >= imageSize.h ? target : Math.round(target * ratio)
  const outputH = imageSize.h >= imageSize.w ? target : Math.round(target / ratio)
  const isUpscale = target > longEdge

  return (
    <div
      className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm'
      onPointerDown={onClose}
    >
      <div
        className='flex max-h-[90vh] w-[560px] max-w-[95vw] flex-col overflow-hidden rounded-2xl shadow-2xl'
        style={{ background: theme.toolbar.panel, border: `1px solid ${theme.toolbar.border}`, color: theme.node.text }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className='flex items-center gap-2 px-5 py-3'
          style={{ borderBottom: `1px solid ${theme.toolbar.border}` }}
        >
          <Sparkles className='size-4' style={{ color: '#8b5cf6' }} />
          <span className='text-sm font-semibold'>{t('canvas.upscaleDialog.title')}</span>
        </div>

        {/* Content */}
        <div className='flex flex-col gap-5 p-5'>
          {/* Source */}
          <div className='flex gap-4'>
            <img
              src={dataUrl}
              alt='Source'
              className='h-32 w-32 shrink-0 rounded-xl border object-cover'
              style={{ borderColor: theme.toolbar.border }}
              draggable={false}
            />
            <div className='flex flex-col justify-center gap-1'>
              <span className='text-[11px]' style={{ color: theme.node.muted }}>
                {t('canvas.upscaleDialog.originalSize')}
              </span>
              <span className='mono-num text-sm font-medium'>
                {imageSize.w} × {imageSize.h}
              </span>
              <span className='text-[10px]' style={{ color: theme.node.muted }}>
                {longEdge >= 2048
                  ? t('canvas.upscaleDialog.alreadyHD')
                  : `${t('canvas.upscaleDialog.longEdge')} ${longEdge}px`}
              </span>
            </div>
          </div>

          {/* Target size */}
          <div>
            <span className='text-[11px] font-medium' style={{ color: theme.node.muted }}>
              {t('canvas.upscaleDialog.targetSize')}
            </span>
            <div className='mt-2 flex gap-2'>
              {TARGETS.map((t) => (
                <button
                  key={t.value}
                  type='button'
                  className='flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors'
                  style={{
                    background: target === t.value ? '#8b5cf6' : theme.toolbar.activeBg,
                    color: target === t.value ? '#fff' : theme.toolbar.item,
                    opacity: t.value <= longEdge && !isUpscale ? 0.4 : 1
                  }}
                  onClick={() => setTarget(t.value)}
                >
                  <div>{t.label}</div>
                  <div className='text-[10px] opacity-70'>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Algorithm */}
          <div>
            <span className='text-[11px] font-medium' style={{ color: theme.node.muted }}>
              {t('canvas.upscaleDialog.upscaleAlgorithm')}
            </span>
            <div className='mt-2 flex gap-2'>
              {algorithms.map((a) => (
                <button
                  key={a.value}
                  type='button'
                  className='flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors'
                  style={{
                    background: algorithm === a.value ? theme.toolbar.activeBg : theme.node.fill,
                    color: theme.toolbar.item,
                    border: `1px solid ${algorithm === a.value ? '#8b5cf6' : theme.toolbar.border}`
                  }}
                  onClick={() => setAlgorithm(a.value)}
                >
                  <div>{a.label}</div>
                  <div className='text-[10px]' style={{ color: theme.node.muted }}>
                    {a.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Output preview */}
          <div
            className='rounded-lg border p-3'
            style={{ borderColor: theme.toolbar.border, background: theme.node.fill }}
          >
            <div className='flex items-center gap-2'>
              <Zap className='size-3.5' style={{ color: '#8b5cf6' }} />
              <span className='text-[11px]' style={{ color: theme.node.muted }}>
                {t('canvas.upscaleDialog.outputSize')}
              </span>
            </div>
            <span className='mono-num mt-1 block text-sm font-semibold'>
              {outputW} × {outputH}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className='flex items-center gap-2 px-5 py-3' style={{ borderTop: `1px solid ${theme.toolbar.border}` }}>
          <button
            type='button'
            className='rounded-lg px-4 py-2 text-xs font-medium transition hover:opacity-80'
            style={{ background: theme.toolbar.activeBg, color: theme.toolbar.item }}
            onClick={onClose}
          >
            {t('canvas.upscaleDialog.cancel')}
          </button>
          <button
            type='button'
            className='flex-1 rounded-lg px-4 py-2 text-xs font-medium text-white transition hover:opacity-90'
            style={{ background: '#8b5cf6' }}
            onClick={() => onConfirm({ targetLongEdge: target, algorithm })}
            disabled={!isUpscale && target <= longEdge}
          >
            {t('canvas.upscaleDialog.generate')}
          </button>
        </div>
      </div>
    </div>
  )
}
