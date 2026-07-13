/**
 * CanvasNodeCropDialog.tsx - 图片裁剪弹窗
 * 可拖拽裁剪框、比例锁定、实时像素预览
 */

import { Lock, LockOpen, RotateCcw } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

export interface CropRect {
  x: number // normalized 0-1
  y: number // normalized 0-1
  width: number // normalized 0-1
  height: number // normalized 0-1
}

interface Props {
  dataUrl: string
  open: boolean
  onClose: () => void
  onConfirm: (rect: CropRect) => void
}

export function CanvasNodeCropDialog({ dataUrl, open, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
  const [dragging, setDragging] = useState<'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null)
  const [lockRatio, setLockRatio] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const startRef = useRef({ x: 0, y: 0, crop: crop })

  // Load image dimensions
  useEffect(() => {
    if (!dataUrl || !open) return
    const img = new Image()
    img.onload = () => setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = dataUrl
  }, [dataUrl, open])

  // Reset crop on open
  useEffect(() => {
    if (open) setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
  }, [open])

  const handlePointerDown = useCallback(
    (dir: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setDragging(dir)
      startRef.current = { x: e.clientX, y: e.clientY, crop: { ...crop } }
    },
    [crop]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dx = (e.clientX - startRef.current.x) / rect.width
      const dy = (e.clientY - startRef.current.y) / rect.height
      const { crop: prev } = startRef.current

      let next: CropRect
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

      if (dragging === 'move') {
        next = {
          x: clamp(prev.x + dx, 0, 1 - prev.width),
          y: clamp(prev.y + dy, 0, 1 - prev.height),
          width: prev.width,
          height: prev.height
        }
      } else {
        let { x, y, width, height } = prev
        if (dragging.includes('w')) {
          x = clamp(prev.x + dx, 0, prev.x + prev.width - 0.02)
          width = prev.x + prev.width - x
        }
        if (dragging.includes('e')) width = clamp(prev.width + dx, 0.02, 1 - prev.x)
        if (dragging.includes('n')) {
          y = clamp(prev.y + dy, 0, prev.y + prev.height - 0.02)
          height = prev.y + prev.height - y
        }
        if (dragging.includes('s')) height = clamp(prev.height + dy, 0.02, 1 - prev.y)

        if (lockRatio) {
          const ratio = prev.width / prev.height
          if (dragging.includes('e') || dragging.includes('w')) {
            height = width / ratio
            if (y + height > 1) {
              height = 1 - y
              width = height * ratio
            }
          } else {
            width = height * ratio
            if (x + width > 1) {
              width = 1 - x
              height = width / ratio
            }
          }
        }

        next = { x, y, width, height }
      }

      setCrop(next)
    },
    [dragging, lockRatio]
  )

  const handlePointerUp = useCallback(() => setDragging(null), [])

  const handleReset = useCallback(() => setCrop({ x: 0.0, y: 0.0, width: 1, height: 1 }), [])

  if (!open) return null

  const cropPx = {
    x: Math.round(crop.x * imageSize.w),
    y: Math.round(crop.y * imageSize.h),
    w: Math.round(crop.width * imageSize.w),
    h: Math.round(crop.height * imageSize.h)
  }

  return (
    <div
      className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm'
      onPointerDown={onClose}
    >
      <div
        className='flex max-h-[90vh] w-[780px] max-w-[95vw] flex-col overflow-hidden rounded-2xl shadow-2xl'
        style={{ background: theme.toolbar.panel, border: `1px solid ${theme.toolbar.border}`, color: theme.node.text }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className='flex items-center justify-between px-5 py-3'
          style={{ borderBottom: `1px solid ${theme.toolbar.border}` }}
        >
          <span className='text-sm font-semibold'>{t('canvas.cropDialog.title')}</span>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              className={`flex size-8 items-center justify-center rounded-lg transition ${lockRatio ? 'bg-[#2f80ff] text-white' : ''}`}
              style={{
                background: lockRatio ? '#2f80ff' : theme.toolbar.activeBg,
                color: lockRatio ? '#fff' : theme.toolbar.item
              }}
              onClick={() => setLockRatio(!lockRatio)}
              title={lockRatio ? t('canvas.cropDialog.ratioLocked') : t('canvas.cropDialog.freeCrop')}
            >
              {lockRatio ? <Lock className='size-3.5' /> : <LockOpen className='size-3.5' />}
            </button>
            <button
              type='button'
              className='flex size-8 items-center justify-center rounded-lg transition'
              style={{ background: theme.toolbar.activeBg, color: theme.toolbar.item }}
              onClick={handleReset}
              title={t('canvas.cropDialog.reset')}
            >
              <RotateCcw className='size-3.5' />
            </button>
          </div>
        </div>

        {/* Crop area */}
        <div
          ref={containerRef}
          className='relative flex-1 overflow-hidden'
          style={{ touchAction: 'none' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img
            src={dataUrl}
            alt='Crop preview'
            className='pointer-events-none block max-h-[55vh] w-full select-none object-contain'
            draggable={false}
          />

          {/* Dark overlay outside crop */}
          <div className='pointer-events-none absolute inset-0'>
            {/* Top */}
            <div className='absolute bg-black/50' style={{ top: 0, left: 0, right: 0, height: `${crop.y * 100}%` }} />
            {/* Bottom */}
            <div
              className='absolute bg-black/50'
              style={{ bottom: 0, left: 0, right: 0, height: `${(1 - crop.y - crop.height) * 100}%` }}
            />
            {/* Left */}
            <div
              className='absolute bg-black/50'
              style={{ top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.height * 100}%` }}
            />
            {/* Right */}
            <div
              className='absolute bg-black/50'
              style={{
                top: `${crop.y * 100}%`,
                right: 0,
                width: `${(1 - crop.x - crop.width) * 100}%`,
                height: `${crop.height * 100}%`
              }}
            />
          </div>

          {/* Crop box outline */}
          <div
            className='pointer-events-none absolute border-2'
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
              borderColor: '#2f80ff'
            }}
          >
            {/* Grid lines */}
            <div className='absolute inset-0 grid grid-cols-3 grid-rows-3'>
              {Array.from({ length: 9 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={i} className='border border-[#2f80ff]/30' />
              ))}
            </div>
          </div>

          {/* Drag handles */}
          <div className='pointer-events-none absolute inset-0'>
            <DraggableArea crop={crop} onDrag={(dir) => handlePointerDown(dir)} />
          </div>
        </div>

        {/* Footer */}
        <div
          className='flex items-center justify-between px-5 py-3'
          style={{ borderTop: `1px solid ${theme.toolbar.border}` }}
        >
          <span className='mono-num text-[11px]' style={{ color: theme.node.muted }}>
            {cropPx.w} × {cropPx.h} px
          </span>
          <div className='flex gap-2'>
            <button
              type='button'
              className='rounded-lg px-4 py-2 text-xs font-medium transition hover:opacity-80'
              style={{ background: theme.toolbar.activeBg, color: theme.toolbar.item }}
              onClick={onClose}
            >
              {t('canvas.cropDialog.cancel')}
            </button>
            <button
              type='button'
              className='rounded-lg px-4 py-2 text-xs font-medium text-white transition hover:opacity-90'
              style={{ background: '#2f80ff' }}
              onClick={() => onConfirm(crop)}
            >
              {t('canvas.cropDialog.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Draggable crop area ----

function DraggableArea({
  crop,
  onDrag
}: {
  crop: CropRect
  onDrag: (dir: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => (e: React.PointerEvent) => void
}) {
  const handleSize = 14
  const s = `${handleSize}px`
  const halfS = `${handleSize / 2}px`
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
    height: `${crop.height * 100}%`,
    cursor: 'move'
  }

  return (
    <>
      {/* Move area */}
      <div style={style} onPointerDown={onDrag('move')} />

      {/* Corner handles */}
      <CornerHandle
        style={{
          left: `calc(${crop.x * 100}% - ${halfS})`,
          top: `calc(${crop.y * 100}% - ${halfS})`,
          cursor: 'nwse-resize'
        }}
        onPointerDown={onDrag('nw')}
      />
      <CornerHandle
        style={{
          left: `calc(${(crop.x + crop.width) * 100}% - ${halfS})`,
          top: `calc(${crop.y * 100}% - ${halfS})`,
          cursor: 'nesw-resize'
        }}
        onPointerDown={onDrag('ne')}
      />
      <CornerHandle
        style={{
          left: `calc(${crop.x * 100}% - ${halfS})`,
          top: `calc(${(crop.y + crop.height) * 100}% - ${halfS})`,
          cursor: 'nesw-resize'
        }}
        onPointerDown={onDrag('sw')}
      />
      <CornerHandle
        style={{
          left: `calc(${(crop.x + crop.width) * 100}% - ${halfS})`,
          top: `calc(${(crop.y + crop.height) * 100}% - ${halfS})`,
          cursor: 'nwse-resize'
        }}
        onPointerDown={onDrag('se')}
      />

      {/* Edge handles */}
      <EdgeHandle
        style={{
          left: `calc(${(crop.x + crop.width / 2) * 100}% - ${halfS})`,
          top: `calc(${crop.y * 100}% - ${halfS})`,
          width: s,
          height: s,
          cursor: 'ns-resize'
        }}
        onPointerDown={onDrag('n')}
      />
      <EdgeHandle
        style={{
          left: `calc(${(crop.x + crop.width / 2) * 100}% - ${halfS})`,
          top: `calc(${(crop.y + crop.height) * 100}% - ${halfS})`,
          width: s,
          height: s,
          cursor: 'ns-resize'
        }}
        onPointerDown={onDrag('s')}
      />
      <EdgeHandle
        style={{
          left: `calc(${crop.x * 100}% - ${halfS})`,
          top: `calc(${(crop.y + crop.height / 2) * 100}% - ${halfS})`,
          width: s,
          height: s,
          cursor: 'ew-resize'
        }}
        onPointerDown={onDrag('w')}
      />
      <EdgeHandle
        style={{
          left: `calc(${(crop.x + crop.width) * 100}% - ${halfS})`,
          top: `calc(${(crop.y + crop.height / 2) * 100}% - ${halfS})`,
          width: s,
          height: s,
          cursor: 'ew-resize'
        }}
        onPointerDown={onDrag('e')}
      />
    </>
  )
}

function CornerHandle({
  style,
  onPointerDown
}: {
  style: React.CSSProperties
  onPointerDown: (e: React.PointerEvent) => void
}) {
  return (
    <div
      className='pointer-events-auto absolute rounded-full border-2 bg-white'
      style={{ width: 14, height: 14, borderColor: '#2f80ff', zIndex: 10, ...style }}
      onPointerDown={onPointerDown}
    />
  )
}

function EdgeHandle({
  style,
  onPointerDown
}: {
  style: React.CSSProperties
  onPointerDown: (e: React.PointerEvent) => void
}) {
  return (
    <div
      className='pointer-events-auto absolute rounded-full border-2 bg-white'
      style={{ borderColor: '#2f80ff', zIndex: 10, ...style }}
      onPointerDown={onPointerDown}
    />
  )
}
