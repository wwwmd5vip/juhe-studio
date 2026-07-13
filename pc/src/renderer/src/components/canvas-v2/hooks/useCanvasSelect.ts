import { useCallback, useRef, useState } from 'react'
import type { CanvasNode, Position, SelectionBox } from '../types'

interface UseCanvasSelectOptions {
  nodes: CanvasNode[]
  onSelectionChange: (ids: string[]) => void
}

export function useCanvasSelect({ nodes, onSelectionChange }: UseCanvasSelectOptions) {
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)

  const selectionRef = useRef<{
    isSelecting: boolean
    startScreenX: number
    startScreenY: number
    additive: boolean
    initialSelected: string[]
  }>({
    isSelecting: false,
    startScreenX: 0,
    startScreenY: 0,
    additive: false,
    initialSelected: []
  })

  /** 开始框选 */
  const startSelection = useCallback(
    (_event: React.PointerEvent, worldPos: Position, additive: boolean, currentSelection: string[] = []) => {
      selectionRef.current = {
        isSelecting: true,
        startScreenX: worldPos.x,
        startScreenY: worldPos.y,
        additive,
        initialSelected: currentSelection
      }
      setSelectionBox({
        startWorldX: worldPos.x,
        startWorldY: worldPos.y,
        currentWorldX: worldPos.x,
        currentWorldY: worldPos.y,
        additive,
        initialSelectedNodeIds: additive ? currentSelection : []
      })
    },
    []
  )

  /** 更新框选 */
  const updateSelection = useCallback((worldPos: Position) => {
    if (!selectionRef.current.isSelecting) return
    setSelectionBox((prev) => (prev ? { ...prev, currentWorldX: worldPos.x, currentWorldY: worldPos.y } : null))
  }, [])

  /** 结束框选，计算选中节点 */
  const endSelection = useCallback(() => {
    if (!selectionRef.current.isSelecting) return
    selectionRef.current.isSelecting = false

    setSelectionBox((prev) => {
      if (!prev) return null
      const minX = Math.min(prev.startWorldX, prev.currentWorldX)
      const maxX = Math.max(prev.startWorldX, prev.currentWorldX)
      const minY = Math.min(prev.startWorldY, prev.currentWorldY)
      const maxY = Math.max(prev.startWorldY, prev.currentWorldY)

      const intersectedIds = nodes
        .filter((n) => {
          return (
            n.position.x < maxX &&
            n.position.x + n.width > minX &&
            n.position.y < maxY &&
            n.position.y + n.height > minY
          )
        })
        .map((n) => n.id)

      const finalSelection =
        selectionRef.current.additive && selectionRef.current.initialSelected.length > 0
          ? Array.from(new Set([...selectionRef.current.initialSelected, ...intersectedIds]))
          : intersectedIds
      onSelectionChange(finalSelection)
      return null
    })
  }, [nodes, onSelectionChange])

  /** 点击单个节点 */
  const clickNode = useCallback(
    (nodeId: string, additive: boolean, currentSelection: string[] = []) => {
      if (additive) {
        // Toggle: remove if already selected, add if not
        if (currentSelection.includes(nodeId)) {
          onSelectionChange(currentSelection.filter((id) => id !== nodeId))
        } else {
          onSelectionChange([...currentSelection, nodeId])
        }
      } else {
        onSelectionChange([nodeId])
      }
    },
    [onSelectionChange]
  )

  /** 点击空白区域取消选择 */
  const deselectAll = useCallback(() => {
    onSelectionChange([])
  }, [onSelectionChange])

  return {
    selectionBox,
    startSelection,
    updateSelection,
    endSelection,
    clickNode,
    deselectAll
  }
}
