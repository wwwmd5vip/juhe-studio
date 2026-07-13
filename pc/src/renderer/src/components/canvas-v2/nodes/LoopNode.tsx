/**
 * LoopNode - 循环迭代节点
 * 循环次数、模式 (顺序/并行)、模板变量 {{index}}/{{total}}
 */

import type React from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface LoopNodeProps {
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
  onUpdate?: (nodeId: string, metadata: Record<string, unknown>) => void
}

export function LoopNode(props: LoopNodeProps) {
  return (
    <CanvasNodeView
      data={props.node}
      scale={props.scale}
      isSelected={props.isSelected}
      isRelated={props.isRelated}
      isConnectionTarget={props.isConnectionTarget}
      isConnecting={props.isConnecting}
      onMouseDown={props.onMouseDown}
      onResize={props.onResize}
      onConnectStart={props.onConnectStart}
      onContextMenu={props.onContextMenu}
      renderContent={(node, theme) => <LoopContent node={node} theme={theme} onUpdate={props.onUpdate} />}
    />
  )
}

function LoopContent({
  node,
  theme,
  onUpdate
}: {
  node: CanvasNode
  theme: CanvasTheme
  onUpdate?: (nodeId: string, metadata: Record<string, unknown>) => void
}) {
  const { t } = useTranslation()
  const count = node.metadata?.count || 1
  const mode = node.metadata?.mode || 'sequential'
  const prompt = node.metadata?.prompt || ''
  const results = node.metadata?.results || []
  const imageResults = node.metadata?.imageResults || []

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onUpdate?.(node.id, patch)
    },
    [node.id, onUpdate]
  )

  return (
    <div className='flex h-full w-full flex-col gap-2 overflow-hidden p-3 pt-10'>
      {/* 模式切换 */}
      <div className='flex items-center gap-2'>
        <div className='flex rounded-md border overflow-hidden text-[10px]' style={{ borderColor: theme.node.stroke }}>
          <button
            type='button'
            className='px-2.5 py-1 transition-colors'
            style={{
              background: mode === 'sequential' ? theme.toolbar.activeBg : 'transparent',
              color: theme.node.text
            }}
            onClick={() => update({ mode: 'sequential' })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {t('canvas.node.sequential')}
          </button>
          <button
            type='button'
            className='px-2.5 py-1 transition-colors'
            style={{
              background: mode === 'parallel' ? theme.toolbar.activeBg : 'transparent',
              color: theme.node.text,
              borderLeft: `1px solid ${theme.node.stroke}`
            }}
            onClick={() => update({ mode: 'parallel' })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {t('canvas.node.parallel')}
          </button>
        </div>
        <div className='flex items-center gap-1 text-[11px]' style={{ color: theme.node.muted }}>
          <button
            type='button'
            className='flex size-5 items-center justify-center rounded border text-xs'
            style={{ borderColor: theme.node.stroke }}
            onClick={() => update({ count: Math.max(1, count - 1) })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            −
          </button>
          <span className='w-5 text-center tabular-nums'>{count}</span>
          <button
            type='button'
            className='flex size-5 items-center justify-center rounded border text-xs'
            style={{ borderColor: theme.node.stroke }}
            onClick={() => update({ count: Math.min(99, count + 1) })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            +
          </button>
        </div>
      </div>

      {/* Prompt template */}
      <textarea
        className='min-h-0 flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-xs outline-none'
        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
        placeholder={t('canvas.loop.promptPlaceholder')}
        value={prompt}
        onChange={(e) => update({ prompt: e.target.value })}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {/* 结果 */}
      {results.length > 0 && (
        <div className='text-[10px]' style={{ color: theme.node.muted }}>
          {t('canvas.loop.textResults', { count: results.length })}
        </div>
      )}
      {imageResults.length > 0 && (
        <div className='text-[10px]' style={{ color: theme.node.muted }}>
          {t('canvas.loop.imageResults', { count: imageResults.length })}
        </div>
      )}
    </div>
  )
}
