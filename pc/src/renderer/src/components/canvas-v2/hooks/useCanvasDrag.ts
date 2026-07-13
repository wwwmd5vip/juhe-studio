import { useCallback, useRef } from 'react'
import type { CanvasNode, Position } from '../types'

interface UseCanvasDragOptions {
  nodes: CanvasNode[]
  onNodesChange: (setter: (prev: CanvasNode[]) => CanvasNode[]) => void
}

export function useCanvasDrag({ nodes, onNodesChange }: UseCanvasDragOptions) {
  const dragRef = useRef<{
    isDragging: boolean
    nodeId: string
    startMouseX: number
    startMouseY: number
    startPositions: Map<string, Position>
  }>({
    isDragging: false,
    nodeId: '',
    startMouseX: 0,
    startMouseY: 0,
    startPositions: new Map()
  })

  /** 开始拖拽节点 */
  const handleNodeMouseDown = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      // 忽略 resize 手柄的点击
      if ((event.target as HTMLElement).closest('[data-resize-handle]')) return
      event.stopPropagation()
      event.preventDefault()

      const selectedIds = getSelectedIds(nodes)
      const targetIds = selectedIds.includes(nodeId) ? selectedIds : [nodeId]

      dragRef.current = {
        isDragging: true,
        nodeId,
        startMouseX: event.clientX,
        startMouseY: event.clientY,
        startPositions: new Map(
          targetIds
            .map((id) => nodes.find((n) => n.id === id))
            .filter((n): n is CanvasNode => n != null)
            .map((n) => [n.id, { ...n.position }])
        )
      }
    },
    [nodes]
  )

  /** 拖拽移动 */
  const handleDragMove = useCallback(
    (event: MouseEvent, scale: number) => {
      if (!dragRef.current.isDragging) return
      const dx = (event.clientX - dragRef.current.startMouseX) / scale
      const dy = (event.clientY - dragRef.current.startMouseY) / scale
      const startPositions = dragRef.current.startPositions

      onNodesChange((prev) =>
        prev.map((n) => {
          const startPos = startPositions.get(n.id)
          if (!startPos) return n
          return {
            ...n,
            position: { x: startPos.x + dx, y: startPos.y + dy }
          }
        })
      )
    },
    [onNodesChange]
  )

  /** 结束拖拽 */
  const handleDragEnd = useCallback(() => {
    dragRef.current.isDragging = false
  }, [])

  const isDragging = useCallback(() => dragRef.current.isDragging, [])

  return {
    handleNodeMouseDown,
    handleDragMove,
    handleDragEnd,
    isDragging
  }
}

function getSelectedIds(nodes: CanvasNode[]): string[] {
  // 节点本身不存储 selected 状态，由外部 selection store 管理
  // 这个 hook 只需要知道：如果该节点有 selected 标记，就批量拖拽
  // 实际 selected 状态由 canvas-store 管理
  return nodes.filter((n) => (n as unknown as { selected?: boolean }).selected).map((n) => n.id)
}
