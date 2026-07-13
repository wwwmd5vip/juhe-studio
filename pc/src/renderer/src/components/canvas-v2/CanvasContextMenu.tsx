import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasNodeType, ContextMenuState, Position } from './types'

interface CanvasContextMenuProps {
  state: ContextMenuState
  selection: string[]
  onClose: () => void
  onAddNode: (type: CanvasNodeType, pos: Position) => void
  onDelete: () => void
  onDuplicate: () => void
  onGroup: () => void
  onRunNode?: (id: string) => void
  onDeleteEdge?: (connectionId: string) => void
}

export function CanvasContextMenu({
  state,
  selection,
  onClose,
  onAddNode,
  onDelete,
  onDuplicate,
  onGroup,
  onRunNode,
  onDeleteEdge
}: CanvasContextMenuProps) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: state.x,
    top: state.y,
    zIndex: 100,
    background: theme.toolbar.panel,
    borderColor: theme.toolbar.border,
    color: theme.node.text
  }

  const itemStyle: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'background 0.15s'
  }

  const handleBackdrop = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      onClose()
    },
    [onClose]
  )

  const handleItemClick = useCallback(
    (fn: () => void) => {
      fn()
      onClose()
    },
    [onClose]
  )

  if (state.type === 'pane') {
    return (
      <>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
        <div className='fixed inset-0 z-[99]' onClick={handleBackdrop} onContextMenu={(e) => e.preventDefault()} />
        <div className='fixed z-[100] min-w-[160px] rounded-2xl border py-1 shadow-2xl backdrop-blur' style={menuStyle}>
          {(['image', 'text', 'config', 'video', 'audio'] as CanvasNodeType[]).map((type) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
              key={type}
              className='px-4 py-2 text-xs transition-colors hover:opacity-80'
              style={itemStyle}
              onClick={() =>
                handleItemClick(() => {
                  if (state.flowPos) onAddNode(type, state.flowPos)
                })
              }
            >
              {t(`canvas.nodeTypes.${type}`)}
            </div>
          ))}
        </div>
      </>
    )
  }

  if (state.type === 'node') {
    const isSingle = selection.length <= 1
    return (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
        <div className='fixed inset-0 z-[99]' onClick={handleBackdrop} onContextMenu={(e) => e.preventDefault()} />
        <div className='fixed z-[100] min-w-[160px] rounded-2xl border py-1 shadow-2xl backdrop-blur' style={menuStyle}>
          {isSingle && onRunNode && state.nodeId && (
            // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
              className='px-4 py-2 text-xs transition-colors hover:opacity-80'
              style={itemStyle}
              onClick={() => handleItemClick(() => state.nodeId ? onRunNode(state.nodeId) : undefined)}
            >
              {t('canvas.menu.runNode')}
            </div>
          )}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          <div
            className='px-4 py-2 text-xs transition-colors hover:opacity-80'
            style={itemStyle}
            onClick={() => handleItemClick(onDuplicate)}
          >
            {t('canvas.menu.duplicate')}
          </div>
          {selection.length >= 2 && (
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
              className='px-4 py-2 text-xs transition-colors hover:opacity-80'
              style={itemStyle}
              onClick={() => handleItemClick(onGroup)}
            >
              {t('canvas.menu.createGroup')}
            </div>
          )}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          <div
            className='px-4 py-2 text-xs transition-colors hover:opacity-80'
            style={{ ...itemStyle, color: '#ef4444' }}
            onClick={() => handleItemClick(onDelete)}
          >
            {t('canvas.menu.delete')}
          </div>
        </div>
      </>
    )
  }

  if (state.type === 'connection') {
    return (
      <>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
        <div className='fixed inset-0 z-[99]' onClick={handleBackdrop} onContextMenu={(e) => e.preventDefault()} />
        <div className='fixed z-[100] min-w-[160px] rounded-2xl border py-1 shadow-2xl backdrop-blur' style={menuStyle}>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          <div
            className='px-4 py-2 text-xs transition-colors hover:opacity-80'
            style={{ ...itemStyle, color: '#ef4444' }}
            onClick={() =>
              handleItemClick(() => {
                if (state.connectionId) onDeleteEdge?.(state.connectionId)
              })
            }
          >
            {t('canvas.menu.deleteEdge')}
          </div>
        </div>
      </>
    )
  }

  return null
}
