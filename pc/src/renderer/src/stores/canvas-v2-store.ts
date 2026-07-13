/**
 * canvas-v2-store.ts - 新画布 Zustand 状态管理
 * 管理 nodes/connections/viewport/selection，支持 undo/redo
 */
import { temporal } from 'zundo'
import { create, useStore } from 'zustand'
import { shallow } from 'zustand/shallow'
import type {
  CanvasBackgroundMode,
  CanvasConnection,
  CanvasNode,
  ViewportTransform
} from '../components/canvas-v2/types'

interface CanvasV2State {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  viewport: ViewportTransform
  backgroundMode: CanvasBackgroundMode
  showImageInfo: boolean
  selection: string[]
  selectedConnections: string[]

  setNodes: (nodes: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => void
  setConnections: (connections: CanvasConnection[] | ((prev: CanvasConnection[]) => CanvasConnection[])) => void
  setViewport: (viewport: ViewportTransform) => void
  setBackgroundMode: (mode: CanvasBackgroundMode) => void
  setShowImageInfo: (show: boolean) => void
  setSelection: (ids: string[]) => void
  setSelectedConnections: (ids: string[]) => void
  updateNode: (id: string, patch: Partial<CanvasNode>) => void

  // Batch operations
  applyNodesChange: (updater: (prev: CanvasNode[]) => CanvasNode[]) => void
  applyConnectionsChange: (updater: (prev: CanvasConnection[]) => CanvasConnection[]) => void
}

const initialViewport: ViewportTransform = { x: 0, y: 0, k: 1 }

export const useCanvasV2Store = create<CanvasV2State>()(
  temporal(
    (set) => ({
      nodes: [],
      connections: [],
      viewport: { ...initialViewport },
      backgroundMode: 'lines',
      showImageInfo: true,
      selection: [],
      selectedConnections: [],

      setNodes: (updater) =>
        set((state) => ({
          nodes: typeof updater === 'function' ? updater(state.nodes) : updater
        })),

      setConnections: (updater) =>
        set((state) => ({
          connections: typeof updater === 'function' ? updater(state.connections) : updater
        })),

      setViewport: (viewport) => set({ viewport }),
      setBackgroundMode: (backgroundMode) => set({ backgroundMode }),
      setShowImageInfo: (showImageInfo) => set({ showImageInfo }),
      setSelection: (selection) => set({ selection }),
      setSelectedConnections: (selectedConnections) => set({ selectedConnections }),

      updateNode: (id, patch) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
        })),

      applyNodesChange: (updater) => set((state) => ({ nodes: updater(state.nodes) })),

      applyConnectionsChange: (updater) => set((state) => ({ connections: updater(state.connections) }))
    }),
    {
      limit: 50,
      equality: shallow,
      partialize: (state) =>
        ({
          nodes: state.nodes,
          connections: state.connections
        }) as CanvasV2State
    }
  )
)

export const useCanvasV2Undo = () => {
  const pastStates = useStore(useCanvasV2Store.temporal, (s) => s.pastStates)
  const futureStates = useStore(useCanvasV2Store.temporal, (s) => s.futureStates)
  return {
    undo: useCanvasV2Store.temporal.getState().undo,
    redo: useCanvasV2Store.temporal.getState().redo,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0
  }
}
