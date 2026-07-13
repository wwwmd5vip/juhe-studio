/**
 * GroupNode - 分组节点
 * 折叠/展开、批量运行
 */

import { ChevronDown, ChevronRight, Zap } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface GroupNodeProps {
  node: CanvasNode
  scale: number
  isSelected: boolean
  isRelated: boolean
  isConnectionTarget: boolean
  isConnecting: boolean
  onMouseDown: (event: React.MouseEvent, nodeId: string) => void
  onResize: (nodeId: string, width: number, height: number, position?: Position) => void
  onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void
  onToggleCollapse?: (nodeId: string) => void
  onRunGroup?: (nodeId: string) => void
}

export function GroupNode(props: GroupNodeProps) {
  return (
    <CanvasNodeView
      data={props.node}
      scale={props.scale}
      isSelected={props.isSelected}
      isRelated={props.isRelated}
      isConnectionTarget={props.isConnectionTarget}
      isConnecting={props.isConnecting}
      onMouseDown={props.onMouseDown}
      onResize={props.onResize}
      onConnectStart={props.onConnectStart}
      onContextMenu={props.onContextMenu}
      renderContent={(node, theme) => (
        <GroupContent
          node={node}
          theme={theme}
          onToggleCollapse={props.onToggleCollapse}
          onRunGroup={props.onRunGroup}
        />
      )}
    />
  )
}

function GroupContent({
  node,
  theme,
  onToggleCollapse,
  onRunGroup
}: {
  node: CanvasNode
  theme: CanvasTheme
  onToggleCollapse?: (nodeId: string) => void
  onRunGroup?: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const collapsed = node.metadata?.collapsed
  const childIds = node.metadata?.nodeIds || []
  const label = node.metadata?.label || node.title

  return (
    <div className='flex h-full w-full flex-col pt-8'>
      {/* 折叠/展开按钮 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div
        className='absolute left-3 top-2 z-20 flex cursor-pointer items-center gap-1 text-xs'
        style={{ color: theme.node.muted }}
        onClick={() => onToggleCollapse?.(node.id)}
      >
        {collapsed ? <ChevronRight className='size-3.5' /> : <ChevronDown className='size-3.5' />}
        <span>{label}</span>
      </div>

      {/* 运行按钮 */}
      {onRunGroup && childIds.length > 0 && (
        <button
          type='button'
          className='absolute right-3 top-2 z-20 flex size-7 items-center justify-center rounded-lg transition-colors'
          style={{ color: theme.node.activeStroke, background: theme.toolbar.activeBg }}
          onClick={(e) => {
            e.stopPropagation()
            onRunGroup(node.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title={t('canvas.actions.cascadeRun')}
        >
          <Zap className='size-3.5' />
        </button>
      )}

      {/* 内容区域 */}
      <div className='flex flex-1 items-center justify-center' style={{ color: theme.node.muted }}>
        <div className='text-xs'>
          {collapsed ? `${childIds.length} 个子节点 (已折叠)` : `${childIds.length} 个子节点`}
        </div>
      </div>
    </div>
  )
}
