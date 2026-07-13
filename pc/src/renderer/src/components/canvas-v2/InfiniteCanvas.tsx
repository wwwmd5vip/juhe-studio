import type React from 'react'
import { useCallback, useRef } from 'react'
import { useThemeStore } from '@/stores/theme'
import { CanvasGrid } from './CanvasGrid'
import { canvasThemes } from './canvas-theme'
import { useViewport } from './hooks/useViewport'
import type { CanvasBackgroundMode, Position, ViewportTransform } from './types'

interface InfiniteCanvasProps {
  viewport: ViewportTransform
  backgroundMode?: CanvasBackgroundMode
  onViewportChange: (viewport: ViewportTransform) => void
  onCanvasMouseDown?: (event: React.PointerEvent<HTMLDivElement>) => void
  onCanvasDeselect?: () => void
  onContextMenu?: (event: React.MouseEvent) => void
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void
  children: React.ReactNode
}

export function InfiniteCanvas({
  viewport,
  backgroundMode = 'lines',
  onViewportChange,
  onCanvasMouseDown,
  onCanvasDeselect,
  onContextMenu,
  onDrop,
  children
}: InfiniteCanvasProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const containerRef = useRef<HTMLDivElement>(null)

  const { handleWheel, handlePointerDown, didPan } = useViewport({
    containerRef,
    initialViewport: viewport,
    onViewportChange
  })

  const handlePointerDownWrapper = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null
      const isBackgroundClick = !target?.closest('[data-node-id],[data-connection-id]')

      // Ctrl/Cmd + left click on background → selection box
      if (event.button === 0 && (event.ctrlKey || event.metaKey) && isBackgroundClick) {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onCanvasMouseDown?.(event)
        return
      }

      handlePointerDown(event)
    },
    [handlePointerDown, onCanvasMouseDown]
  )

  const handlePointerUpWrapper = useCallback(() => {
    if (didPan()) {
      onCanvasDeselect?.()
    }
  }, [didPan, onCanvasDeselect])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      ref={containerRef}
      className='relative h-full w-full cursor-grab select-none overflow-hidden'
      style={{ background: theme.canvas.background }}
      onPointerDown={handlePointerDownWrapper}
      onPointerUp={handlePointerUpWrapper}
      onWheel={handleWheel}
      onContextMenu={onContextMenu}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <CanvasGrid viewport={viewport} mode={backgroundMode} />
      <div
        className='absolute origin-top-left'
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** 屏幕坐标 → 世界坐标 (被外部调用) */
export function screenToWorldPosition(
  screenPos: Position,
  containerRect: DOMRect,
  viewport: ViewportTransform
): Position {
  const relX = screenPos.x - containerRect.left
  const relY = screenPos.y - containerRect.top
  return {
    x: (relX - viewport.x) / viewport.k,
    y: (relY - viewport.y) / viewport.k
  }
}

/** 世界坐标 → 屏幕坐标 */
export function worldToScreenPosition(worldPos: Position, viewport: ViewportTransform): Position {
  return {
    x: worldPos.x * viewport.k + viewport.x,
    y: worldPos.y * viewport.k + viewport.y
  }
}
