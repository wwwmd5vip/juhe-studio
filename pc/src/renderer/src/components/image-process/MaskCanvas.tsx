import { Eraser, Paintbrush, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface MaskCanvasProps {
  sourceImage: string
  brushSize: number
  onMaskChange: (maskBase64: string) => void
}

type Tool = 'brush' | 'eraser'

export default function MaskCanvas({ sourceImage, brushSize, onMaskChange }: MaskCanvasProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Load source image onto canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas || !sourceImage) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxWidth = 512
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const width = img.naturalWidth * scale
      const height = img.naturalHeight * scale

      canvas.width = width
      canvas.height = height
      maskCanvas.width = width
      maskCanvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      // Initialize mask as transparent (black = no mask)
      maskCtx.fillStyle = 'rgba(0,0,0,0)'
      maskCtx.clearRect(0, 0, width, height)

      // Export initial empty mask
      onMaskChange(maskCanvas.toDataURL('image/png'))
    }
    img.src = sourceImage
  }, [sourceImage, onMaskChange])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height
    }
  }, [])

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const maskCanvas = maskCanvasRef.current
      if (!maskCanvas || !isDrawing) return
      const maskCtx = maskCanvas.getContext('2d')
      if (!maskCtx) return

      const pos = getPos(e)
      const prev = lastPos.current || pos

      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'
      maskCtx.lineWidth = brushSize

      if (tool === 'brush') {
        maskCtx.globalCompositeOperation = 'source-over'
        maskCtx.strokeStyle = 'rgba(255,255,255,1)'
      } else {
        maskCtx.globalCompositeOperation = 'destination-out'
        maskCtx.strokeStyle = 'rgba(0,0,0,1)'
      }

      maskCtx.beginPath()
      maskCtx.moveTo(prev.x, prev.y)
      maskCtx.lineTo(pos.x, pos.y)
      maskCtx.stroke()

      lastPos.current = pos
      onMaskChange(maskCanvas.toDataURL('image/png'))
    },
    [isDrawing, tool, brushSize, getPos, onMaskChange]
  )

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      setIsDrawing(true)
      const pos = getPos(e)
      lastPos.current = pos
    },
    [getPos]
  )

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
    lastPos.current = null
  }, [])

  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    onMaskChange(maskCanvas.toDataURL('image/png'))
  }, [onMaskChange])

  return (
    <div className='space-y-2'>
      {/* Toolbar */}
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={() => setTool('brush')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            tool === 'brush'
              ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
              : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)]'
          }`}
        >
          <Paintbrush className='w-3.5 h-3.5' />
          {t('imageProcess.brush')}
        </button>
        <button
          type='button'
          onClick={() => setTool('eraser')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            tool === 'eraser'
              ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
              : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)]'
          }`}
        >
          <Eraser className='w-3.5 h-3.5' />
          {t('imageProcess.eraser')}
        </button>
        <button
          type='button'
          onClick={clearMask}
          className='flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] transition-colors'
        >
          <Trash2 className='w-3.5 h-3.5' />
          {t('imageProcess.clearMask')}
        </button>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className='relative rounded-lg overflow-hidden border border-[var(--juhe-border)] bg-black/5 select-none'
        style={{ cursor: tool === 'brush' ? 'crosshair' : 'cell' }}
      >
        {/* Source image canvas */}
        <canvas
          ref={canvasRef}
          className='block w-full'
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {/* Mask overlay canvas */}
        <canvas
          ref={maskCanvasRef}
          className='absolute inset-0 w-full h-full pointer-events-none'
          style={{ mixBlendMode: 'normal' }}
        />
        {/* Red tint overlay to visualize mask */}
        <div
          className='absolute inset-0 pointer-events-none'
          style={{
            backgroundImage: 'repeating-conic-gradient(rgba(255,0,0,0.08) 0% 25%, transparent 0% 50%)',
            backgroundSize: '16px 16px'
          }}
        />
      </div>
    </div>
  )
}
