/**
 * ImageNode - 图片节点
 * 支持图片显示、freeResize、批次UI、下载、全屏
 */

import { ChevronRight, Download, Image as ImageIcon, Maximize2, Star } from 'lucide-react'
import type React from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

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

interface ImageNodeProps {
  node: CanvasNode
  scale: number
  isSelected: boolean
  isRelated: boolean
  isConnectionTarget: boolean
  isConnecting: boolean
  onMouseDown: (event: React.MouseEvent, nodeId: string) => void
  onResize: (nodeId: string, width: number, height: number, position?: Position) => void
  onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void
  onToggleBatch?: (nodeId: string) => void
  onSetBatchPrimary?: (node: CanvasNode) => void
}

export function ImageNode({
  node,
  scale,
  isSelected,
  isRelated,
  isConnectionTarget,
  isConnecting,
  onMouseDown,
  onResize,
  onConnectStart,
  onContextMenu,
  onToggleBatch,
  onSetBatchPrimary
}: ImageNodeProps) {
  const { t } = useTranslation()
  const renderContent = useCallback(
    (n: CanvasNode, theme: CanvasTheme) => {
      const content = n.metadata?.content
      const naturalW = n.metadata?.naturalWidth
      const naturalH = n.metadata?.naturalHeight
      const freeResize = n.metadata?.freeResize ?? false
      const isBatchRoot = Boolean(n.metadata?.isBatchRoot)
      const batchCount = isBatchRoot ? (n.metadata?.batchChildIds?.length ?? 0) + 1 : 0
      const batchExpanded = n.metadata?.imageBatchExpanded ?? false
      const isBatchChild = Boolean(n.metadata?.batchRootId)

      if (!content) {
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
            <span className='text-[10px] tracking-[0.18em] opacity-50'>{t('canvas.nodeContent.dropImageOrPaste')}</span>
          </div>
        )
      }

      return (
        <>
          {/* Image */}
          <div className='h-full w-full overflow-hidden rounded-3xl'>
            <img
              src={content}
              alt={n.title}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`pointer-events-none block h-full w-full select-none ${freeResize ? 'object-fill' : 'object-contain'}`}
            />
          </div>

          {/* Quick actions overlays */}
          <div className='absolute right-3 top-3 z-30 flex gap-1 opacity-0 transition-opacity group-hover/batch:opacity-100'>
            <button
              type='button'
              className='flex size-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70'
              title={t('canvas.nodeContent.viewFullscreen')}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Maximize2 className='size-3.5' />
            </button>
            <button
              type='button'
              className='flex size-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70'
              title={t('canvas.toolbarDetail.download')}
              onClick={(e) => {
                e.stopPropagation()
                if (!content) return
                const a = document.createElement('a')
                a.href = content
                a.download = n.title || 'image.png'
                a.click()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Download className='size-3.5' />
            </button>
          </div>

          {/* Size info bar */}
          {(naturalW || naturalH) && (
            <div className='pointer-events-none absolute bottom-3 right-3 z-40 max-w-[calc(100%-24px)]'>
              <span className='max-w-full truncate rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium leading-none text-white backdrop-blur-sm'>
                {naturalW ? Math.round(naturalW) : ''}
                {naturalW && naturalH ? ' × ' : ''}
                {naturalH ? Math.round(naturalH) : ''}
                {n.metadata?.bytes ? ` · ${formatBytes(Number(n.metadata.bytes))}` : ''}
              </span>
            </div>
          )}

          {/* Batch count badge (root node) — pill style matching reference */}
          {isBatchRoot && (
            <button
              type='button'
              className='absolute right-2.5 top-2.5 z-30 flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold shadow-sm backdrop-blur-md transition hover:scale-[1.02]'
              style={{
                background: `${theme.toolbar.panel}d9`,
                borderColor: `${theme.toolbar.border}cc`,
                color: theme.node.text,
                boxShadow: '0 6px 18px rgba(15,23,42,.10)'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onToggleBatch?.(n.id)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className='leading-none' style={{ color: '#2f80ff' }}>
                {batchCount}
              </span>
              <ChevronRight
                className={`size-3.5 opacity-55 transition-transform ${batchExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}

          {/* "Set as primary" button (child node) */}
          {isBatchChild && (
            <button
              type='button'
              className='absolute right-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium shadow-md backdrop-blur-md opacity-0 transition group-hover/batch:opacity-100 hover:scale-[1.02]'
              style={{
                background: theme.toolbar.panel,
                borderColor: theme.toolbar.border,
                color: theme.node.text,
                boxShadow: '0 8px 20px rgba(68,64,60,.13)'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSetBatchPrimary?.(n)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Star className='size-3.5' style={{ color: '#2f80ff' }} />
              {t('canvas.nodeContent.setAsPrimary')}
            </button>
          )}
        </>
      )
    },
    [onToggleBatch, onSetBatchPrimary, t]
  )

  return (
    <CanvasNodeView
      data={node}
      scale={scale}
      isSelected={isSelected}
      isRelated={isRelated}
      isConnectionTarget={isConnectionTarget}
      isConnecting={isConnecting}
      onMouseDown={onMouseDown}
      onResize={onResize}
      onConnectStart={onConnectStart}
      onContextMenu={onContextMenu}
      renderContent={renderContent}
      onToggleBatch={onToggleBatch}
    />
  )
}
