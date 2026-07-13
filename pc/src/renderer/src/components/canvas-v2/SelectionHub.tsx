/**
 * SelectionHub.tsx - 多选节点浮动操作栏
 * 选中 ≥2 个节点时，在选区上方显示操作按钮
 */

import { Copy, Group, Play, Trash2 } from 'lucide-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import { worldToScreenPosition } from './InfiniteCanvas'
import type { CanvasNode, Position, ViewportTransform } from './types'

interface SelectionHubProps {
  nodes: CanvasNode[]
  selection: string[]
  connections: Array<{ fromNodeId: string; toNodeId: string }>
  viewport: ViewportTransform
  containerRect: DOMRect | null
  onDelete: () => void
  onDuplicate: () => void
  onGroup: () => void
  onRunCascade: () => void
}

export const SelectionHub = memo(function SelectionHub({
  nodes,
  selection,
  viewport,
  containerRect,
  onDelete,
  onDuplicate,
  onGroup,
  onRunCascade
}: SelectionHubProps) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const selectedNodes = useMemo(() => {
    const set = new Set(selection)
    return nodes.filter((n) => set.has(n.id))
  }, [nodes, selection])

  // Only show when 2+ nodes selected
  if (selectedNodes.length < 2 || !containerRect) return null

  // Calculate bounds
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of selectedNodes) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + (n.width || 200))
    maxY = Math.max(maxY, n.position.y + (n.height || 200))
  }

  const centerWorld: Position = { x: minX + (maxX - minX) / 2, y: minY }
  const centerScreen = worldToScreenPosition(centerWorld, viewport)

  const style: React.CSSProperties = {
    position: 'absolute',
    left: centerScreen.x + containerRect.left,
    top: centerScreen.y + containerRect.top - 50,
    transform: 'translate(-50%, 0)',
    zIndex: 60,
    background: theme.toolbar.panel,
    borderColor: theme.toolbar.border,
    color: theme.toolbar.item,
    boxShadow: themeResolved === 'dark' ? '0 18px 45px rgba(0,0,0,.32)' : '0 16px 40px rgba(28,25,23,.12)',
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '4px 8px'
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div style={style} className='nodrag nopan backdrop-blur' onMouseDown={(e) => e.stopPropagation()}>
      <HubBtn icon={<Play className='w-3.5 h-3.5' />} label={t('canvas.actions.cascadeRun')} onClick={onRunCascade} />
      <HubBtn icon={<Group className='w-3.5 h-3.5' />} label={t('canvas.menu.createGroup')} onClick={onGroup} />
      <HubBtn icon={<Copy className='w-3.5 h-3.5' />} label={t('canvas.menu.duplicate')} onClick={onDuplicate} />
      <HubDivider />
      <HubBtn icon={<Trash2 className='w-3.5 h-3.5' />} label={t('canvas.menu.delete')} onClick={onDelete} danger />
    </div>
  )
})

function HubBtn({
  icon,
  label,
  onClick,
  danger
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={label}
      className='flex size-8 items-center justify-center rounded-full transition-colors hover:opacity-80'
      style={{ color: danger ? '#ef4444' : undefined }}
    >
      {icon}
    </button>
  )
}

function HubDivider() {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  return <div className='mx-0.5 h-4 w-px' style={{ background: theme.toolbar.border }} />
}
