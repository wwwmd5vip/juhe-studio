/**
 * CanvasWorkspace.tsx - 新画布工作区主组件
 * 整合 InfiniteCanvas、节点/连接、工具栏、快捷操作、助手面板
 */

import { Brush, Camera, Crop, Grid3X3, Maximize2, Sparkles, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import html2canvas from 'html2canvas'
import { error as toastError } from '@/components/ui/toast'
import { useCanvasV2Store, useCanvasV2Undo } from '@/stores/canvas-v2-store'
import { useProviderStore } from '@/stores/providers'
import { useThemeStore } from '@/stores/theme'
import { CanvasAppearanceSettings } from './CanvasAppearanceSettings'
import { CanvasAssetPicker } from './CanvasAssetPicker'
import type { CanvasAssistantPanelHandle } from './CanvasAssistantPanel'
import { CanvasAssistantPanel } from './CanvasAssistantPanel'
import { CanvasConnections } from './CanvasConnections'
import { CanvasContextMenu } from './CanvasContextMenu'
import { CanvasEmpty } from './CanvasEmpty'
import { MiniMap } from './CanvasMiniMap'
import { CanvasNodeView } from './CanvasNode'
import { CanvasNodeAngleDialog } from './CanvasNodeAngleDialog'
import { CanvasNodeCropDialog, type CropRect } from './CanvasNodeCropDialog'
import { CanvasNodeHoverToolbar } from './CanvasNodeHoverToolbar'
import { CanvasNodeInfoDialog } from './CanvasNodeInfoDialog'
import { CanvasNodeMaskEditDialog } from './CanvasNodeMaskEditDialog'
import { CanvasNodePromptPanel } from './CanvasNodePromptPanel'
import { CanvasNodeSplitDialog, splitDataUrl } from './CanvasNodeSplitDialog'
import { CanvasNodeUpscaleDialog, type UpscaleParams } from './CanvasNodeUpscaleDialog'
import { CanvasPromptLibrary } from './CanvasPromptLibrary'
import { CanvasRefreshShell } from './CanvasRefreshShell'
import { CanvasSelectionBox } from './CanvasSelectionBox'
import { CanvasSidebar } from './CanvasSidebar'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasToolbarSettingsModal } from './CanvasToolbarSettingsModal'
import { CanvasZoomControls } from './CanvasZoomControls'
import { ConnectionCreateMenu } from './ConnectionCreateMenu'
import { canvasThemes } from './canvas-theme'
import { createNode } from './constants'
import { useCanvasClipboard } from './hooks/useCanvasClipboard'
import { useCanvasConnections } from './hooks/useCanvasConnections'
import { useCanvasDrag } from './hooks/useCanvasDrag'
import { useCanvasKeyboard } from './hooks/useCanvasKeyboard'
import { useCanvasSelect } from './hooks/useCanvasSelect'
import { useNodeRunner } from './hooks/useNodeRunner'
import { InfiniteCanvas, screenToWorldPosition } from './InfiniteCanvas'
import { SelectionHub } from './SelectionHub'
import type {
  CanvasConnection,
  CanvasGenerationMode,
  CanvasImageAngleParams,
  CanvasImageSplitParams,
  CanvasNode,
  CanvasNodeType,
  ContextMenuState,
  Position
} from './types'

/** Fit image dimensions to max size while preserving aspect ratio */
function fitNodeSize(naturalW: number, naturalH: number, maxSize = 640): { width: number; height: number } {
  if (naturalW <= maxSize && naturalH <= maxSize) return { width: naturalW, height: naturalH }
  const ratio = naturalW / naturalH
  if (naturalW >= naturalH) {
    return { width: maxSize, height: Math.round(maxSize / ratio) }
  }
  return { width: Math.round(maxSize * ratio), height: maxSize }
}

interface CanvasWorkspaceProps {
  onSave?: () => void
}

