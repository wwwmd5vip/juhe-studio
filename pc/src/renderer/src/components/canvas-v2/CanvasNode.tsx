import { ChevronRight, Image as ImageIcon, Music2, RefreshCw, Star, Video } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { type CanvasTheme, canvasThemes } from './canvas-theme'
import type { CanvasNode, Position } from './types'

// ---- Helpers ----

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`
}

// ---- Props ----

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
const selectionBlue = '#2f80ff'

interface CanvasNodeProps {
  data: CanvasNode
  scale: number
  isSelected: boolean
  isRelated: boolean
  isFocusRelated?: boolean
  isConnectionTarget: boolean
  isConnecting: boolean
  /** 外部触发文本编辑的计数器，每次变更时进入编辑模式 */
  editRequestNonce?: number
  showImageInfo?: boolean
  resourceLabel?: CanvasResourceReference
  onMouseDown: (event: React.MouseEvent, nodeId: string) => void
  onResize: (nodeId: string, width: number, height: number, position?: Position) => void
  onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void
  onContentChange?: (nodeId: string, content: string) => void
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void
  onDoubleClick?: (nodeId: string) => void
  onHover?: (nodeId: string | null) => void
  /** 重试回调 */
  onRetry?: (nodeId: string) => void
  /** 用文本生图回调 */
  onGenerateImage?: (nodeId: string) => void
  /** 点击节点（非拖拽）回调，用于打开/关闭 AI 生成面板 */
  onClick?: (nodeId: string) => void
  /** 自定义节点内容渲染器，传入时替代默认渲染 */
  renderContent?: (node: CanvasNode, theme: CanvasTheme) => React.ReactNode
  /** 批处理动画数据 */
  batchMotion?: { x: number; y: number; index: number } | null
  batchClosing?: boolean
  batchOpening?: boolean
  batchRecovering?: boolean
  onToggleBatch?: (nodeId: string) => void
  onSetBatchPrimary?: (nodeId: string) => void
  onTitleChange?: (nodeId: string, title: string) => void
}

// ---- Main Component ----

export const CanvasNodeView = React.memo(function CanvasNodeView({
  data,
  scale,
  isSelected,
  isRelated,
  isFocusRelated = false,
  isConnectionTarget,
  isConnecting,
  editRequestNonce = 0,
  showImageInfo = true,
  resourceLabel,
  onMouseDown,
  onResize,
  onConnectStart,
  onContentChange,
  onContextMenu,
  onDoubleClick,
  onHover,
  onRetry,
  onGenerateImage,
  onClick,
  renderContent,
  batchMotion,
  batchClosing,
  batchOpening: batchOpeningProp,
  batchRecovering: batchRecoveringProp,
  onToggleBatch,
  onSetBatchPrimary,
  onTitleChange
}: CanvasNodeProps) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const [hovered, setHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const isActive = isConnectionTarget || isSelected || isFocusRelated
  const hasImageContent = data.type === 'image' && Boolean(data.metadata?.content)
  const hasVideoContent = data.type === 'video' && Boolean(data.metadata?.content)
  const hasAudioContent = data.type === 'audio' && Boolean(data.metadata?.content)
  const imageBorderColor = isActive ? selectionBlue : isRelated ? theme.node.muted : 'transparent'

  // Batch state
  const isBatchRoot = Boolean(data.metadata?.isBatchRoot)
  const batchCount = isBatchRoot ? (data.metadata?.batchChildIds?.length ?? 0) + 1 : 0
  const batchExpanded = data.metadata?.imageBatchExpanded ?? false
  const batchOpening = data.metadata?.isBatchRoot ? (batchOpeningProp ?? false) : false
  const batchRecovering = data.metadata?.isBatchRoot ? (batchRecoveringProp ?? false) : false
  const isBatchChild = Boolean(data.metadata?.batchRootId)

  // ---- Resize logic ----

  const resizeRef = useRef({
    isResizing: false,
    corner: 'bottom-right' as ResizeCorner,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startWidth: 0,
    startHeight: 0,
    keepRatio: false,
    ratio: 1
  })

  const handleResizeMove = useCallback(
    (event: MouseEvent) => {
      if (!resizeRef.current.isResizing) return
      const dx = (event.clientX - resizeRef.current.startX) / scale
      const dy = (event.clientY - resizeRef.current.startY) / scale
      const minWidth = 220
      const minHeight = 160

      const startRight = resizeRef.current.startLeft + resizeRef.current.startWidth
      const startBottom = resizeRef.current.startTop + resizeRef.current.startHeight
      const fromLeft = resizeRef.current.corner.includes('left')
      const fromTop = resizeRef.current.corner.includes('top')

      const rawWidth = Math.max(minWidth, resizeRef.current.startWidth + (fromLeft ? -dx : dx))
      const rawHeight = Math.max(minHeight, resizeRef.current.startHeight + (fromTop ? -dy : dy))
      let width = rawWidth
      let height = rawHeight
      if (resizeRef.current.keepRatio) {
        const ratio = resizeRef.current.ratio
        if (Math.abs(dx) >= Math.abs(dy)) {
          height = width / ratio
        } else {
          width = height * ratio
        }
        if (height < minHeight) {
          height = minHeight
          width = height * ratio
        }
        if (width < minWidth) {
          width = minWidth
          // eslint-disable-next-line no-useless-assignment -- resizing logic computes bounds but uses raw dimensions
          height = width / ratio
        }
      }

      onResize(data.id, rawWidth, rawHeight, {
        x: fromLeft ? startRight - rawWidth : resizeRef.current.startLeft,
        y: fromTop ? startBottom - rawHeight : resizeRef.current.startTop
      })
    },
    [data.id, onResize, scale]
  )

  const handleResizeUp = useCallback(() => {
    resizeRef.current.isResizing = false
    window.removeEventListener('mousemove', handleResizeMove)
    window.removeEventListener('mouseup', handleResizeUp)
  }, [handleResizeMove])

  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent, corner: ResizeCorner) => {
      event.stopPropagation()
      event.preventDefault()
      resizeRef.current = {
        isResizing: true,
        corner,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: data.position.x,
        startTop: data.position.y,
        startWidth: data.width,
        startHeight: data.height,
        keepRatio: (data.type === 'image' && !data.metadata?.freeResize) || data.type === 'video',
        ratio: (data.metadata?.naturalWidth || data.width) / (data.metadata?.naturalHeight || data.height || 1)
      }
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeUp)
    },
    [data, handleResizeMove, handleResizeUp]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove)
      window.removeEventListener('mouseup', handleResizeUp)
    }
  }, [handleResizeMove, handleResizeUp])

  // ---- Click detection (for opening AI panel) ----
  const clickDownRef = useRef<{ nodeId: string; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!onClick) return
    const handleUp = (e: MouseEvent) => {
      if (!clickDownRef.current) return
      const { nodeId, x, y } = clickDownRef.current
      clickDownRef.current = null
      const dx = e.clientX - x
      const dy = e.clientY - y
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
        onClick(nodeId)
      }
    }
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [onClick])

  // ---- Edit logic ----

  useEffect(() => {
    if (!isEditing) return
    const textarea = textareaRef.current
    textarea?.focus()
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [isEditing])

  // External edit trigger (from toolbar "编辑文字" button)
  useEffect(() => {
    if (!editRequestNonce || data.type !== 'text') return
    setIsEditing(true)
  }, [data.type, editRequestNonce])

  useEffect(() => {
    if (!isTitleEditing) return
    setTitleDraft(data.title || '')
    requestAnimationFrame(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    })
  }, [isTitleEditing, data.title])

  useEffect(() => {
    if (!isEditing) return
    const handleOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (textareaRef.current?.contains(event.target)) return
      setIsEditing(false)
    }
    window.addEventListener('pointerdown', handleOutside, true)
    return () => window.removeEventListener('pointerdown', handleOutside, true)
  }, [isEditing])

  // ---- Render ----

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      data-node-id={data.id}
      className={`node-element absolute flex select-none flex-col transition-shadow duration-200 ${
        isSelected ? 'z-50' : 'z-10'
      }`}
      style={{
        transform: `translate(${data.position.x}px, ${data.position.y}px)`,
        width: data.width,
        height: data.height,
        transition: 'box-shadow 200ms ease',
        contain: 'layout style'
      }}
      onMouseEnter={() => {
        setHovered(true)
        onHover?.(data.id)
      }}
      onMouseLeave={() => {
        setHovered(false)
        onHover?.(null)
      }}
      onContextMenu={(event) => onContextMenu(event, data.id)}
    >
      {/* Node body */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      <div
        className='relative h-full w-full overflow-visible rounded-3xl border-2'
        style={{
          background: hasImageContent || hasVideoContent ? 'transparent' : theme.node.fill,
          borderColor: hasImageContent
            ? imageBorderColor
            : isActive
              ? selectionBlue
              : isRelated && !isBatchChild
                ? theme.node.muted
                : theme.node.stroke,
          boxShadow: isActive
            ? `0 0 0 1px ${selectionBlue}55`
            : isRelated && !isBatchChild
              ? `0 0 0 1px ${theme.node.muted}55, 0 18px 48px rgba(0,0,0,.14)`
              : undefined
        }}
        onMouseDown={(event) => {
          clickDownRef.current = { nodeId: data.id, x: event.clientX, y: event.clientY }
          onMouseDown(event, data.id)
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (data.type === 'text') {
            setIsEditing(true)
          } else {
            onDoubleClick?.(data.id)
          }
        }}
      >
        {/* Node content */}
        <div
          className={`relative flex h-full w-full items-center justify-center rounded-[inherit] ${isBatchRoot ? 'overflow-visible' : 'overflow-hidden'}`}
          style={
            {
              background: hasImageContent || hasVideoContent ? 'transparent' : theme.node.fill,
              '--batch-from-x': `${batchMotion?.x || 0}px`,
              '--batch-from-y': `${batchMotion?.y || 0}px`,
              '--batch-from-rotate': `${6 + (batchMotion?.index || 0) * 4}deg`,
              animation: data.metadata?.batchRootId
                ? batchClosing
                  ? 'canvas-batch-child-out 260ms cubic-bezier(.4,0,.2,1) both'
                  : 'canvas-batch-child-in 340ms cubic-bezier(.2,.85,.18,1) both'
                : undefined,
              animationDelay: data.metadata?.batchRootId
                ? `${batchClosing ? 0 : 45 + (batchMotion?.index || 0) * 24}ms`
                : undefined
            } as React.CSSProperties
          }
        >
          {isBatchRoot ? (
            <BatchFrame
              batchCount={batchCount}
              batchExpanded={batchExpanded}
              batchOpening={batchOpening}
              batchRecovering={batchRecovering}
              onToggleBatch={() => onToggleBatch?.(data.id)}
            >
              {renderContent ? (
                renderContent(data, theme)
              ) : (
                <NodeContent
                  node={data}
                  theme={theme}
                  isEditing={isEditing}
                  textareaRef={textareaRef}
                  onContentChange={onContentChange}
                  onStopEditing={() => setIsEditing(false)}
                  onRetry={onRetry}
                  onGenerateImage={onGenerateImage}
                  onSetBatchPrimary={onSetBatchPrimary}
                />
              )}
            </BatchFrame>
          ) : renderContent ? (
            renderContent(data, theme)
          ) : (
            <NodeContent
              node={data}
              theme={theme}
              isEditing={isEditing}
              textareaRef={textareaRef}
              onContentChange={onContentChange}
              onStopEditing={() => setIsEditing(false)}
              onRetry={onRetry}
              onGenerateImage={onGenerateImage}
              onSetBatchPrimary={onSetBatchPrimary}
            />
          )}
        </div>

        {/* Bottom fade gradient (non-media nodes) */}
        {!hasImageContent && !hasVideoContent && !hasAudioContent && (
          <div
            className='pointer-events-none absolute inset-x-0 bottom-0 h-12'
            style={{ background: `linear-gradient(to top, ${theme.canvas.background}66, transparent)` }}
          />
        )}

        {/* Image info bar */}
        {showImageInfo && hasImageContent && (
          <div className='pointer-events-none absolute bottom-3 right-3 z-40 max-w-[calc(100%-24px)]'>
            <span className='max-w-full truncate rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium leading-none text-white backdrop-blur-sm'>
              {Math.round(data.metadata?.naturalWidth || data.width)} x{' '}
              {Math.round(data.metadata?.naturalHeight || data.height)}
              {data.metadata?.bytes ? ` · ${formatBytes(Number(data.metadata.bytes))}` : ''}
            </span>
          </div>
        )}

        {/* Resource label */}
        {resourceLabel && <ResourceLabelBadge reference={resourceLabel} />}

        {/* Title bar */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
        <div
          className='absolute left-0 right-0 top-0 z-20 flex h-8 items-center px-3'
          style={{
            background: `linear-gradient(to bottom, ${theme.node.fill}ee, transparent)`
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setIsTitleEditing(true)
          }}
        >
          {isTitleEditing ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setIsTitleEditing(false)
                const trimmed = titleDraft.trim()
                if (trimmed && trimmed !== data.title) {
                  onTitleChange?.(data.id, trimmed)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsTitleEditing(false)
                  const trimmed = titleDraft.trim()
                  if (trimmed && trimmed !== data.title) {
                    onTitleChange?.(data.id, trimmed)
                  }
                } else if (e.key === 'Escape') {
                  setIsTitleEditing(false)
                }
                e.stopPropagation()
              }}
              className='w-full bg-transparent text-[11px] font-medium outline-none'
              style={{ color: theme.node.label }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className='truncate text-[11px] font-medium cursor-text'
              style={{ color: theme.node.label }}
              title={t('canvas.nodeContent.doubleClickToEdit')}
            >
              {data.title || t(`canvas.nodeTypes.${data.type}`)}
            </span>
          )}
        </div>

        {/* Resize handles */}
        <ResizeHandle corner='top-left' onMouseDown={handleResizeMouseDown} />
        <ResizeHandle corner='top-right' onMouseDown={handleResizeMouseDown} />
        <ResizeHandle corner='bottom-left' onMouseDown={handleResizeMouseDown} />
        <ResizeHandle corner='bottom-right' onMouseDown={handleResizeMouseDown} />
      </div>

      {/* Connection handles */}
      <ConnectionHandleDot
        side='left'
        visible={hovered || isSelected || isConnecting}
        onMouseDown={(event) => onConnectStart(event, data.id, 'target')}
        theme={theme}
      />
      {data.type !== 'config' && (
        <ConnectionHandleDot
          side='right'
          visible={hovered || isSelected || isConnecting}
          onMouseDown={(event) => onConnectStart(event, data.id, 'source')}
          theme={theme}
        />
      )}
    </div>
  )
})

// ---- Node Content Renderer ----

interface NodeContentProps {
  node: CanvasNode
  theme: CanvasTheme
  isEditing: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onContentChange?: (nodeId: string, content: string) => void
  onStopEditing: () => void
  onRetry?: (nodeId: string) => void
  onGenerateImage?: (nodeId: string) => void
  onSetBatchPrimary?: (nodeId: string) => void
}

function NodeContent({
  node,
  theme,
  isEditing,
  textareaRef,
  onContentChange,
  onStopEditing,
  onRetry,
  onSetBatchPrimary
}: NodeContentProps) {
  const { t } = useTranslation()
  const status = node.metadata?.status

  if (status === 'loading' || status === 'queued' || status === 'running') {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-3'
        style={{ color: theme.node.activeStroke }}
      >
        <div
          className='size-10 animate-spin rounded-full border-2'
          style={{ borderColor: theme.node.stroke, borderTopColor: theme.node.activeStroke }}
        />
        <span className='text-[10px] tracking-[0.2em]'>{t('canvas.nodeContent.generating')}</span>
      </div>
    )
  }

  if (status === 'error') {
    const errorMsg = node.metadata?.errorDetails || t('canvas.nodeContent.generationFailed')
    return (
      <div className='flex max-w-[260px] flex-col items-center gap-3 px-5 text-center'>
        <span className='text-xs leading-5 text-red-300'>{errorMsg}</span>
        <button
          type='button'
          className='inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:scale-[1.02]'
          style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRetry?.(node.id)
          }}
        >
          <RefreshCw className='size-3.5' />
          {t('canvas.toolbarDetail.retry')}
        </button>
      </div>
    )
  }

  switch (node.type) {
    case 'image':
      return <ImageContent node={node} theme={theme} onSetBatchPrimary={onSetBatchPrimary} />
    case 'text':
      return (
        <TextContent
          node={node}
          theme={theme}
          isEditing={isEditing}
          textareaRef={textareaRef}
          onContentChange={onContentChange}
          onStopEditing={onStopEditing}
        />
      )
    case 'config':
      return <ConfigPlaceholder theme={theme} />
    case 'video':
      return <VideoContent node={node} theme={theme} />
    case 'audio':
      return <AudioContent node={node} theme={theme} />
    default:
      return <DefaultPlaceholder node={node} theme={theme} />
  }
}

function ImageContent({
  node,
  theme,
  onSetBatchPrimary
}: {
  node: CanvasNode
  theme: CanvasTheme
  onSetBatchPrimary?: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const freeResize = node.metadata?.freeResize ?? false
  const isBatchRoot = Boolean(node.metadata?.isBatchRoot) && (node.metadata?.batchChildIds?.length ?? 0) > 0
  const batchCount = isBatchRoot ? (node.metadata?.batchChildIds?.length ?? 0) + 1 : 0
  const batchExpanded = node.metadata?.imageBatchExpanded ?? false
  const isBatchChild = Boolean(node.metadata?.batchRootId)

  if (!node.metadata?.content) {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-3'
        style={{ color: theme.node.placeholder }}
      >
        <div
          className='flex size-14 items-center justify-center rounded-2xl'
          style={{ background: theme.toolbar.activeBg }}
        >
          <ImageIcon className='size-6 opacity-30' />
        </div>
        <span className='text-[10px] tracking-[0.18em] opacity-50'>{t('canvas.nodeContent.emptyImage')}</span>
      </div>
    )
  }
  return (
    <div className='h-full w-full overflow-hidden rounded-3xl'>
      <img
        src={node.metadata.content}
        alt={node.title}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className={`pointer-events-none block h-full w-full select-none ${freeResize ? 'object-fill' : 'object-contain'}`}
      />
      {/* Batch count badge (root) */}
      {isBatchRoot && (
        <button
          type='button'
          className='absolute right-2.5 top-2.5 z-30 flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold backdrop-blur-md transition hover:scale-[1.02]'
          style={{
            background: `${theme.toolbar.panel}d9`,
            borderColor: `${theme.toolbar.border}cc`,
            boxShadow: '0 6px 18px rgba(15,23,42,.10)'
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className='leading-none' style={{ color: '#2f80ff' }}>
            {batchCount}
          </span>
          <ChevronRight className={`size-3.5 opacity-55 transition-transform ${batchExpanded ? 'rotate-90' : ''}`} />
        </button>
      )}
      {/* Set as primary button (batch child) */}
      {isBatchChild && onSetBatchPrimary && (
        <button
          type='button'
          className='absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium opacity-0 backdrop-blur-md transition group-hover/batch:opacity-100 hover:scale-[1.02]'
          style={{
            boxShadow: '0 8px 20px rgba(68,64,60,.13)'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSetBatchPrimary(node.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Star className='size-3.5' style={{ color: '#2f80ff' }} /> {t('canvas.nodeContent.setAsPrimary')}
        </button>
      )}
    </div>
  )
}

function TextContent({
  node,
  theme,
  isEditing,
  textareaRef,
  onContentChange,
  onStopEditing,
  onGenerateImage
}: NodeContentProps) {
  const fontSize = node.metadata?.fontSize || 14
  const { t } = useTranslation()
  const textStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: `${Math.round(fontSize * 1.65)}px`,
    color: theme.node.text,
    boxSizing: 'border-box'
  }

  return (
    <div className='flex h-full w-full flex-col overflow-hidden pt-8'>
      {onGenerateImage && (
        <button
          type='button'
          className='absolute right-3 top-3 z-20 inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium opacity-85 backdrop-blur-md transition hover:scale-[1.02] hover:opacity-100'
          style={{ background: `${theme.toolbar.panel}dd`, borderColor: theme.node.stroke, color: theme.node.text }}
          onClick={(e) => {
            e.stopPropagation()
            onGenerateImage(node.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title={t('canvas.nodeContent.textToImage')}
          aria-label={t('canvas.nodeContent.textToImage')}
        >
          <ImageIcon className='size-3.5' />
          {t('canvas.nodeContent.generateImage')}
        </button>
      )}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className='thin-scrollbar block h-full w-full resize-none overflow-y-auto whitespace-pre-wrap break-words border-none bg-transparent px-4 pb-4 font-mono outline-none'
          style={textStyle}
          value={node.metadata?.content || ''}
          onChange={(e) => onContentChange?.(node.id, e.target.value)}
          onBlur={onStopEditing}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onStopEditing()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className='thin-scrollbar block h-full w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-4 pb-4 font-mono'
          style={textStyle}
        >
          {node.metadata?.content || (
            <span style={{ color: theme.node.placeholder }}>{t('canvas.nodeContent.doubleClickToEdit')}</span>
          )}
        </div>
      )}
    </div>
  )
}

function ConfigPlaceholder({ theme }: { theme: CanvasTheme }) {
  const { t } = useTranslation()
  return (
    <div
      className='flex h-full w-full flex-col items-center justify-center gap-3 pt-8'
      style={{ color: theme.node.placeholder }}
    >
      <div
        className='flex size-14 items-center justify-center rounded-2xl'
        style={{ background: theme.toolbar.activeBg }}
      >
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
        <svg className='size-6 opacity-30' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
          <path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' />
        </svg>
      </div>
      <span className='text-[10px] tracking-[0.18em] opacity-50'>{t('canvas.nodeContent.generationConfig')}</span>
    </div>
  )
}

function VideoContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  if (!node.metadata?.content) {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-3'
        style={{ color: theme.node.placeholder }}
      >
        <Video className='size-7 opacity-35' />
        <span className='text-sm'>{t('canvas.nodeContent.emptyVideo')}</span>
      </div>
    )
  }
  return (
    <video
      src={node.metadata.content}
      controls
      className='h-full w-full rounded-[18px] bg-black object-contain'
      data-canvas-no-zoom
    >
      <track kind='captions' label='English' />
    </video>
  )
}

function AudioContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  if (!node.metadata?.content) {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-2'
        style={{ color: theme.node.placeholder }}
      >
        <Music2 className='size-7 opacity-35' />
        <span className='text-sm'>{t('canvas.nodeContent.emptyAudio')}</span>
      </div>
    )
  }
  return (
    <div
      className='flex h-full w-full flex-col justify-center gap-3 px-4'
      style={{ background: theme.node.fill, color: theme.node.text }}
    >
      <div className='flex min-w-0 items-center gap-2 text-sm opacity-70'>
        <Music2 className='size-4 shrink-0' />
        <span className='truncate'>{node.title || t('canvas.nodeContent.audio')}</span>
      </div>
      <audio src={node.metadata.content} controls className='w-full' data-canvas-no-zoom>
        <track kind='captions' label='English' />
      </audio>
    </div>
  )
}

function DefaultPlaceholder({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  return (
    <div
      className='flex h-full w-full flex-col items-center justify-center gap-2 pt-8'
      style={{ color: theme.node.placeholder }}
    >
      <span className='text-sm'>{node.type}</span>
    </div>
  )
}

// ---- Sub-components ----

function ResizeHandle({
  corner,
  onMouseDown
}: {
  corner: ResizeCorner
  onMouseDown: (event: React.MouseEvent, corner: ResizeCorner) => void
}) {
  const positionClass = {
    'top-left': '-left-[14px] -top-[14px] cursor-nwse-resize',
    'top-right': '-right-[14px] -top-[14px] cursor-nesw-resize',
    'bottom-left': '-bottom-[14px] -left-[14px] cursor-nesw-resize',
    'bottom-right': '-bottom-[14px] -right-[14px] cursor-nwse-resize'
  }[corner]

  // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
  return <div className={`absolute z-50 size-7 ${positionClass}`} onMouseDown={(event) => onMouseDown(event, corner)} />
}

function ConnectionHandleDot({
  side,
  visible,
  onMouseDown,
  theme
}: {
  side: 'left' | 'right'
  visible: boolean
  onMouseDown: (event: React.MouseEvent) => void
  theme: CanvasTheme
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className={`absolute top-1/2 z-30 flex size-12 -translate-y-1/2 cursor-crosshair items-center justify-center transition-opacity duration-150 ${
        side === 'left' ? '-left-6' : '-right-6'
      } ${visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      onMouseDown={onMouseDown}
    >
      <div
        className='size-3 rounded-full border-2 transition-all hover:scale-125'
        style={{ background: theme.node.panel, borderColor: theme.node.muted }}
      />
    </div>
  )
}

