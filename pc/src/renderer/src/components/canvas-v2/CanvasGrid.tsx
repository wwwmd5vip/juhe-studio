import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasBackgroundMode, ViewportTransform } from './types'

interface CanvasGridProps {
  viewport: ViewportTransform
  mode: CanvasBackgroundMode
}

export function CanvasGrid({ viewport, mode }: CanvasGridProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  if (mode === 'blank') return null

  const gridSize = 48 * viewport.k
  const x = viewport.x % gridSize
  const y = viewport.y % gridSize
  const dotSize = viewport.k < 0.12 ? 0.8 : 1.15
  const backgroundImage =
    mode === 'dots'
      ? `radial-gradient(circle, ${theme.canvas.dot} ${dotSize}px, transparent ${dotSize + 0.2}px)`
      : `linear-gradient(${theme.canvas.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.canvas.line} 1px, transparent 1px)`

  return (
    <div
      className='pointer-events-none absolute inset-0 opacity-40'
      style={{
        backgroundImage,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${x}px ${y}px`
      }}
    />
  )
}
