import { useCallback, useRef, useState } from 'react'
import { isValidConnection } from '../constants'
import type { CanvasConnection, CanvasNode, ConnectionHandle, Position } from '../types'
import { generateId } from '../utils/id'

interface UseCanvasConnectionsOptions {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  onConnectionsChange: (setter: (prev: CanvasConnection[]) => CanvasConnection[]) => void
}

export interface ConnectionCreatePending {
  handle: ConnectionHandle
  worldPos: Position
}

export function useCanvasConnections({ nodes, connections, onConnectionsChange }: UseCanvasConnectionsOptions) {
  const [activeDrag, setActiveDrag] = useState<{
    handle: ConnectionHandle
    mouseWorld: Position
    targetNode?: CanvasNode
  } | null>(null)

  const [createPending, setCreatePending] = useState<ConnectionCreatePending | null>(null)

  const dragRef = useRef<{
    handle: ConnectionHandle
  } | null>(null)

  /** 开始拖拽连接线 */
  const handleConnectStart = useCallback((event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => {
    event.stopPropagation()
    dragRef.current = { handle: { nodeId, handleType } }
    setActiveDrag({
      handle: { nodeId, handleType },
      mouseWorld: { x: 0, y: 0 }
    })
  }, [])

  /** 拖拽中更新鼠标位置并检测目标节点 */
  const handleConnectMove = useCallback(
    (worldPos: Position) => {
      if (!dragRef.current) return
      const handle = dragRef.current.handle
      const sourceNode = nodes.find((n) => n.id === handle.nodeId)
      if (!sourceNode) return

      // 检测鼠标是否在某个目标节点范围内
      let targetNode: CanvasNode | undefined
      const hitPadding = 32

      for (const node of nodes) {
        if (node.id === handle.nodeId) continue
        if (handle.handleType === 'source' && node.type === 'config') continue

        const nodeRight = node.position.x + node.width
        const nodeLeft = node.position.x
        const nodeTop = node.position.y - hitPadding
        const nodeBottom = node.position.y + node.height + hitPadding

        const isSource = handle.handleType === 'source'
        const nearX = isSource
          ? worldPos.x >= nodeLeft - hitPadding && worldPos.x <= nodeRight + hitPadding
          : worldPos.x >= nodeLeft - hitPadding && worldPos.x <= nodeLeft + hitPadding
        const nearY = worldPos.y >= nodeTop && worldPos.y <= nodeBottom

        if (nearX && nearY) {
          const connectionValid = isSource
            ? isValidConnection(sourceNode.type, node.type)
            : isValidConnection(node.type, sourceNode.type)

          if (connectionValid) {
            targetNode = node
          }
          break
        }
      }

      setActiveDrag({
        handle,
        mouseWorld: worldPos,
        targetNode
      })
    },
    [nodes]
  )

  /** 结束拖拽，创建连接 */
  const handleConnectEnd = useCallback(
    (worldPos: Position) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag) {
        setActiveDrag(null)
        return
      }

      const { handle: dropHandle } = drag
      const sourceNode = nodes.find((n) => n.id === dropHandle.nodeId)
      if (!sourceNode) {
        setActiveDrag(null)
        return
      }

      // 查找目标节点
      const hitPadding = 32
      let targetNode: CanvasNode | undefined

      for (const node of nodes) {
        if (node.id === dropHandle.nodeId) continue

        const nearX =
          dropHandle.handleType === 'source'
            ? worldPos.x >= node.position.x - hitPadding && worldPos.x <= node.position.x + node.width + hitPadding
            : worldPos.x >= node.position.x - hitPadding && worldPos.x <= node.position.x + hitPadding
        const nearY =
          worldPos.y >= node.position.y - hitPadding && worldPos.y <= node.position.y + node.height + hitPadding

        if (nearX && nearY) {
          const valid =
            dropHandle.handleType === 'source'
              ? isValidConnection(sourceNode.type, node.type)
              : isValidConnection(node.type, sourceNode.type)

          if (valid) {
            targetNode = node
          }
          break
        }
      }

      if (targetNode) {
        const fromId = dropHandle.handleType === 'source' ? dropHandle.nodeId : targetNode.id
        const toId = dropHandle.handleType === 'source' ? targetNode.id : dropHandle.nodeId

        // 检查重复
        const exists = connections.some((c) => c.fromNodeId === fromId && c.toNodeId === toId)
        if (!exists) {
          const newConnection: CanvasConnection = {
            id: `conn-${generateId()}`,
            fromNodeId: fromId,
            toNodeId: toId
          }
          onConnectionsChange((prev) => [...prev, newConnection])
        }
      } else {
        // Dropped on empty space — show create menu
        setCreatePending({ handle: dropHandle, worldPos })
      }

      setActiveDrag(null)
    },
    [nodes, connections, onConnectionsChange]
  )

  /** 删除连接 */
  const deleteConnection = useCallback(
    (connectionId: string) => {
      onConnectionsChange((prev) => prev.filter((c) => c.id !== connectionId))
    },
    [onConnectionsChange]
  )

  return {
    activeDrag,
    createPending,
    handleConnectStart,
    handleConnectMove,
    handleConnectEnd,
    deleteConnection,
    clearCreatePending: () => setCreatePending(null),
    cancelDrag: () => {
      setActiveDrag(null)
      setCreatePending(null)
    }
  }
}
