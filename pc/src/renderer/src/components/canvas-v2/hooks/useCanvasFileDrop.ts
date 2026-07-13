/**
 * useCanvasFileDrop.ts — 拖放上传 + 粘贴上传 hook
 * 处理 OS 文件拖入画布、Ctrl+V 粘贴图片/视频/音频
 */
import { useCallback, useEffect, useRef } from 'react'
import type { CanvasNode, Position } from '../types'

interface FileDropCallbacks {
  nodes: CanvasNode[]
  setNodes: (updater: (prev: CanvasNode[]) => CanvasNode[]) => void
  setSelectedNodeIds: (ids: string[]) => void
  screenToWorld: (sx: number, sy: number) => Position
}

function generateId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fitNodeSize(naturalW: number, naturalH: number, maxSize = 640): { width: number; height: number } {
  if (naturalW <= maxSize && naturalH <= maxSize) return { width: naturalW, height: naturalH }
  const ratio = naturalW / naturalH
  if (naturalW >= naturalH) {
    return { width: maxSize, height: Math.round(maxSize / ratio) }
  }
  return { width: Math.round(maxSize * ratio), height: maxSize }
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(mp3|wav)$/i.test(file.name)
}

export function useCanvasFileDrop(callbacks: FileDropCallbacks) {
  const { nodes, setNodes, setSelectedNodeIds, screenToWorld } = callbacks

  // Keep in ref to avoid stale closures in event listeners
  const refs = useRef({ nodes, setNodes, setSelectedNodeIds, screenToWorld })
  refs.current = { nodes, setNodes, setSelectedNodeIds, screenToWorld }

  /* ---- Create image node from File ---- */
  const createImageNode = useCallback((file: File, worldPos: Position) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const size = fitNodeSize(img.naturalWidth, img.naturalHeight)
      const id = generateId()
      const newNode: CanvasNode = {
        id,
        type: 'image',
        title: file.name,
        position: {
          x: worldPos.x - size.width / 2,
          y: worldPos.y - size.height / 2
        },
        width: size.width,
        height: size.height,
        metadata: {
          content: url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        }
      }
      refs.current.setNodes((prev) => [...prev, newNode])
      refs.current.setSelectedNodeIds([id])
    }
    img.src = url
  }, [])

  /* ---- Create video node from File ---- */
  const createVideoNode = useCallback((file: File, worldPos: Position) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const size = fitNodeSize(video.videoWidth, video.videoHeight, 420)
      const id = generateId()
      const newNode: CanvasNode = {
        id,
        type: 'video',
        title: file.name,
        position: {
          x: worldPos.x - size.width / 2,
          y: worldPos.y - size.height / 2
        },
        width: size.width,
        height: size.height,
        metadata: {
          content: url,
          naturalWidth: video.videoWidth,
          naturalHeight: video.videoHeight
        }
      }
      refs.current.setNodes((prev) => [...prev, newNode])
      refs.current.setSelectedNodeIds([id])
    }
    video.src = url
  }, [])

  /* ---- Create audio node from File ---- */
  const createAudioNode = useCallback(
    (file: File, worldPos: Position) => {
      const url = URL.createObjectURL(file)
      const id = generateId()
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
      setSelectedNodeIds([id])
    },
    [setNodes, setSelectedNodeIds]
  )

  /* ---- OS file drop handler ---- */
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const files = Array.from(event.dataTransfer.files)
      const file = files.find((f) => f.type.startsWith('image/') || f.type.startsWith('video/') || isAudioFile(f))
      if (!file) return

      const worldPos = screenToWorld(event.clientX, event.clientY)
      if (isAudioFile(file)) {
        createAudioNode(file, worldPos)
      } else if (file.type.startsWith('video/')) {
        createVideoNode(file, worldPos)
      } else {
        createImageNode(file, worldPos)
      }
    },
    [screenToWorld, createAudioNode, createVideoNode, createImageNode]
  )

  /* ---- System clipboard paste handler (Ctrl/Cmd+V) ---- */
  const handlePaste = useCallback(
    async (_event?: Event) => {
      // Only handle when no input is focused
      const activeEl = document.activeElement
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return
      }

      try {
        const items = await navigator.clipboard.read()
        const imageItem = items.find((item) => item.types.some((t) => t.startsWith('image/')))
        if (imageItem) {
          const imageType = imageItem.types.find((t) => t.startsWith('image/'))
          if (!imageType) return
          _event?.preventDefault()
          const blob = await imageItem.getType(imageType)
          const file = new File([blob], 'clipboard-image.png', {
            type: imageType
          })
          // Place at canvas center
          const worldPos = screenToWorld(window.innerWidth / 2, window.innerHeight / 2)
          createImageNode(file, worldPos)
        }
      } catch {
        // clipboard read failed (e.g., permission denied) — ignore silently
      }
    },
    [screenToWorld, createImageNode]
  )

  /* ---- Register keyboard paste listener ---- */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey
      if (isMod && !event.altKey && event.key === 'v') {
        handlePaste(event)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePaste])

  return { handleDrop }
}
