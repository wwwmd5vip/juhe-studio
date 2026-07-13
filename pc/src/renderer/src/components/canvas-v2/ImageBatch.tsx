/**
 * ImageBatch - 图片批处理系统
 * Stacked card effect, expand/collapse, set as primary
 */

import { ChevronRight, Star } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasNode } from './types'

// ---- Props ----

interface ImageBatchFrameProps {
  node: CanvasNode
  scale: number
  batchCount: number
  batchExpanded: boolean
  batchOpening?: boolean
  batchClosing?: boolean
  onToggleBatch?: (nodeId: string) => void
  onSetPrimary?: (nodeId: string) => void
  children: React.ReactNode
}

/** 包裹根节点和子节点的批处理框架 */
export function ImageBatchFrame({
  node,
  batchCount,
  batchExpanded,
  onToggleBatch,
  onSetPrimary,
  children
}: ImageBatchFrameProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const { t } = useTranslation()
  const theme = canvasThemes[themeResolved]
  const isRoot = batchCount > 1

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className={`group/batch relative h-full w-full overflow-visible ${isRoot ? 'cursor-pointer' : ''}`}
      onDoubleClick={
        isRoot
          ? (event) => {
              event.stopPropagation()
              onToggleBatch?.(node.id)
            }
          : undefined
      }
    >
      {/* Stacked cards behind root */}
      {isRoot ? (
        <div className='pointer-events-none absolute inset-0 overflow-visible'>
          {Array.from({ length: Math.min(batchCount - 1, 5) }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
              key={index}
              className='absolute rounded-[inherit] border opacity-0 group-hover/batch:opacity-100 transition-all duration-300 group-hover/batch:translate-x-2'
              style={{
                inset: 0,
                background: `linear-gradient(135deg, ${theme.node.panel}, ${theme.node.fill})`,
                borderColor: theme.node.stroke,
                transform: batchExpanded
                  ? `translate(${34 + index * 18}px, ${14 + index * 10}px) rotate(${6 + index * 4}deg)`
                  : `translate(${34 + index * 18}px, ${14 + index * 10}px) rotate(${6 + index * 4}deg)`,
                zIndex: -index - 1
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Content */}
      {children}

      {/* Batch count badge (root) */}
      {isRoot ? (
        <button
          type='button'
          className='absolute right-2.5 top-2.5 z-30 flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold shadow-lg backdrop-blur-md transition hover:scale-[1.02]'
          style={{
            background: `${theme.toolbar.panel}d9`,
            borderColor: `${theme.toolbar.border}cc`,
            color: theme.node.text
          }}
          onClick={(event) => {
            event.stopPropagation()
            onToggleBatch?.(node.id)
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={batchExpanded ? t('canvas.nodeContent.collapseBatch') : t('canvas.nodeContent.expandBatch')}
        >
          <span className='leading-none text-[#2f80ff]'>{batchCount}</span>
          <ChevronRight className={`size-3.5 opacity-55 transition-transform ${batchExpanded ? 'rotate-90' : ''}`} />
        </button>
      ) : null}

      {/* Set as primary (child) */}
      {node.metadata?.batchRootId && onSetPrimary ? (
        <button
          type='button'
          className='absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium opacity-0 group-hover/batch:opacity-100 transition-opacity hover:scale-[1.02]'
          style={{
            background: theme.toolbar.panel,
            borderColor: theme.toolbar.border,
            color: theme.node.text
          }}
          onClick={(event) => {
            event.stopPropagation()
            onSetPrimary(node.id)
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Star className='size-3.5 text-[#2f80ff]' />
          {t('canvas.nodeContent.setAsPrimary')}
        </button>
      ) : null}
    </div>
  )
}

// ---- Batch helpers ----

/** 获取节点的批量信息 */
export function getBatchInfo(
  node: CanvasNode,
  allNodes: CanvasNode[]
): {
  isRoot: boolean
  isChild: boolean
  count: number
  rootId: string | null
  children: CanvasNode[]
  expanded: boolean
} {
  const isRoot = node.metadata?.isBatchRoot === true
  const batchRootId = node.metadata?.batchRootId || null
  const isChild = !!batchRootId
  const expanded = node.metadata?.imageBatchExpanded !== false

  if (isRoot) {
    const childIds = node.metadata?.batchChildIds || []
    const children = allNodes.filter((n) => childIds.includes(n.id))
    return {
      isRoot: true,
      isChild: false,
      count: Math.max(1, children.length + 1),
      rootId: node.id,
      children,
      expanded
    }
  }

  if (isChild && batchRootId) {
    const root = allNodes.find((n) => n.id === batchRootId)
    const childIds = root?.metadata?.batchChildIds || []
    return {
      isRoot: false,
      isChild: true,
      count: childIds.length + 1,
      rootId: batchRootId,
      children: [],
      expanded: root?.metadata?.imageBatchExpanded !== false
    }
  }

  return { isRoot: false, isChild: false, count: 1, rootId: null, children: [], expanded: true }
}

/** 展开批处理：设置子节点位置 */
export function expandBatchPositions(root: CanvasNode, children: CanvasNode[]): CanvasNode[] {
  const cols = Math.ceil(Math.sqrt(children.length))
  const gap = 24

  return children.map((child, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    return {
      ...child,
      position: {
        x: root.position.x + root.width + gap + col * (child.width + gap),
        y: root.position.y + row * (child.height + gap)
      }
    }
  })
}

/** 收起批处理：设置子节点位置（堆叠在根节点上） */
export function collapseBatchPositions(root: CanvasNode, children: CanvasNode[]): CanvasNode[] {
  return children.map((child) => ({
    ...child,
    position: { ...root.position }
  }))
}