export function CanvasWorkspace({ onSave }: CanvasWorkspaceProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const { t } = useTranslation()
  const theme = canvasThemes[themeResolved]

  // Store
  const nodes = useCanvasV2Store((s) => s.nodes)
  const connections = useCanvasV2Store((s) => s.connections)
  const viewport = useCanvasV2Store((s) => s.viewport)
  const backgroundMode = useCanvasV2Store((s) => s.backgroundMode)
  const selection = useCanvasV2Store((s) => s.selection)
  const setNodes = useCanvasV2Store((s) => s.setNodes)
  const setConnections = useCanvasV2Store((s) => s.setConnections)
  const setViewport = useCanvasV2Store((s) => s.setViewport)
  const setBackgroundMode = useCanvasV2Store((s) => s.setBackgroundMode)
  const setSelection = useCanvasV2Store((s) => s.setSelection)
  const updateNode = useCanvasV2Store((s) => s.updateNode)
  const { undo, redo, canUndo, canRedo } = useCanvasV2Undo()

  // Providers for assistant
  const providers = useProviderStore((s) => s.providers)
  const _selectedProviderId = useProviderStore((s) => s.selectedProviderId)
  const loadProviders = useProviderStore((s) => s.loadProviders)

  // Auto-load providers on mount
  const providersLoadedRef = useRef(false)
  useEffect(() => {
    if (!providersLoadedRef.current) {
      providersLoadedRef.current = true
      loadProviders()
    }
  }, [loadProviders])

  // Filter LLM-capable providers
  const llmProviders = useMemo(() => {
    return providers.filter((p) => p.isEnabled !== false && p.models.length > 0)
  }, [providers])

  // Selected assistant provider/model
  const [assistantProviderId, setAssistantProviderId] = useState('')
  const [assistantModelId, setAssistantModelId] = useState('')

  // Auto-select first provider if none selected
  useEffect(() => {
    if (!assistantProviderId && llmProviders.length > 0) {
      const first = llmProviders[0]
      setAssistantProviderId(first.id)
      if (first.models.length > 0) {
        setAssistantModelId(first.models[0].id)
      }
    }
  }, [llmProviders, assistantProviderId])

  // Get models for selected provider
  const assistantModels = useMemo(() => {
    const provider = llmProviders.find((p) => p.id === assistantProviderId)
    return provider?.models ?? []
  }, [llmProviders, assistantProviderId])

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)

  // Assistant panel
  const [showAssistant, setShowAssistant] = useState(false)
  const [showPromptLibrary, setShowPromptLibrary] = useState(false)
  const assistantPanelRef = useRef<CanvasAssistantPanelHandle>(null)

  // MiniMap
  const [showMiniMap, setShowMiniMap] = useState(true)
  const viewportSize = useMemo(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    return { width: rect?.width || 1400, height: rect?.height || 900 }
  }, [])

  // Running state (placeholder)
  // Node execution runner
  const { runNode, runCascade, cancelNode, isRunning } = useNodeRunner({
    nodes,
    connections,
    onNodesChange: setNodes,
    onConnectionsChange: setConnections
  })

  // ---- AI generation dialog panel (per-node floating prompt panel) ----
  const [dialogNodeId, setDialogNodeId] = useState<string | null>(null)

  // ---- Related node highlighting (1-hop connections) ----
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const relatedHighlight = useMemo(() => {
    const nodeIds = new Set<string>()
    const connectionIds = new Set<string>()

    if (!activeNodeId) return { nodeIds, connectionIds }

    nodeIds.add(activeNodeId)
    connections.forEach((connection) => {
      if (connection.fromNodeId !== activeNodeId && connection.toNodeId !== activeNodeId) return
      connectionIds.add(connection.id)
      nodeIds.add(connection.fromNodeId)
      nodeIds.add(connection.toNodeId)
    })

    return { nodeIds, connectionIds }
  }, [activeNodeId, connections])

  // ---- Batch motion (card stacking animation) ----
  const batchMotionById = useMemo(() => {
    const map = new Map<string, { x: number; y: number; index: number }>()
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    nodes.forEach((node) => {
      const rootId = node.metadata?.batchRootId
      if (!rootId) return
      const root = nodeById.get(rootId)
      const index = root?.metadata?.batchChildIds?.indexOf(node.id) ?? 0
      const stackX = root ? root.position.x + 34 + index * 14 : node.position.x
      const stackY = root ? root.position.y + 14 + index * 8 : node.position.y
      map.set(node.id, {
        x: stackX - node.position.x,
        y: stackY - node.position.y,
        index: Math.max(index, 0)
      })
    })
    return map
  }, [nodes])

  // Show image info toggle
  const showImageInfo = useCanvasV2Store((s) => s.showImageInfo ?? true)

  // Initial load state
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 800)
    return () => clearTimeout(timer)
  }, [])

  // Image dialog states
  const [cropNodeId, setCropNodeId] = useState<string | null>(null)
  const [upscaleNodeId, setUpscaleNodeId] = useState<string | null>(null)
  const [splitNodeId, setSplitNodeId] = useState<string | null>(null)
  const [angleNodeId, setAngleNodeId] = useState<string | null>(null)
  const [maskEditNodeId, setMaskEditNodeId] = useState<string | null>(null)
  const [showToolbarSettings, setShowToolbarSettings] = useState(false)
  const cropNode = cropNodeId ? (nodes.find((n) => n.id === cropNodeId) ?? null) : null
  const upscaleNode = upscaleNodeId ? (nodes.find((n) => n.id === upscaleNodeId) ?? null) : null
  const splitNode = splitNodeId ? (nodes.find((n) => n.id === splitNodeId) ?? null) : null
  const angleNode = angleNodeId ? (nodes.find((n) => n.id === angleNodeId) ?? null) : null
  const maskEditNode = maskEditNodeId ? (nodes.find((n) => n.id === maskEditNodeId) ?? null) : null

  // Batch animation state (opening/closing transition tracking)
  const [openingBatchIds, setOpeningBatchIds] = useState<Set<string>>(new Set())
  const [collapsingBatchIds, setCollapsingBatchIds] = useState<Set<string>>(new Set())

  // Hover toolbar
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const _hoveredNode = hoveredNodeId ? (nodes.find((n) => n.id === hoveredNodeId) ?? null) : null

  // Toolbar visibility management (keep/hide with 120ms delay)
  const [toolbarNodeId, setToolbarNodeId] = useState<string | null>(null)
  const toolbarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toolbarNode = toolbarNodeId ? (nodes.find((n) => n.id === toolbarNodeId) ?? null) : null

  const handleToolbarShow = useCallback((nodeId: string) => {
    if (toolbarHideTimerRef.current) clearTimeout(toolbarHideTimerRef.current)
    setToolbarNodeId(nodeId)
  }, [])

  const handleToolbarHide = useCallback(() => {
    if (toolbarHideTimerRef.current) clearTimeout(toolbarHideTimerRef.current)
    toolbarHideTimerRef.current = setTimeout(() => {
      setToolbarNodeId(null)
      toolbarHideTimerRef.current = null
    }, 350)
  }, [])

  // Cleanup hide timer on unmount
  useEffect(() => {
    return () => {
      if (toolbarHideTimerRef.current) clearTimeout(toolbarHideTimerRef.current)
    }
  }, [])

  // External text edit trigger (from toolbar "编辑文字")
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editRequestNonce, setEditRequestNonce] = useState(0)

  const openTextEditor = useCallback(
    (nodeId: string) => {
      const n = nodes.find((nd) => nd.id === nodeId)
      if (!n || n.type !== 'text') return
      if (!selection.includes(nodeId)) {
        setSelection([nodeId])
      }
      setEditingNodeId(nodeId)
      setEditRequestNonce((v) => v + 1)
    },
    [nodes, selection, setSelection]
  )

  // Toolbar screen position (above node, centered)
  const toolbarScreenPos = useMemo(() => {
    if (!toolbarNode) return { left: 0, top: 0 }
    return {
      left: viewport.x + (toolbarNode.position.x + (toolbarNode.width || 200) / 2) * viewport.k,
      top: viewport.y + toolbarNode.position.y * viewport.k
    }
  }, [toolbarNode, viewport.x, viewport.y, viewport.k])

  // View fullscreen
  const [viewFullNodeId, setViewFullNodeId] = useState<string | null>(null)
  const viewFullNode = viewFullNodeId ? (nodes.find((n) => n.id === viewFullNodeId) ?? null) : null

  // Replace image hidden input
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<string | null>(null)

  // Image quick tool selection (for toolbar settings)
  const [imageToolIds, setImageToolIds] = useState<string[]>([
    'copyPrompt',
    'reversePrompt',
    'replace',
    'freeResize',
    'maskEdit',
    'crop',
    'split',
    'upscale',
    'superResolve',
    'angle',
    'view'
  ])
  const [showImageToolLabels, setShowImageToolLabels] = useState(() => {
    try {
      return localStorage.getItem('IMAGE_QUICK_TOOLS_SHOW_LABELS') !== 'false'
    } catch (error) {
      console.error('Failed to read IMAGE_QUICK_TOOLS_SHOW_LABELS from localStorage:', error)
      return true
    }
  })

  // Node info dialog
  const [infoNodeId, setInfoNodeId] = useState<string | null>(null)
  const infoNode = infoNodeId ? (nodes.find((n) => n.id === infoNodeId) ?? null) : null

  // Appearance settings
  const [showAppearance, setShowAppearance] = useState(false)

  // Asset picker
  const [showAssetPicker, setShowAssetPicker] = useState(false)

  // Sidebar
  const [showSidebar, setShowSidebar] = useState(false)

  // Container rect for screen-positioned overlays
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerRect(el.getBoundingClientRect())
    const observer = new ResizeObserver(() => {
      setContainerRect(el.getBoundingClientRect())
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ---- Drag ----
  const { handleNodeMouseDown, handleDragMove, handleDragEnd } = useCanvasDrag({
    nodes,
    onNodesChange: setNodes
  })

  // Register global drag move/end listeners
  useEffect(() => {
    const onMove = (e: MouseEvent) => handleDragMove(e, viewport.k)
    const onUp = () => handleDragEnd()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleDragMove, handleDragEnd, viewport.k])

  // ---- Selection ----
  const { selectionBox, startSelection } = useCanvasSelect({
    nodes,
    onSelectionChange: setSelection
  })

  // ---- Connections ----
  const {
    activeDrag,
    createPending,
    handleConnectStart,
    handleConnectMove,
    handleConnectEnd,
    clearCreatePending,
    cancelDrag
  } = useCanvasConnections({
    nodes,
    connections,
    onConnectionsChange: setConnections
  })

  // Register connection drag listeners
  useEffect(() => {
    const toWorld = (clientX: number, clientY: number) => ({
      x: (clientX - viewport.x) / viewport.k,
      y: (clientY - viewport.y) / viewport.k
    })
    const onMove = (e: MouseEvent) => handleConnectMove(toWorld(e.clientX, e.clientY))
    const onUp = (e: MouseEvent) => handleConnectEnd(toWorld(e.clientX, e.clientY))
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleConnectMove, handleConnectEnd, viewport.x, viewport.y, viewport.k])

  // ---- Connection create menu handler ----
  const handleCreateFromConnection = useCallback(
    (type: CanvasNodeType) => {
      if (!createPending) return
      const { handle, worldPos } = createPending
      const sourceNode = nodes.find((n) => n.id === handle.nodeId)
      if (!sourceNode) {
        clearCreatePending()
        return
      }

      const newNode = createNode(type, {
        x: worldPos.x - 100,
        y: worldPos.y - 50
      })

      const fromId = handle.handleType === 'source' ? handle.nodeId : newNode.id
      const toId = handle.handleType === 'source' ? newNode.id : handle.nodeId
      const newConnection: CanvasConnection = {
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fromNodeId: fromId,
        toNodeId: toId
      }

      setNodes((prev) => [...prev, newNode])
      setConnections((prev) => [...prev, newConnection])
      clearCreatePending()
    },
    [createPending, nodes, setNodes, setConnections, clearCreatePending]
  )

  // ---- Clipboard ----
  const { copySelected, paste, duplicateSelected } = useCanvasClipboard({
    nodes,
    connections,
    selection,
    onNodesChange: setNodes,
    onConnectionsChange: setConnections,
    onSelectionChange: setSelection
  })

  // ---- Delete selected ----
  const handleDeleteSelected = useCallback(() => {
    if (selection.length === 0) return
    const idSet = new Set(selection)
    // Revoke blob URLs for image/video/audio nodes before removal
    nodes.forEach((n) => {
      if (idSet.has(n.id) && n.metadata?.content && n.metadata.content.startsWith('blob:')) {
        URL.revokeObjectURL(n.metadata.content)
      }
    })
    setNodes((prev) => prev.filter((n) => !idSet.has(n.id)))
    setConnections((prev) => prev.filter((c) => !idSet.has(c.fromNodeId) && !idSet.has(c.toNodeId)))
    setSelection([])
  }, [selection, setNodes, setConnections, setSelection, nodes])

  const handleSelectAll = useCallback(() => {
    setSelection(nodes.map((n) => n.id))
  }, [nodes, setSelection])

  const handleClearAll = useCallback(() => {
    // Revoke blob URLs for all media nodes
    nodes.forEach((n) => {
      if (n.metadata?.content && n.metadata.content.startsWith('blob:')) {
        URL.revokeObjectURL(n.metadata.content)
      }
    })
    setSelection([])
    setDialogNodeId(null)
    setContextMenu(null)
    setToolbarNodeId(null)
    setActiveNodeId(null)
    setEditingNodeId(null)
    setCropNodeId(null)
    setUpscaleNodeId(null)
    setSplitNodeId(null)
    setAngleNodeId(null)
    setMaskEditNodeId(null)
    setShowToolbarSettings(false)
    setShowPromptLibrary(false)
    setShowAppearance(false)
    setInfoNodeId(null)
    cancelDrag()
  }, [cancelDrag, setSelection])

  const handleSetBatchPrimary = useCallback(
    (childId: string) => {
      const child = nodes.find((n) => n.id === childId)
      const rootId = child?.metadata?.batchRootId
      if (!rootId || !child?.metadata?.content) return
      setNodes((prev) =>
        prev.map((node) =>
          node.id === rootId
            ? {
                ...node,
                width: child.width,
                height: child.height,
                metadata: {
                  ...node.metadata,
                  content: child.metadata?.content,
                  primaryImageId: child.id,
                  naturalWidth: child.metadata?.naturalWidth,
                  naturalHeight: child.metadata?.naturalHeight,
                  freeResize: child.metadata?.freeResize
                }
              }
            : node
        )
      )
    },
    [nodes, setNodes]
  )

  const handleGroupSelected = useCallback(() => {
    if (selection.length < 2) return
    const groupId = `group-${Date.now()}`
    const selectedNodes = nodes.filter((n) => selection.includes(n.id))
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
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'group',
      title: t('canvas.nodeTypes.group'),
      position: { x: minX - 40, y: minY - 40 },
      width: maxX - minX + 80,
      height: maxY - minY + 80,
      metadata: { nodeIds: selection }
    }
    setNodes((prev) => [...prev, groupNode])
    setSelection([groupId])
  }, [selection, nodes, setNodes, setSelection, t])

  const _duplicateSingleNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const newNode: CanvasNode = {
        ...node,
        id: newId,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        metadata: node.metadata ? { ...node.metadata } : undefined
      }
      setNodes((prev) => [...prev, newNode])
      setSelection([newId])
    },
    [nodes, setNodes, setSelection]
  )

  const handleRunSelected = useCallback(() => {
    if (selection.length === 1) {
      runNode(selection[0])
    }
  }, [selection, runNode])

  const handleRunCascade = useCallback(() => {
    if (selection.length > 0) {
      runCascade(selection)
    } else {
      runCascade()
    }
  }, [selection, runCascade])

  useCanvasKeyboard({
    containerRef,
    onUndo: useCallback(() => {
      if (canUndo) undo()
    }, [canUndo, undo]),
    onRedo: useCallback(() => {
      if (canRedo) redo()
    }, [canRedo, redo]),
    onDeleteSelected: handleDeleteSelected,
    onCopySelected: copySelected,
    onPaste: paste,
    onDuplicateSelected: duplicateSelected,
    onSelectAll: handleSelectAll,
    onClearAll: handleClearAll,
    onGroupSelected: handleGroupSelected,
    onRunSelected: handleRunSelected,
    onRunCascade: handleRunCascade
  })

  // ---- Node content change ----
  const handleNodeContentChange = useCallback(
    (nodeId: string, content: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      updateNode(nodeId, {
        metadata: { ...node?.metadata, content }
      } as Partial<CanvasNode>)
    },
    [nodes, updateNode]
  )

  // ---- Canvas events ----
  const handleCanvasMouseDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const worldPos = screenToWorldPosition({ x: event.clientX, y: event.clientY }, rect, viewport)
      startSelection(event, worldPos, event.ctrlKey || event.metaKey, selection)
      // Close AI panel when starting a new (non-additive) selection box
      if (!event.ctrlKey && !event.metaKey) {
        setDialogNodeId(null)
      }
    },
    [viewport, startSelection, selection]
  )

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCanvasDeselect = useCallback(() => {
    setSelection([])
    setActiveNodeId(null)
    closeContextMenu()
    // Don't clear dialogNodeId on pan-deselect — the prompt panel should survive panning
  }, [setSelection, closeContextMenu])

  const handleCanvasContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setContextMenu({
        type: 'pane',
        x: event.clientX,
        y: event.clientY,
        flowPos: screenToWorldPosition({ x: event.clientX, y: event.clientY }, rect, viewport)
      })
    },
    [viewport]
  )

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, nodeId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ type: 'node', x: event.clientX, y: event.clientY, nodeId })
  }, [])

  const deriveDialogMode = useCallback((node: CanvasNode): CanvasGenerationMode => {
    const metaMode = node.metadata?.generationMode
    if (metaMode === 'video' || metaMode === 'audio' || metaMode === 'text' || metaMode === 'image') return metaMode
    switch (node.type) {
      case 'video':
        return 'video'
      case 'audio':
        return 'audio'
      case 'text':
        return 'text'
      case 'image':
        return 'image'
      default:
        return 'image'
    }
  }, [])

  const handleAddNodeFromMenu = useCallback(
    (type: string, position?: Position) => {
      const pos = position || contextMenu?.flowPos || { x: 300, y: 200 }
      const node = createNode(type as CanvasNodeType, pos)
      setNodes((prev) => [...prev, node])
      closeContextMenu()
      // Auto-open AI panel for image/video/config nodes (not text/audio)
      if (type !== 'text' && type !== 'audio') {
        setDialogNodeId(node.id)
      }
    },
    [contextMenu?.flowPos, setNodes, closeContextMenu]
  )

  // ---- File upload helpers ----
  const createImageFileNode = useCallback(
    (file: File, worldPos: Position) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const size = fitNodeSize(img.naturalWidth, img.naturalHeight)
        const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newNode: CanvasNode = {
          id,
          type: 'image',
          title: file.name,
          position: { x: worldPos.x - size.width / 2, y: worldPos.y - size.height / 2 },
          width: size.width,
          height: size.height,
          metadata: { content: url, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }
        }
        setNodes((prev) => [...prev, newNode])
        setSelection([id])
        // Auto-open AI panel for image nodes
        setDialogNodeId(id)
      }
      img.src = url
    },
    [setNodes, setSelection]
  )

  const createVideoFileNode = useCallback(
    (file: File, worldPos: Position) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        const size = fitNodeSize(video.videoWidth, video.videoHeight, 420)
        const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const newNode: CanvasNode = {
          id,
          type: 'video',
          title: file.name,
          position: { x: worldPos.x - size.width / 2, y: worldPos.y - size.height / 2 },
          width: size.width,
          height: size.height,
          metadata: { content: url, naturalWidth: video.videoWidth, naturalHeight: video.videoHeight }
        }
        setNodes((prev) => [...prev, newNode])
        setSelection([id])
        // Auto-open AI panel for video nodes
        setDialogNodeId(id)
      }
      video.src = url
    },
    [setNodes, setSelection]
  )

  const createAudioFileNode = useCallback(
    (file: File, worldPos: Position) => {
      const url = URL.createObjectURL(file)
      const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newNode: CanvasNode = {
        id,
        type: 'audio',
        title: file.name,
        position: worldPos,
        width: 260,
        height: 72,
        metadata: { content: url }
      }
      setNodes((prev) => [...prev, newNode])
      setSelection([id])
    },
    [setNodes, setSelection]
  )

  // ---- Insert asset into canvas ----
  const handleInsertAsset = useCallback(
    (asset: { type: CanvasNodeType; title: string; content: string }, worldPos: Position) => {
      const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const size = fitNodeSize(200, 200)
      const newNode: CanvasNode = {
        id,
        type: asset.type,
        title: asset.title,
        position: { x: worldPos.x - size.width / 2, y: worldPos.y - size.height / 2 },
        width: size.width,
        height: size.height,
        metadata: { content: asset.content }
      }
      setNodes((prev) => [...prev, newNode])
    },
    [setNodes]
  )

  // ---- Replace image handler ----
  const handleReplaceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !replaceTargetRef.current) return
      const nodeId = replaceTargetRef.current
      replaceTargetRef.current = null

      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const size = fitNodeSize(img.naturalWidth, img.naturalHeight)
        updateNode(nodeId, {
          width: size.width,
          height: size.height,
          metadata: {
            ...nodes.find((n) => n.id === nodeId)?.metadata,
            content: url,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          }
        } as Partial<CanvasNode>)
      }
      img.src = url

      // Reset input so same file can be selected again
      event.target.value = ''
    },
    [nodes, updateNode]
  )

  // ---- System clipboard paste (Ctrl/Cmd+V for images) ----
  useEffect(() => {
    let mounted = true
    const handler = async (event: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return
      }

      const isMod = event.metaKey || event.ctrlKey
      if (!isMod || event.altKey || event.key !== 'v') return

      try {
        const items = await navigator.clipboard.read()
        if (!mounted) return
        const imageItem = items.find((item) => item.types.some((t) => t.startsWith('image/')))
        if (!imageItem) return
        const imageType = imageItem.types.find((t) => t.startsWith('image/'))
        if (!imageType) return
        event.preventDefault()
        const blob = await imageItem.getType(imageType)
        const file = new File([blob], 'clipboard-image.png', { type: imageType })
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const worldPos = screenToWorldPosition(
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          rect,
          viewport
        )
        createImageFileNode(file, worldPos)
      } catch {
        // clipboard read failed or permission denied — ignore
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      mounted = false
      window.removeEventListener('keydown', handler)
    }
  }, [viewport, createImageFileNode])

  // ---- Drop ----
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const worldPos = screenToWorldPosition({ x: event.clientX, y: event.clientY }, rect, viewport)

      // OS file drop (images/video/audio)
      const files = Array.from(event.dataTransfer.files)
      const file = files.find(
        (f) =>
          f.type.startsWith('image/') ||
          f.type.startsWith('video/') ||
          f.type.startsWith('audio/') ||
          /\.(mp3|wav)$/i.test(f.name)
      )
      if (file) {
        if (file.type.startsWith('audio/') || /\.(mp3|wav)$/i.test(file.name)) {
          createAudioFileNode(file, worldPos)
        } else if (file.type.startsWith('video/')) {
          createVideoFileNode(file, worldPos)
        } else {
          createImageFileNode(file, worldPos)
        }
        return
      }

      // Internal node-type drag
      const type = event.dataTransfer.getData('canvas/node-type') as CanvasNodeType
      const title = event.dataTransfer.getData('canvas/node-title')
      const content = event.dataTransfer.getData('canvas/node-content')

      if (type) {
        const node = createNode(type, worldPos, {
          title: title || type,
          metadata: content ? { content } : {}
        } as Partial<CanvasNode>)
        setNodes((prev) => [...prev, node])
      }
    },
    [viewport, setNodes, createImageFileNode, createVideoFileNode, createAudioFileNode]
  )

  // ---- Fit view ----
  const handleFitView = useCallback(() => {
    if (nodes.length === 0) {
      setViewport({ x: 0, y: 0, k: 1 })
      return
    }
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + (n.width || 300))
      maxY = Math.max(maxY, n.position.y + (n.height || 200))
    }

    const padding = 100
    const contentW = maxX - minX + padding * 2
    const contentH = maxY - minY + padding * 2
    const scaleX = rect.width / contentW
    const scaleY = rect.height / contentH
    const k = Math.min(scaleX, scaleY, 2)

    setViewport({
      x: (rect.width - contentW * k) / 2,
      y: (rect.height - contentH * k) / 2,
      k
    })
  }, [nodes, setViewport])

  // ---- Zoom controls ----
  const handleScaleChange = useCallback(
    (k: number) => {
      setViewport({ ...viewport, k: Math.max(0.05, Math.min(8, k)) })
    },
    [viewport, setViewport]
  )

  const handleZoomReset = useCallback(() => {
    setViewport({ x: 0, y: 0, k: 1 })
  }, [setViewport])

  // ---- PNG visual export ----
  const handleExportImage = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    html2canvas(container, {
      backgroundColor: theme.canvas.background,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false
    })
      .then((canvas) => {
        const dataUrl = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `canvas-${Date.now()}.png`
        a.click()
      })
      .catch((err: unknown) => {
        console.error('Canvas image export failed:', err)
        toastError({
          title: t('canvas.actions.exportImage'),
          description: (err as Error).message || String(err)
        })
      })
  }, [theme.canvas.background, t])

  // ---- Prompt library ----
  const handleSelectPrompt = useCallback((prompt: string) => {
    // Open assistant panel and feed the prompt
    setShowAssistant(true)
    setTimeout(() => {
      assistantPanelRef.current?.sendText(prompt)
    }, 200)
  }, [])

  return (
    <div
      ref={containerRef}
      className='relative h-full w-full overflow-hidden'
      style={{ background: theme.canvas.background }}
    >
      {/* Sidebar - node palette */}
      <CanvasSidebar
        isOpen={showSidebar}
        onToggle={() => setShowSidebar((v) => !v)}
        onAddNode={(type, position) => handleAddNodeFromMenu(type, position)}
        viewportCenter={useMemo(() => {
          const w = containerRef.current?.getBoundingClientRect().width ?? 1400
          const h = containerRef.current?.getBoundingClientRect().height ?? 900
          return {
            x: (w / 2 - viewport.x) / viewport.k,
            y: (h / 2 - viewport.y) / viewport.k
          }
        }, [viewport])}
      />

      {/* Main canvas */}
      <InfiniteCanvas
        viewport={viewport}
        backgroundMode={backgroundMode}
        onViewportChange={setViewport}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasDeselect={handleCanvasDeselect}
        onContextMenu={handleCanvasContextMenu}
        onDrop={handleDrop}
      >
        {/* Connections */}
        <CanvasConnections
          nodes={nodes}
          connections={connections}
          activeDrag={activeDrag}
          selectedConnectionId={null}
          onSelectConnection={() => {}}
          onConnectionContextMenu={() => {}}
        />

        {/* Selection box */}
        {selectionBox && <CanvasSelectionBox selectionBox={selectionBox} />}

        {/* Nodes */}
        {nodes.map((node) => (
          <CanvasNodeView
            key={node.id}
            data={node}
            scale={viewport.k}
            isSelected={selection.includes(node.id)}
            isRelated={relatedHighlight.nodeIds.has(node.id)}
            isConnectionTarget={!!activeDrag && activeDrag.handle.nodeId !== node.id}
            isConnecting={activeDrag?.handle.nodeId === node.id}
            editRequestNonce={editingNodeId === node.id ? editRequestNonce : 0}
            showImageInfo={showImageInfo}
            batchMotion={batchMotionById.get(node.id) ?? null}
            batchClosing={!!node.metadata?.batchRootId && collapsingBatchIds.has(node.metadata.batchRootId)}
            batchOpening={node.metadata?.isBatchRoot ? openingBatchIds.has(node.id) : false}
            batchRecovering={node.metadata?.isBatchRoot ? collapsingBatchIds.has(node.id) : false}
            onToggleBatch={(nodeId) => {
              const target = nodes.find((n) => n.id === nodeId)
              if (!target?.metadata) return
              const isExpanded = target.metadata.imageBatchExpanded ?? false

              if (isExpanded) {
                // Collapsing: add to collapsingBatchIds
                setCollapsingBatchIds((prev) => new Set(prev).add(nodeId))
                setTimeout(() => {
                  setCollapsingBatchIds((prev) => {
                    const next = new Set(prev)
                    next.delete(nodeId)
                    return next
                  })
                }, 320)
              } else {
                // Opening: add to openingBatchIds
                setOpeningBatchIds((prev) => new Set(prev).add(nodeId))
                setTimeout(() => {
                  setOpeningBatchIds((prev) => {
                    const next = new Set(prev)
                    next.delete(nodeId)
                    return next
                  })
                }, 260)
              }

              updateNode(nodeId, {
                metadata: {
                  ...target.metadata,
                  imageBatchExpanded: !isExpanded
                }
              } as Partial<CanvasNode>)
            }}
            onSetBatchPrimary={handleSetBatchPrimary}
            onMouseDown={(e) => {
              handleNodeMouseDown(e, node.id)
              setActiveNodeId(node.id)
            }}
            onResize={(nodeId, width, height, position) => {
              updateNode(nodeId, {
                width,
                height,
                ...(position ? { position } : {})
              } as Partial<CanvasNode>)
            }}
            onConnectStart={(e, nodeId, handleType) => {
              handleConnectStart(e, nodeId, handleType)
            }}
            onContentChange={(content) => handleNodeContentChange(node.id, content)}
            onTitleChange={(nodeId, title) => {
              updateNode(nodeId, { title } as Partial<CanvasNode>)
            }}
            onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
            onClick={(nodeId) => {
              // Open AI panel for all node types on click
              setDialogNodeId(nodeId)
            }}
            onHover={(nodeId) => {
              setHoveredNodeId(nodeId)
              if (nodeId) {
                handleToolbarShow(nodeId)
              } else {
                handleToolbarHide()
              }
            }}
          />
        ))}

        {/* Empty canvas prompt */}
        {nodes.length === 0 && !isInitialLoad && (
          <CanvasEmpty viewportScale={viewport.k} onAddNode={handleAddNodeFromMenu} />
        )}

        {/* Initial loading skeleton */}
        {nodes.length === 0 && isInitialLoad && <CanvasRefreshShell />}

        {/* Prompt panels for selected / dialog-open nodes */}
        {nodes
          .filter((n) => {
            if (dialogNodeId) return n.id === dialogNodeId
            // fallback: show for selected config nodes when no dialogNodeId set
            if (dialogNodeId === null && n.type === 'config' && selection.includes(n.id)) return true
            return false
          })
          .map((node) => {
            const dialogMode = deriveDialogMode(node)
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
                key={`panel-${node.id}`}
                className='absolute z-[65]'
                style={{
                  left: node.position.x,
                  top: node.position.y + (node.height || 200) + 12,
                  width: Math.max(node.width || 320, 400)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <CanvasNodePromptPanel
                  node={node}
                  isRunning={isRunning}
                  mode={dialogMode}
                  mentionReferences={[]}
                  availableModels={llmProviders.flatMap((p) =>
                    p.models.map((m) => ({
                      id: m.id,
                      name: m.name || m.id,
                      displayName: m.displayName ?? undefined,
                      capabilities: m.capabilities ?? undefined
                    }))
                  )}
                  onPromptChange={(nodeId, prompt) => {
                    updateNode(nodeId, {
                      metadata: {
                        ...nodes.find((n) => n.id === nodeId)?.metadata,
                        prompt
                      }
                    } as Partial<CanvasNode>)
                  }}
                  onConfigChange={(nodeId, patch) => {
                    updateNode(nodeId, {
                      metadata: { ...nodes.find((n) => n.id === nodeId)?.metadata, ...patch }
                    } as Partial<CanvasNode>)
                  }}
                  onGenerate={(nodeId, mode) => runNode(nodeId, mode)}
                  onStop={(nodeId) => cancelNode(nodeId)}
                />
              </div>
            )
          })}
      </InfiniteCanvas>

      {/* Zoom controls */}
      <div className='absolute bottom-4 right-4 z-30'>
        <CanvasZoomControls
          scale={viewport.k}
          onScaleChange={handleScaleChange}
          onReset={handleZoomReset}
          isMiniMapOpen={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap((v) => !v)}
        />
      </div>

      {/* MiniMap */}
      {showMiniMap && (
        <div className='absolute bottom-4 left-4 z-30'>
          <MiniMap nodes={nodes} viewport={viewport} viewportSize={viewportSize} onViewportChange={setViewport} />
        </div>
      )}

      {/* Toolbar */}
      <CanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        selectionCount={selection.length}
        isRunning={isRunning}
        onUndo={undo}
        onRedo={redo}
        onFitView={handleFitView}
        onImport={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.json'
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            try {
              const text = await file.text()
              const data = JSON.parse(text)
              if (data.nodes && data.connections) {
                setNodes(data.nodes)
                setConnections(data.connections)
                if (data.viewport) setViewport(data.viewport)
              }
            } catch {
              /* invalid file */
            }
          }
          input.click()
        }}
        onExport={() => {
          try {
            const data = {
              version: 1,
              nodes,
              connections,
              viewport,
              backgroundMode,
              exportedAt: new Date().toISOString()
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `canvas-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
          } catch (err) {
            console.error('Canvas export failed:', err)
            toastError({ title: 'Export failed', description: (err as Error).message || 'Failed to export canvas data' })
          }
        }}
        onRunAll={() => {
          const runnable = nodes.filter((n) => ['config', 'llm', 'comfy', 'modelscope', 'loop'].includes(n.type))
          // biome-ignore lint/suspicious/useIterableCallbackReturn: ignored using `--suppress`
          runnable.forEach((n) => runNode(n.id))
        }}
        onSave={onSave}
        onExportImage={handleExportImage}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={duplicateSelected}
        onGroupSelected={handleGroupSelected}
        onClearCanvas={() => {
          // Revoke blob URLs for all media nodes before clearing
          nodes.forEach((n) => {
            if (n.metadata?.content && n.metadata.content.startsWith('blob:')) {
              URL.revokeObjectURL(n.metadata.content)
            }
          })
          setNodes([])
          setConnections([])
          setSelection([])
        }}
        onToggleAssistant={() => setShowAssistant((v) => !v)}
        isAssistantOpen={showAssistant}
        backgroundMode={backgroundMode}
        showImageInfo={showImageInfo}
        onBackgroundModeChange={setBackgroundMode}
        onToggleTheme={() => {
          useThemeStore.getState().toggle()
        }}
        onToggleImageInfo={() => {
          useCanvasV2Store.getState().setShowImageInfo(!showImageInfo)
        }}
        onAppearance={() => setShowAppearance(true)}
        onAssets={() => setShowAssetPicker(true)}
      />

      {/* Assistant panel */}
      {showAssistant && (
        <div className='absolute top-0 right-0 bottom-0 z-40'>
          <CanvasAssistantPanel
            ref={assistantPanelRef}
            isOpen={showAssistant}
            onClose={() => setShowAssistant(false)}
            nodes={nodes}
            connections={connections}
            onNodesChange={setNodes}
            onConnectionsChange={setConnections}
            onSelectionChange={setSelection}
            providerId={assistantProviderId}
            modelId={assistantModelId}
            providers={llmProviders.map((p) => ({ id: p.id, name: p.name }))}
            models={assistantModels.map((m) => ({
              id: m.id,
              name: m.name || m.id,
              displayName: m.displayName ?? undefined
            }))}
            onProviderChange={setAssistantProviderId}
            onModelChange={setAssistantModelId}
            onOpenPromptLibrary={() => setShowPromptLibrary(true)}
          />
        </div>
      )}

      {/* Prompt library */}
      <CanvasPromptLibrary
        isOpen={showPromptLibrary}
        onClose={() => setShowPromptLibrary(false)}
        onSelectPrompt={handleSelectPrompt}
      />

      {/* Context menu */}
      {contextMenu && (
        <CanvasContextMenu
          state={contextMenu}
          selection={selection}
          onClose={closeContextMenu}
          onAddNode={handleAddNodeFromMenu}
          onDelete={handleDeleteSelected}
          onDuplicate={duplicateSelected}
          onGroup={handleGroupSelected}
        />
      )}

      {/* Node hover toolbar — rendered above node in canvas space */}
      <CanvasNodeHoverToolbar
        node={toolbarNode}
        left={toolbarScreenPos.left}
        top={toolbarScreenPos.top}
        visible={!!toolbarNode}
        onKeep={() => {
          if (toolbarNodeId) handleToolbarShow(toolbarNodeId)
        }}
        onLeave={handleToolbarHide}
        onDelete={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          if (n?.metadata?.content && n.metadata.content.startsWith('blob:')) {
            URL.revokeObjectURL(n.metadata.content)
          }
          setNodes((prev) => prev.filter((n) => n.id !== nodeId))
          setConnections((prev) => prev.filter((c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId))
          setSelection([])
        }}
        onInfo={(nodeId) => setInfoNodeId(nodeId)}
        onRetry={(nodeId) => {
          // Recover generation config from metadata and re-run
          const n = nodes.find((nd) => nd.id === nodeId)
          if (n) {
            updateNode(nodeId, { metadata: { ...n.metadata, status: 'queued' } } as Partial<CanvasNode>)
            runNode(nodeId)
          }
        }}
        onSaveAsset={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          if (n?.metadata?.content) {
            try {
              const assets = JSON.parse(localStorage.getItem('canvas-assets') || '[]')
              assets.push({
                id: `asset-${Date.now()}`,
                nodeId,
                type: n.type,
                title: n.title,
                content: n.metadata.content,
                bytes: n.metadata.bytes,
                mimeType: n.metadata.mimeType,
                savedAt: new Date().toISOString()
              })
              const serialized = JSON.stringify(assets)
              // 4MB limit to prevent localStorage overflow
              if (serialized.length > 4 * 1024 * 1024) {
                let trimmed = assets
                while (JSON.stringify(trimmed).length > 4 * 1024 * 1024 && trimmed.length > 1) {
                  trimmed = trimmed.slice(1)
                }
                localStorage.setItem('canvas-assets', JSON.stringify(trimmed))
              } else {
                localStorage.setItem('canvas-assets', serialized)
              }
            } catch (e) {
              console.error('Failed to save canvas asset:', e)
            }
          }
        }}
        onDownload={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          if (n?.metadata?.content) {
            const a = document.createElement('a')
            a.href = n.metadata.content
            a.download = n.title || 'download'
            a.click()
          }
        }}
        onToggleDialog={(nodeId) => {
          // Toggle generation panel for all node types
          if (dialogNodeId === nodeId) {
            setDialogNodeId(null)
          } else {
            setDialogNodeId(nodeId)
          }
        }}
        onEditText={(nodeId) => openTextEditor(nodeId)}
        onDecreaseFont={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          const current = n?.metadata?.fontSize ?? 16
          updateNode(nodeId, {
            metadata: { ...n?.metadata, fontSize: Math.max(current - 2, 10) }
          } as Partial<CanvasNode>)
        }}
        onIncreaseFont={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          const current = n?.metadata?.fontSize ?? 16
          updateNode(nodeId, {
            metadata: { ...n?.metadata, fontSize: Math.min(current + 2, 32) }
          } as Partial<CanvasNode>)
        }}
        onGenerateImage={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          if (n?.metadata?.content) {
            const configNode = createNode(
              'config',
              {
                x: n.position.x + (n.width || 200) + 40,
                y: n.position.y
              },
              { prompt: n.metadata.content } as Partial<CanvasNode>
            )
            setNodes((prev) => [...prev, configNode])
            // Create connection from text to config
            const conn: CanvasConnection = {
              id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fromNodeId: nodeId,
              toNodeId: configNode.id
            }
            setConnections((prev) => [...prev, conn])
          }
        }}
        onConfig={(nodeId) => {
          // Open config node's AI panel via dialogNodeId
          setDialogNodeId(nodeId)
        }}
        onUpload={(nodeId) => {
          replaceTargetRef.current = nodeId
          replaceInputRef.current?.click()
        }}
        onMaskEdit={(nodeId) => setMaskEditNodeId(nodeId)}
        onCrop={(nodeId) => setCropNodeId(nodeId)}
        onSplit={(nodeId) => setSplitNodeId(nodeId)}
        onUpscale={(nodeId) => setUpscaleNodeId(nodeId)}
        onSuperResolve={(nodeId) => setUpscaleNodeId(nodeId)}
        onAngle={(nodeId) => setAngleNodeId(nodeId)}
        onViewImage={(nodeId) => setViewFullNodeId(nodeId)}
        onCopyPrompt={(nodeId) => {
          const n = nodes.find((nd) => nd.id === nodeId)
          const prompt = n?.metadata?.prompt || n?.metadata?.content
          if (prompt) navigator.clipboard.writeText(prompt)
        }}
        onReversePrompt={(nodeId) => {
          // Create text + config nodes for LLM-based reverse prompt
          const n = nodes.find((nd) => nd.id === nodeId)
          if (!n) return
          const textNode = createNode(
            'text',
            {
              x: n.position.x + (n.width || 200) + 40,
              y: n.position.y
            },
            { content: `请分析并反推这张图片的生成提示词、风格、参数` } as Partial<CanvasNode>
          )
          const configNode = createNode(
            'config',
            {
              x: n.position.x + (n.width || 200) + 40,
              y: n.position.y + 260
            },
            { prompt: '根据上文的图片分析结果，生成类似的提示词' } as Partial<CanvasNode>
          )
          setNodes((prev) => [...prev, textNode, configNode])
          setConnections((prev) => [
            ...prev,
            { id: `conn-${Date.now()}-1`, fromNodeId: nodeId, toNodeId: textNode.id },
            { id: `conn-${Date.now()}-2`, fromNodeId: textNode.id, toNodeId: configNode.id }
          ])
        }}
        onToggleFreeResize={(nodeId) => {
          updateNode(nodeId, {
            metadata: {
              ...nodes.find((n) => n.id === nodeId)?.metadata,
              freeResize: !(nodes.find((n) => n.id === nodeId)?.metadata?.freeResize ?? false)
            }
          } as Partial<CanvasNode>)
        }}
        onOpenToolbarSettings={() => setShowToolbarSettings(true)}
      />

      {/* Selection hub (multi-select floating bar) */}
      <SelectionHub
        nodes={nodes}
        selection={selection}
        connections={connections}
        viewport={viewport}
        containerRect={containerRect}
        onDelete={handleDeleteSelected}
        onDuplicate={duplicateSelected}
        onGroup={handleGroupSelected}
        onRunCascade={() => runCascade(selection)}
      />

      {/* Crop dialog */}
      {cropNode?.metadata?.content && (
        <CanvasNodeCropDialog
          dataUrl={cropNode.metadata.content}
          open={!!cropNodeId}
          onClose={() => setCropNodeId(null)}
          onConfirm={(rect: CropRect) => {
            // Create cropped image as new node; for now, create a copy
            const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            const newNode: CanvasNode = {
              id: newId,
              type: 'image',
              title: `${cropNode.title || t('canvas.nodeTypes.image')} (${t('canvas.toolbarDetail.crop')})`,
              position: {
                x: cropNode.position.x + (cropNode.width || 200) + 40,
                y: cropNode.position.y
              },
              width: cropNode.width,
              height: cropNode.height,
              metadata: {
                content: cropNode.metadata?.content,
                naturalWidth: Math.round(rect.width * (cropNode.metadata?.naturalWidth || cropNode.width)),
                naturalHeight: Math.round(rect.height * (cropNode.metadata?.naturalHeight || cropNode.height)),
                cropRect: rect,
                freeResize: true
              }
            }
            setNodes((prev) => [...prev, newNode])
            setCropNodeId(null)
          }}
        />
      )}

      {/* Upscale dialog */}
      {upscaleNode?.metadata?.content && (
        <CanvasNodeUpscaleDialog
          dataUrl={upscaleNode.metadata.content}
          open={!!upscaleNodeId}
          onClose={() => setUpscaleNodeId(null)}
          onConfirm={(params: UpscaleParams) => {
            const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            const naturalW = upscaleNode.metadata?.naturalWidth || upscaleNode.width
            const naturalH = upscaleNode.metadata?.naturalHeight || upscaleNode.height
            const _longEdge = Math.max(naturalW, naturalH)
            const ratio = naturalW / naturalH
            const outW = naturalW >= naturalH ? params.targetLongEdge : Math.round(params.targetLongEdge * ratio)
            const outH = naturalH >= naturalW ? params.targetLongEdge : Math.round(params.targetLongEdge / ratio)
            const newNode: CanvasNode = {
              id: newId,
              type: 'image',
              title: `${upscaleNode.title || t('canvas.nodeTypes.image')} (${params.targetLongEdge >= 2048 ? '2K' : params.targetLongEdge >= 4096 ? '4K' : '1K'})`,
              position: {
                x: upscaleNode.position.x + (upscaleNode.width || 200) + 40,
                y: upscaleNode.position.y
              },
              width: upscaleNode.width,
              height: upscaleNode.height,
              metadata: {
                content: upscaleNode.metadata?.content,
                naturalWidth: outW,
                naturalHeight: outH,
                upscaleParams: params
              }
            }
            setNodes((prev) => [...prev, newNode])
            setUpscaleNodeId(null)
          }}
        />
      )}

      {/* Connection create menu */}
      {createPending && (
        <ConnectionCreateMenu
          worldPos={createPending.worldPos}
          fromNodeType={nodes.find((n) => n.id === createPending.handle.nodeId)?.type || 'image'}
          handleType={createPending.handle.handleType}
          viewport={viewport}
          containerRect={containerRect}
          onSelect={handleCreateFromConnection}
          onClose={clearCreatePending}
        />
      )}

      {/* Split dialog */}
      {splitNode?.metadata?.content && (
        <CanvasNodeSplitDialog
          dataUrl={splitNode.metadata.content}
          open={!!splitNodeId}
          onClose={() => setSplitNodeId(null)}
          onConfirm={async (params: CanvasImageSplitParams) => {
            try {
              const content = splitNode.metadata?.content
              if (!content) return
              const pieces = await splitDataUrl(content, params)
              const pieceW = (splitNode.metadata?.naturalWidth || splitNode.width) / params.columns
              const pieceH = (splitNode.metadata?.naturalHeight || splitNode.height) / params.rows
              pieces.forEach((dataUrl, i) => {
                const row = Math.floor(i / params.columns)
                const col = i % params.columns
                const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`
                const size = fitNodeSize(pieceW, pieceH)
                const newNode: CanvasNode = {
                  id: newId,
                  type: 'image',
                  title: `${splitNode.title || t('canvas.nodeTypes.image')} ${row + 1}-${col + 1}`,
                  position: {
                    x: splitNode.position.x + (splitNode.width || 200) + 40 + col * (size.width + 16),
                    y: splitNode.position.y + row * (size.height + 16)
                  },
                  width: size.width,
                  height: size.height,
                  metadata: {
                    content: dataUrl,
                    naturalWidth: pieceW,
                    naturalHeight: pieceH,
                    splitParams: params,
                    batchRootId: splitNode.id
                  }
                }
                setNodes((prev) => [...prev, newNode])
              })
            } catch (err) {
              console.error('Split failed:', err)
            }
            setSplitNodeId(null)
          }}
        />
      )}

      {/* Angle dialog */}
      {angleNode?.metadata?.content && (
        <CanvasNodeAngleDialog
          dataUrl={angleNode.metadata.content}
          open={!!angleNodeId}
          onClose={() => setAngleNodeId(null)}
          onConfirm={(params: CanvasImageAngleParams) => {
            // Create child image node in "queued" status for AI angle generation
            const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const newNode: CanvasNode = {
              id: newId,
              type: 'config',
              title: `${angleNode.title || t('canvas.nodeTypes.image')} (${t('canvas.toolbarDetail.angle')})`,
              position: {
                x: angleNode.position.x + (angleNode.width || 200) + 40,
                y: angleNode.position.y
              },
              width: 280,
              height: 200,
              metadata: {
                prompt: `基于参考图重新生成同一主体的新视角，保持主体、颜色、材质和画面风格一致，不要只做透视变形。水平角度${params.horizontalAngle > 0 ? '右' : '左'}${Math.abs(params.horizontalAngle)}°，俯仰${params.pitchAngle > 0 ? '上' : '下'}${Math.abs(params.pitchAngle)}°，镜头距离${params.cameraDistance}${params.wideAngle ? '，广角' : ''}。`,
                angleParams: params
              }
            }
            setNodes((prev) => [...prev, newNode])
            setAngleNodeId(null)
          }}
        />
      )}

      {/* Hidden file input for image replacement */}
      <input ref={replaceInputRef} type='file' accept='image/*' className='hidden' onChange={handleReplaceChange} />

      {/* View fullscreen overlay */}
      {viewFullNode?.metadata?.content && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
          className='fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md'
          onClick={() => setViewFullNodeId(null)}
        >
          <button
            type='button'
            className='absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20'
            onClick={() => setViewFullNodeId(null)}
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='4' y1='4' x2='16' y2='16' />
              <line x1='16' y1='4' x2='4' y2='16' />
            </svg>
          </button>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          <img
            src={viewFullNode.metadata.content}
            alt={viewFullNode.title || ''}
            className='max-h-[92vh] max-w-[92vw] rounded-xl object-contain shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          />
          <p className='absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/40'>{viewFullNode.title}</p>
        </div>
      )}

      {/* Node info dialog */}
      <CanvasNodeInfoDialog node={infoNode} open={!!infoNodeId} onClose={() => setInfoNodeId(null)} />

      {/* Appearance settings */}
      <CanvasAppearanceSettings open={showAppearance} onClose={() => setShowAppearance(false)} />

      {/* Mask edit dialog */}
      {maskEditNode?.metadata?.content && (
        <CanvasNodeMaskEditDialog
          dataUrl={maskEditNode.metadata.content}
          open={!!maskEditNodeId}
          onClose={() => setMaskEditNodeId(null)}
          onConfirm={({ prompt, maskDataUrl }) => {
            // Create a new config node with mask edit prompt for AI inpainting
            const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const newNode: CanvasNode = {
              id: newId,
              type: 'config',
              title: `${maskEditNode.title || t('canvas.nodeTypes.image')} (${t('canvas.toolbarDetail.maskEdit')})`,
              position: {
                x: maskEditNode.position.x + (maskEditNode.width || 200) + 40,
                y: maskEditNode.position.y
              },
              width: 280,
              height: 200,
              metadata: {
                prompt,
                maskDataUrl,
                referenceUrl: maskEditNode.metadata?.content || ''
              }
            }
            setNodes((prev) => [...prev, newNode])
            setMaskEditNodeId(null)
          }}
        />
      )}

      {/* Toolbar settings modal */}
      <CanvasToolbarSettingsModal
        open={showToolbarSettings}
        tools={[
          {
            id: 'maskEdit',
            title: t('canvas.toolbarDetail.maskEdit'),
            label: t('canvas.toolbarDetail.maskEdit'),
            icon: <Brush />,
            defaultVisible: true
          },
          {
            id: 'crop',
            title: t('canvas.toolbarDetail.crop'),
            label: t('canvas.toolbarDetail.crop'),
            icon: <Crop />,
            defaultVisible: true
          },
          {
            id: 'split',
            title: t('canvas.toolbarDetail.split'),
            label: t('canvas.toolbarDetail.split'),
            icon: <Grid3X3 />,
            defaultVisible: true
          },
          {
            id: 'upscale',
            title: t('canvas.toolbarDetail.upscale'),
            label: t('canvas.toolbarDetail.upscale'),
            icon: <ZoomIn />,
            defaultVisible: true
          },
          {
            id: 'superResolve',
            title: t('canvas.toolbarDetail.superResolve'),
            label: t('canvas.toolbarDetail.superResolve'),
            icon: <Sparkles />,
            defaultVisible: true
          },
          {
            id: 'angle',
            title: t('canvas.toolbarDetail.angle'),
            label: t('canvas.toolbarDetail.angle'),
            icon: <Camera />,
            defaultVisible: false
          },
          {
            id: 'view',
            title: t('canvas.toolbarDetail.viewImage'),
            label: t('canvas.toolbarDetail.viewImage'),
            icon: <Maximize2 />,
            defaultVisible: true
          }
        ]}
        selectedIds={imageToolIds}
        showLabels={showImageToolLabels}
        onToggle={(id, visible) => {
          setImageToolIds((prev) => (visible ? [...prev, id] : prev.filter((x) => x !== id)))
        }}
        onShowLabelsChange={(v) => {
          setShowImageToolLabels(v)
          localStorage.setItem('IMAGE_QUICK_TOOLS_SHOW_LABELS', String(v))
        }}
        onCancel={() => setShowToolbarSettings(false)}
        onSave={() => setShowToolbarSettings(false)}
      />

      {/* Asset picker */}
      {showAssetPicker && (
        <CanvasAssetPicker
          open={showAssetPicker}
          onClose={() => setShowAssetPicker(false)}
          onInsert={(asset, pos) => {
            handleInsertAsset(asset, pos)
            setShowAssetPicker(false)
          }}
          canvasCenter={{
            x: -viewport.x / viewport.k + (containerRect?.width || 1400) / 2 / viewport.k,
            y: -viewport.y / viewport.k + (containerRect?.height || 900) / 2 / viewport.k
          }}
        />
      )}
    </div>
  )
}
