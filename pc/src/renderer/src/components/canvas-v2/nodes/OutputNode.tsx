/**
 * OutputNode - 输出展示节点
 * 图片网格展示、lightbox、拖拽追加、复制/删除
 */

import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SafeImage } from '@/components/common/SafeImage'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface OutputNodeShellProps {
  node: CanvasNode
  scale: number
  isSelected: boolean
  isRelated: boolean
  isConnectionTarget: boolean
  isConnecting: boolean
  onMouseDown: (event: React.MouseEvent, nodeId: string) => void
  onResize: (nodeId: string, width: number, height: number, position?: Position) => void
  onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void
  onDoubleClick?: (nodeId: string) => void
}

export function OutputNode(props: OutputNodeShellProps) {
  return (
    <CanvasNodeView
      data={props.node}
      scale={props.scale}
      isSelected={props.isSelected}
      isRelated={props.isRelated}
      isConnectionTarget={props.isConnectionTarget}
      isConnecting={props.isConnecting}
      onMouseDown={props.onMouseDown}
      onResize={props.onResize}
      onConnectStart={props.onConnectStart}
      onContextMenu={props.onContextMenu}
      renderContent={(node, theme) => <OutputContent node={node} theme={theme} />}
    />
  )
}

function OutputContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const images = node.metadata?.images || node.metadata?.outputs || []
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const elapsedMs = node.metadata?.elapsedMs

  if (images.length === 0) {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-2 pt-8'
        style={{ color: theme.node.placeholder }}
      >
        <div
          className='flex size-14 items-center justify-center rounded-2xl'
          style={{ background: theme.toolbar.activeBg }}
        >
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
          <svg className='size-6 opacity-30' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
            <rect x='3' y='3' width='18' height='18' rx='2' />
            <circle cx='8.5' cy='8.5' r='1.5' />
            <path d='m21 15-5-5L5 21' />
          </svg>
        </div>
        <span className='text-[10px] tracking-[0.18em] opacity-50'>{t('canvas.output.waiting')}</span>
      </div>
    )
  }

  return (
    <div className='flex h-full w-full flex-col pt-8'>
      {/* 图片网格 */}
      <div className='flex-1 overflow-hidden p-2'>
        <div className='grid h-full grid-cols-2 gap-1.5 overflow-y-auto'>
          {images.slice(0, 4).map((url, idx) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
              key={idx}
              className='relative cursor-pointer overflow-hidden rounded-lg bg-black/10'
              onClick={() => setLightboxIndex(idx)}
            >
              <SafeImage src={url} alt={`${idx + 1}`} draggable={false} className='h-full w-full object-cover' />
              {images.length > 4 && idx === 3 && (
                <div className='absolute inset-0 flex items-center justify-center bg-black/50 text-white text-lg font-bold'>
                  +{images.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 底部信息 */}
      <div className='flex items-center justify-between px-3 py-2 text-[10px]' style={{ color: theme.node.muted }}>
        <span>{images.length} 张</span>
        {elapsedMs != null && <span>{(elapsedMs / 1000).toFixed(1)}s</span>}
      </div>

      {/* Lightbox */}
      {lightboxIndex != null && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
          className='fixed inset-0 z-[200] flex items-center justify-center bg-black/90'
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type='button'
            className='absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20'
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIndex((prev) => (prev != null && prev > 0 ? prev - 1 : prev))
            }}
          >
            <ChevronLeft className='size-6' />
          </button>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          <img
            src={images[lightboxIndex]}
            alt=''
            className='max-h-[90vh] max-w-[90vw] object-contain'
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type='button'
            className='absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20'
            onClick={(e) => {
              e.stopPropagation()
              setLightboxIndex((prev) => (prev != null && prev < images.length - 1 ? prev + 1 : prev))
            }}
          >
            <ChevronRight className='size-6' />
          </button>
          <div className='absolute right-4 top-4 flex gap-2'>
            <button
              type='button'
              className='rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20'
              onClick={(e) => {
                e.stopPropagation()
                if (lightboxIndex == null) return
                const a = document.createElement('a')
                a.href = images[lightboxIndex]
                a.download = `output-${lightboxIndex + 1}.png`
                a.click()
              }}
            >
              <Download className='size-5' />
            </button>
            <button
              type='button'
              className='rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20'
              onClick={() => setLightboxIndex(null)}
            >
              <X className='size-5' />
            </button>
          </div>
          <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white'>
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  )
}
