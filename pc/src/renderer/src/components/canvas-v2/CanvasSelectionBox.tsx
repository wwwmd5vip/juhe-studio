import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { SelectionBox } from './types'

interface CanvasSelectionBoxProps {
  selectionBox: SelectionBox
}

export function CanvasSelectionBox({ selectionBox }: CanvasSelectionBoxProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const x = Math.min(selectionBox.startWorldX, selectionBox.currentWorldX)
  const y = Math.min(selectionBox.startWorldY, selectionBox.currentWorldY)
  const w = Math.abs(selectionBox.currentWorldX - selectionBox.startWorldX)
  const h = Math.abs(selectionBox.currentWorldY - selectionBox.startWorldY)

  if (w < 4 && h < 4) return null

  return (
    <div
      className='pointer-events-none absolute z-40 rounded-sm border'
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        borderColor: theme.canvas.selectionStroke,
        background: theme.canvas.selectionFill
      }}
    />
  )
}
