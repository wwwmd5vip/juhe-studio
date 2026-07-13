/**
 * CanvasNodeMaskEditDialog.tsx — 局部遮罩编辑弹窗
 * 画笔/擦除双模式，蓝色半透明遮罩预览 + AI 修改要求输入
 */

import { Brush, Eraser, RotateCcw, WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  dataUrl: string
  open: boolean
  onClose: () => void
  onConfirm: (payload: { prompt: string; maskDataUrl: string }) => void
}

const BRUSH_MIN = 8
const BRUSH_MAX = 160
const BRUSH_DEFAULT = 100
const MASK_FILL_COLOR = 'rgba(37,99,235,.38)' // blue semitransparent

export function CanvasNodeMaskEditDialog({ dataUrl, open, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [brushSize, setBrushSize] = useState(BRUSH_DEFAULT)
  const [mode, setMode] = useState<'brush' | 'erase'>('brush')
  const [error, setError] = useState('')
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })

  const imageRef = useRef<HTMLImageElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef({ active: false, lastX: 0, lastY: 0 })
  const hasDrawnRef = useRef(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setPrompt('')
      setBrushSize(BRUSH_DEFAULT)
      setMode('brush')
      setError('')
      hasDrawnRef.current = false
    }
  }, [open])

  // Init canvases after image loads
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current
    if (!img) return
    const w = img.naturalWidth
    const h = img.naturalHeight
    setImageSize({ w, h })

    const mask = maskCanvasRef.current
    const preview = previewCanvasRef.current
    if (!mask || !preview) return

    mask.width = w
    mask.height = h
    preview.width = w
    preview.height = h

    const mctx = mask.getContext('2d')
    if (mctx) mctx.clearRect(0, 0, w, h)
  }, [])

  // Convert client coords to canvas pixel coords
  const readCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    }
  }, [])

  // Draw a stroke on the mask canvas
  const drawMaskStroke = useCallback(
    (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = brushSize
      if (mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.stroke()
    },
    [brushSize, mode]
  )

  // Render mask overlay preview
  const renderMaskPreview = useCallback(() => {
    const mask = maskCanvasRef.current
    const preview = previewCanvasRef.current
    if (!mask || !preview) return
    const pctx = preview.getContext('2d')
    if (!pctx) return

    const w = preview.width
    const h = preview.height
    pctx.clearRect(0, 0, w, h)

    // Draw blue overlay where mask has content
    pctx.globalCompositeOperation = 'source-over'
    pctx.fillStyle = MASK_FILL_COLOR
    pctx.fillRect(0, 0, w, h)

    pctx.globalCompositeOperation = 'destination-in'
    pctx.drawImage(mask, 0, 0)
  }, [])

  const draw = useCallback(
    (clientX: number, clientY: number) => {
      const mask = maskCanvasRef.current
      if (!mask) return
      const mctx = mask.getContext('2d')
      if (!mctx) return

      const pt = readCanvasPoint(clientX, clientY)
      const { lastX, lastY } = drawingRef.current

      drawMaskStroke(mctx, lastX, lastY, pt.x, pt.y)
      renderMaskPreview()
      hasDrawnRef.current = true

      drawingRef.current.lastX = pt.x
      drawingRef.current.lastY = pt.y
    },
    [readCanvasPoint, drawMaskStroke, renderMaskPreview]
  )

  const startDraw = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      const pt = readCanvasPoint(e.clientX, e.clientY)
      drawingRef.current = { active: true, lastX: pt.x, lastY: pt.y }
      draw(e.clientX, e.clientY)
    },
    [readCanvasPoint, draw]
  )

  const moveDraw = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current.active) return
      draw(e.clientX, e.clientY)
    },
    [draw]
  )

  const stopDraw = useCallback(() => {
    drawingRef.current.active = false
  }, [])

  const handleReset = useCallback(() => {
    const mask = maskCanvasRef.current
    const preview = previewCanvasRef.current
    if (!mask || !preview) return
    const mctx = mask.getContext('2d')
    const pctx = preview.getContext('2d')
    if (mctx) mctx.clearRect(0, 0, mask.width, mask.height)
    if (pctx) pctx.clearRect(0, 0, preview.width, preview.height)
    hasDrawnRef.current = false
  }, [])

  const handleSubmit = useCallback(() => {
    if (!prompt.trim()) {
      setError(t('canvas.maskEdit.errorEmptyPrompt'))
      return
    }
    if (!hasDrawnRef.current) {
      setError(t('canvas.maskEdit.errorNoMask'))
      return
    }
    const mask = maskCanvasRef.current
    if (!mask) return

    // Build mask: white = keep, black = edit
    const outCanvas = document.createElement('canvas')
    outCanvas.width = mask.width
    outCanvas.height = mask.height
    const octx = outCanvas.getContext('2d')
    if (!octx) return

    octx.fillStyle = '#fff'
    octx.fillRect(0, 0, outCanvas.width, outCanvas.height)

    // Pixels where mask has alpha > 0 become black
    const mctx = mask.getContext('2d')
    if (!mctx) return
    const imageData = mctx.getImageData(0, 0, mask.width, mask.height)
    const outData = octx.getImageData(0, 0, outCanvas.width, outCanvas.height)
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) {
        outData.data[i - 3] = 0
        outData.data[i - 2] = 0
        outData.data[i - 1] = 0
        outData.data[i] = 255
      }
    }
    octx.putImageData(outData, 0, 0)

    const maskDataUrl = outCanvas.toDataURL('image/png')
    onConfirm({ prompt: prompt.trim(), maskDataUrl })
    setError('')
  }, [prompt, onConfirm, t])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[95] flex items-center justify-center'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div className='relative flex w-[980px] gap-5 rounded-2xl bg-[#1c1c1e] p-6 shadow-2xl'>
        {/* Left: preview */}
        <div className='flex min-h-[360px] flex-1 items-center justify-center rounded-xl border border-white/10 bg-transparent'>
          <div className='relative inline-block max-w-full overflow-hidden rounded-lg select-none'>
            <img
              ref={imageRef}
              src={dataUrl}
              alt={t('canvas.maskEdit.preview')}
              className='block max-h-[68vh] max-w-full bg-transparent'
              onLoad={handleImageLoad}
            />
            <canvas
              ref={previewCanvasRef}
              className='absolute inset-0 h-full w-full cursor-crosshair touch-none'
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={stopDraw}
              onPointerCancel={stopDraw}
            />
          </div>
          <canvas ref={maskCanvasRef} className='hidden' />
        </div>

        {/* Right: controls */}
        <div className='flex w-[320px] shrink-0 flex-col gap-4'>
          <h3 className='text-xl font-semibold text-white'>{t('canvas.maskEdit.title')}</h3>
          {imageSize.w > 0 && (
            <p className='text-sm text-white/40'>
              {imageSize.w} × {imageSize.h} px
            </p>
          )}

          {/* Brush/Erase toggle */}
          <div className='grid grid-cols-2 gap-2'>
            <button
              type='button'
              onClick={() => setMode('brush')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                mode === 'brush'
                  ? 'border-[#2f80ff] bg-[#2f80ff]/10 text-[#2f80ff]'
                  : 'border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              <Brush className='size-3.5' />
              {t('canvas.maskEdit.brush')}
            </button>
            <button
              type='button'
              onClick={() => setMode('erase')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                mode === 'erase'
                  ? 'border-[#2f80ff] bg-[#2f80ff]/10 text-[#2f80ff]'
                  : 'border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              <Eraser className='size-3.5' />
              {t('canvas.maskEdit.eraser')}
            </button>
          </div>

          {/* Brush size */}
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <span className='text-xs text-white/50'>{t('canvas.maskEdit.brushSize')}</span>
              <span className='text-xs tabular-nums text-white/60'>{brushSize}px</span>
            </div>
            <input
              type='range'
              min={BRUSH_MIN}
              max={BRUSH_MAX}
              step={2}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#2f80ff]'
            />
          </div>

          {/* Prompt */}
          <label className='flex flex-col gap-1.5'>
            <span className='text-xs text-white/50'>{t('canvas.maskEdit.editRequirement')}</span>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('canvas.maskEdit.editPlaceholder')}
              className='w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none transition placeholder:text-white/20 focus:border-[#2f80ff]'
            />
          </label>

          {/* Error */}
          {error && <p className='text-xs font-medium text-red-400'>{error}</p>}

          {/* Actions */}
          <div className='mt-auto flex items-center justify-between gap-2'>
            <button
              type='button'
              onClick={handleReset}
              className='flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:text-white/80'
            >
              <RotateCcw className='size-3.5' />
              {t('canvas.maskEdit.reset')}
            </button>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='rounded-xl border border-white/10 px-4 py-2 text-xs text-white/50 transition hover:bg-white/5'
              >
                {t('canvas.maskEdit.cancel')}
              </button>
              <button
                type='button'
                onClick={handleSubmit}
                className='flex items-center gap-2 rounded-xl bg-[#2f80ff] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#2f80ff]/90'
              >
                <WandSparkles className='size-3.5' />
                {t('canvas.maskEdit.aiEdit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
