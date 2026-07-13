import { useCallback, useRef } from 'react'
import type { CanvasConnection, CanvasNode, Position } from '../types'
import { generateId } from '../utils/id'

interface ClipboardSet {
  nodes: CanvasNode[]
  connections: { fromNodeId: string; toNodeId: string }[]
}

interface UseCanvasClipboardOptions {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  selection: string[]
  onNodesChange: (setter: (prev: CanvasNode[]) => CanvasNode[]) => void
  onConnectionsChange: (setter: (prev: CanvasConnection[]) => CanvasConnection[]) => void
  onSelectionChange: (ids: string[]) => void
}

export function useCanvasClipboard({
  nodes,
  connections,
  selection,
  onNodesChange,
  onConnectionsChange,
  onSelectionChange
}: UseCanvasClipboardOptions) {
  const clipboardRef = useRef<ClipboardSet>({ nodes: [], connections: [] })

  /** 复制 */
  const copySelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => selection.includes(n.id))
    if (selectedNodes.length === 0) return
    const selectedConns = connections.filter((c) => selection.includes(c.fromNodeId) && selection.includes(c.toNodeId))
    clipboardRef.current = {
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      connections: selectedConns.map((c) => ({
        fromNodeId: c.fromNodeId,
        toNodeId: c.toNodeId
      }))
    }
  }, [nodes, connections, selection])

  /** 粘贴 */
  const paste = useCallback(
    (target?: Position) => {
      const clipboard = clipboardRef.current
      if (clipboard.nodes.length === 0) return

      const pasteTarget = target ?? {
        x: Math.min(...clipboard.nodes.map((n) => n.position.x)) + 40,
        y: Math.min(...clipboard.nodes.map((n) => n.position.y)) + 40
      }
      const minX = Math.min(...clipboard.nodes.map((n) => n.position.x))
      const minY = Math.min(...clipboard.nodes.map((n) => n.position.y))
      const idMap = new Map<string, string>()

      const newNodes: CanvasNode[] = clipboard.nodes.map((n) => {
        const id = `node-${generateId()}`
        idMap.set(n.id, id)
        return {
          ...n,
          id,
          position: {
            x: n.position.x - minX + pasteTarget.x,
            y: n.position.y - minY + pasteTarget.y
          }
        }
      })

      const newConns: CanvasConnection[] = clipboard.connections.map((c) => ({
        id: `conn-${generateId()}`,
        fromNodeId: idMap.get(c.fromNodeId) ?? c.fromNodeId,
        toNodeId: idMap.get(c.toNodeId) ?? c.toNodeId
      }))

      onNodesChange((prev) => [...prev, ...newNodes])
      onConnectionsChange((prev) => [...prev, ...newConns])
      onSelectionChange(newNodes.map((n) => n.id))
    },
    [onNodesChange, onConnectionsChange, onSelectionChange]
  )

  /** 复制并偏移 (Ctrl+D) */
  const duplicateSelected = useCallback(() => {
    copySelected()
    paste()
  }, [copySelected, paste])

  return {
    copySelected,
    paste,
    duplicateSelected,
    clipboardRef
  }
}
