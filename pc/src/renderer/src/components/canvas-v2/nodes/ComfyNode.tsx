/**
 * ComfyNode - ComfyUI 工作流节点
 * 工作流执行与参数配置
 */

import { Cpu } from 'lucide-react'
import type React from 'react'
import { useCallback } from 'react'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface ComfyNodeProps {
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

export function ComfyNode(props: ComfyNodeProps) {
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
      renderContent={(node, theme) => <ComfyContent node={node} theme={theme} onUpdate={props.onUpdate} />}
    />
  )
}

function ComfyContent({
  node,
  theme,
  onUpdate
}: {
  node: CanvasNode
  theme: CanvasTheme
  onUpdate?: (nodeId: string, metadata: Record<string, unknown>) => void
}) {
  const seed = node.metadata?.seed ?? -1
  const workflowId = node.metadata?.workflowId || ''
  const params = node.metadata?.params || {}

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onUpdate?.(node.id, patch)
    },
    [node.id, onUpdate]
  )

  return (
    <div className='flex h-full w-full flex-col gap-2 overflow-hidden p-3 pt-10'>
      {/* Workflow ID */}
      <div className='flex items-center gap-2'>
        <input
          type='text'
          className='min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none'
          style={{ borderColor: theme.node.stroke, color: theme.node.text }}
          placeholder='Workflow ID'
          value={workflowId}
          onChange={(e) => update({ workflowId: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Seed */}
      <div className='flex items-center gap-2'>
        <span className='text-[11px]' style={{ color: theme.node.muted }}>
          Seed
        </span>
        <input
          type='number'
          className='min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none'
          style={{ borderColor: theme.node.stroke, color: theme.node.text }}
          value={seed}
          onChange={(e) => update({ seed: Number(e.target.value) })}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Info */}
      <div className='flex-1 flex items-center justify-center'>
        <div className='flex flex-col items-center gap-2' style={{ color: theme.node.placeholder }}>
          <Cpu className='size-8 opacity-30' />
          <span className='text-xs'>ComfyUI 工作流</span>
          {Object.keys(params).length > 0 && (
            <span className='text-[10px] opacity-50'>{Object.keys(params).length} 个参数</span>
          )}
        </div>
      </div>
    </div>
  )
}
