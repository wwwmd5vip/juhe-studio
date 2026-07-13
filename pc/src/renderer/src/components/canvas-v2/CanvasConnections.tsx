import type { MouseEvent as ReactMouseEvent } from 'react'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasConnection, CanvasNode, ConnectionHandle, Position } from './types'

// ---- 静态连接线 ----

interface ConnectionPathProps {
  connection: CanvasConnection
  from: CanvasNode
  to: CanvasNode
  active: boolean
  onSelect: () => void
  onContextMenu?: (event: ReactMouseEvent<SVGPathElement>) => void
}

export function ConnectionPath({ connection, from, to, active, onSelect, onContextMenu }: ConnectionPathProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const startX = from.position.x + from.width
  const startY = from.position.y + from.height / 2
  const endX = to.position.x
  const endY = to.position.y + to.height / 2
  const dx = Math.abs(endX - startX)
  const curvature = Math.max(dx * 0.5, 50)
  const pathD = `M ${startX} ${startY} C ${startX + curvature} ${startY}, ${endX - curvature} ${endY}, ${endX} ${endY}`

  return (
    <g>
      {/* 宽透明路径用于点击 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      <path
        data-connection-id={connection.id}
        d={pathD}
        stroke='transparent'
        strokeWidth='16'
        fill='none'
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onContextMenu?.(event)
        }}
      />
      <path
        d={pathD}
        stroke={active ? theme.node.activeStroke : theme.node.muted}
        strokeWidth={active ? 3 : 2}
        strokeOpacity={active ? 1 : 0.82}
        fill='none'
        style={{
          filter: active ? `drop-shadow(0 0 8px ${theme.node.activeStroke}66)` : undefined,
          pointerEvents: 'none'
        }}
      />
    </g>
  )
}

// ---- 拖拽中的活动连接线 ----

interface ActiveConnectionPathProps {
  node?: CanvasNode
  handle: ConnectionHandle
  mouseWorld: Position
  target?: CanvasNode
}

export function ActiveConnectionPath({ node, handle, mouseWorld, target }: ActiveConnectionPathProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  if (!node) return null

  const startX = handle.handleType === 'source' ? node.position.x + node.width : mouseWorld.x
  const startY = handle.handleType === 'source' ? node.position.y + node.height / 2 : mouseWorld.y
  const endX = handle.handleType === 'source' ? mouseWorld.x : node.position.x
  const endY = handle.handleType === 'source' ? mouseWorld.y : node.position.y + node.height / 2

  const snappedStartX = handle.handleType === 'target' && target ? target.position.x + target.width : startX
  const snappedStartY = handle.handleType === 'target' && target ? target.position.y + target.height / 2 : startY
  const snappedEndX = handle.handleType === 'source' && target ? target.position.x : endX
  const snappedEndY = handle.handleType === 'source' && target ? target.position.y + target.height / 2 : endY

  const distance = Math.abs(snappedEndX - snappedStartX)
  const pathD = `M ${snappedStartX} ${snappedStartY} C ${snappedStartX + distance * 0.5} ${snappedStartY}, ${snappedEndX - distance * 0.5} ${snappedEndY}, ${snappedEndX} ${snappedEndY}`

  return <path d={pathD} stroke={theme.node.activeStroke} strokeWidth='2' fill='none' strokeDasharray='5,5' />
}

// ---- 连接层 (所有连接线 + 活动线) ----

interface CanvasConnectionsProps {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  selectedConnectionId?: string | null
  activeDrag?: {
    handle: ConnectionHandle
    mouseWorld: Position
    targetNode?: CanvasNode
  } | null
  onSelectConnection: (id: string) => void
  onConnectionContextMenu: (event: ReactMouseEvent<SVGPathElement>, connectionId: string) => void
}

export function CanvasConnections({
  nodes,
  connections,
  selectedConnectionId,
  activeDrag,
  onSelectConnection,
  onConnectionContextMenu
}: CanvasConnectionsProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed
<svg className='pointer-events-none absolute inset-0 overflow-visible' style={{ zIndex: 0 }}>
      <g className='pointer-events-auto'>
        {connections.map((conn) => {
          const from = nodeMap.get(conn.fromNodeId)
          const to = nodeMap.get(conn.toNodeId)
          if (!from || !to) return null
          return (
            <ConnectionPath
              key={conn.id}
              connection={conn}
              from={from}
              to={to}
              active={conn.id === selectedConnectionId}
              onSelect={() => onSelectConnection(conn.id)}
              onContextMenu={(event) => onConnectionContextMenu(event, conn.id)}
            />
          )
        })}
      </g>
      {activeDrag && (
        <ActiveConnectionPath
          node={nodeMap.get(activeDrag.handle.nodeId)}
          handle={activeDrag.handle}
          mouseWorld={activeDrag.mouseWorld}
          target={activeDrag.targetNode}
        />
      )}
    </svg>
  )
}
