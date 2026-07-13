import { useCallback, useEffect, useRef, useState } from 'react'
import type { ViewportTransform } from '../types'

interface UseViewportOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  initialViewport?: ViewportTransform
  minZoom?: number
  maxZoom?: number
  onViewportChange?: (viewport: ViewportTransform) => void
}

export function useViewport({
  containerRef,
  initialViewport = { x: 0, y: 0, k: 1 },
  minZoom = 0.05,
  maxZoom = 5,
  onViewportChange
}: UseViewportOptions) {
  const [viewport, setViewport] = useState<ViewportTransform>(initialViewport)
  const viewportRef = useRef(viewport)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panInitialRef = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  // Space key tracking for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof Element && e.target.closest('[contenteditable="true"]')) return
      setIsSpacePressed(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Prevent default scroll on the container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const preventWheelScroll = (e: WheelEvent) => e.preventDefault()
    container.addEventListener('wheel', preventWheelScroll, { passive: false })
    return () => container.removeEventListener('wheel', preventWheelScroll)
  }, [containerRef])

  const updateViewport = useCallback(
    (next: ViewportTransform) => {
      setViewport(next)
      onViewportChange?.(next)
    },
    [onViewportChange]
  )

  /** 指向滚轮缩放 */
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-canvas-no-zoom]')) return

      const delta = -event.deltaY
      const factor = 1.1 ** (delta / 100)
      const current = viewportRef.current
      const newK = Math.min(Math.max(current.k * factor, minZoom), maxZoom)

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      const worldX = (mouseX - current.x) / current.k
      const worldY = (mouseY - current.y) / current.k

      updateViewport({
        x: mouseX - worldX * newK,
        y: mouseY - worldY * newK,
        k: newK
      })
    },
    [containerRef, minZoom, maxZoom, updateViewport]
  )

  /** 指针按下：中键/空白区域拖拽平移，或 Ctrl+左键框选 */
  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const isBackgroundClick = !target?.closest('[data-node-id], [data-connection-id]')

      // Ctrl/Cmd + left click on background → selection box (handled externally)
      if (event.button === 0 && (event.ctrlKey || event.metaKey) && isBackgroundClick) {
        return
      }

      // Middle button, or left button on background (without space)
      const isPanButton = event.button === 1 || (event.button === 0 && !isSpacePressed && isBackgroundClick)
      // Space + left button anywhere on background
      const isSpacePan = event.button === 0 && isSpacePressed && isBackgroundClick

      if (isPanButton || isSpacePan) {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        isPanningRef.current = true
        panStartRef.current = { x: event.clientX, y: event.clientY }
        panInitialRef.current = { x: viewportRef.current.x, y: viewportRef.current.y }
        hasMovedRef.current = false
        document.body.style.cursor = 'grabbing'
      }
    },
    [isSpacePressed]
  )

  // Global pointer move/up for panning
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isPanningRef.current) return
      const dx = event.clientX - panStartRef.current.x
      const dy = event.clientY - panStartRef.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true
      }
      updateViewport({
        x: panInitialRef.current.x + dx,
        y: panInitialRef.current.y + dy,
        k: viewportRef.current.k
      })
    }

    const handlePointerUp = () => {
      if (!isPanningRef.current) return
      isPanningRef.current = false
      document.body.style.cursor = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [updateViewport])

  /** 判断一次指针按下是否发生了平移 */
  const didPan = useCallback(() => hasMovedRef.current, [])

  /** 重置视口 */
  const resetViewport = useCallback(() => {
    updateViewport({ x: 0, y: 0, k: 1 })
  }, [updateViewport])

  /** 设置缩放 */
  const setZoom = useCallback(
    (k: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = rect.width / 2
      const cy = rect.height / 2
      const current = viewportRef.current
      const worldX = (cx - current.x) / current.k
      const worldY = (cy - current.y) / current.k
      const clamped = Math.min(Math.max(k, minZoom), maxZoom)
      updateViewport({
        x: cx - worldX * clamped,
        y: cy - worldY * clamped,
        k: clamped
      })
    },
    [containerRef, minZoom, maxZoom, updateViewport]
  )

  /** 屏幕坐标转世界坐标 */
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const current = viewportRef.current
    return {
      x: (screenX - current.x) / current.k,
      y: (screenY - current.y) / current.k
    }
  }, [])

  /** 世界坐标转屏幕坐标 */
  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    const current = viewportRef.current
    return {
      x: worldX * current.k + current.x,
      y: worldY * current.k + current.y
    }
  }, [])

  return {
    viewport,
    isSpacePressed,
    handleWheel,
    handlePointerDown,
    didPan,
    resetViewport,
    setZoom,
    screenToWorld,
    worldToScreen
  }
}
