import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react'

interface LightboxProps {
  images: Array<{ src: string; alt?: string; caption?: string }>
  initialIndex?: number
  open: boolean
  onClose: () => void
}

export function Lightbox({ images, initialIndex = 0, open, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    setIndex(initialIndex)
    setScale(1)
  }, [initialIndex, open])

  const navigate = useCallback(
    (dir: number) => {
      setScale(1)
      setIndex((prev) => {
        const next = prev + dir
        if (next < 0) return images.length - 1
        if (next >= images.length) return 0
        return next
      })
    },
    [images.length]
  )

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale((prev) => Math.max(0.5, Math.min(5, prev + (e.deltaY > 0 ? -0.25 : 0.25))))
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          navigate(-1)
          break
        case 'ArrowRight':
          navigate(1)
          break
        case 'f':
          setIsFullscreen((f) => !f)
          break
        case '0':
          setScale(1)
          break
      }
    },
    [onClose, navigate]
  )

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open || images.length === 0) return null

  const current = images[index]

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black/95 flex items-center justify-center
                  ${isFullscreen ? '' : ''}`}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white z-10"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3
                      bg-white/10 backdrop-blur rounded-full px-4 py-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(0.5, s - 0.5)) }}
          className="text-white/70 hover:text-white"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-white/70 text-xs min-w-[48px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(5, s + 0.5)) }}
          className="text-white/70 hover:text-white"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/20" />
        <button
          onClick={(e) => { e.stopPropagation(); setIsFullscreen((f) => !f) }}
          className="text-white/70 hover:text-white"
        >
          <Maximize className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            const a = document.createElement('a')
            a.href = current.src
            a.download = current.alt || 'image'
            a.click()
          }}
          className="text-white/70 hover:text-white"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(-1) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60
                       hover:text-white z-10 p-2"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(1) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60
                       hover:text-white z-10 p-2"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/60 text-sm z-10">
        {index + 1} / {images.length}
      </div>

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.src}
          alt={current.alt || ''}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
          className="max-w-full max-h-full object-contain cursor-grab select-none"
          draggable={false}
        />
      </div>

      {/* Caption */}
      {current.caption && (
        <div className="absolute bottom-20 left-0 right-0 text-center text-white/70 text-sm z-10">
          {current.caption}
        </div>
      )}
    </div>
  )
}