// ---- ResourceLabelBadge ----

interface CanvasResourceReference {
  label: string
  active?: boolean
}

function ResourceLabelBadge({ reference }: { reference: CanvasResourceReference }) {
  return (
    <span
      className={`pointer-events-none absolute right-2 top-2 z-30 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        reference.active ? 'bg-[#2f80ff] text-white shadow-sm' : 'bg-black/35 text-white/75'
      }`}
    >
      {reference.label}
    </span>
  )
}

// ---- BatchFrame ----

function BatchFrame({
  batchCount,
  batchExpanded,
  batchOpening,
  batchRecovering,
  onToggleBatch,
  children
}: {
  batchCount: number
  batchExpanded: boolean
  batchOpening: boolean
  batchRecovering: boolean
  onToggleBatch?: () => void
  children: React.ReactNode
}) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const isBatchRoot = batchCount > 1

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className='group/batch relative h-full w-full overflow-visible'
      onDoubleClick={
        isBatchRoot
          ? (event) => {
              event.stopPropagation()
              onToggleBatch?.()
            }
          : undefined
      }
    >
      {isBatchRoot && (
        <div className='pointer-events-none absolute inset-0 overflow-visible'>
          {Array.from({ length: Math.min(batchCount - 1, 5) }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
              key={index}
              className='absolute rounded-[inherit] border shadow-[0_14px_34px_rgba(68,64,60,.16)] transition-all duration-300 group-hover/batch:translate-x-2'
              style={{
                inset: 0,
                background: `linear-gradient(135deg, ${theme.node.panel}, ${theme.node.fill})`,
                borderColor: theme.node.stroke,
                opacity: batchExpanded && !batchOpening ? 0.34 : 1,
                transform:
                  batchOpening || batchRecovering
                    ? `translate(${54 + index * 22}px, ${20 + index * 12}px) rotate(${8 + index * 5}deg) scale(.98)`
                    : `translate(${34 + index * 18}px, ${14 + index * 10}px) rotate(${6 + index * 4}deg)`,
                zIndex: -index - 1
              }}
            />
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
