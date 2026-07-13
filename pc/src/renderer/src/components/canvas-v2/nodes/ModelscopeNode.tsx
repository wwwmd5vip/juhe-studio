/**
 * ModelscopeNode - ModelScope 模型节点
 * 模型参数配置与执行
 */

import { FlaskConical } from 'lucide-react'
import type React from 'react'
import { useCallback, useState } from 'react'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface ModelscopeNodeProps {
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

export function ModelscopeNode(props: ModelscopeNodeProps) {
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
      renderContent={(node, theme) => <ModelscopeContent node={node} theme={theme} onUpdate={props.onUpdate} />}
    />
  )
}

function ModelscopeContent({
  node,
  theme,
  onUpdate
}: {
  node: CanvasNode
  theme: CanvasTheme
  onUpdate?: (nodeId: string, metadata: Record<string, unknown>) => void
}) {
  const [genWidth, setGenWidth] = useState(512)
  const [genHeight, setGenHeight] = useState(512)
  const loraEnabled = node.metadata?.loraEnabled || false
  const modelId = node.metadata?.modelId || ''

  const update = useCallback(
    (patch: Record<string, unknown>) => {
      onUpdate?.(node.id, patch)
    },
    [node.id, onUpdate]
  )

  return (
    <div className='flex h-full w-full flex-col gap-2 overflow-hidden p-3 pt-10'>
      {/* Model selection */}
      <input
        type='text'
        className='rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none'
        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
        placeholder='ModelScope 模型 ID'
        value={modelId}
        onChange={(e) => update({ modelId: e.target.value })}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Dimensions */}
      <div className='flex items-center gap-2 text-[11px]' style={{ color: theme.node.muted }}>
        <input
          type='number'
          className='w-16 rounded border bg-transparent px-2 py-1 text-xs outline-none'
          style={{ borderColor: theme.node.stroke, color: theme.node.text }}
          value={genWidth}
          onChange={(e) => setGenWidth(Number(e.target.value))}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <span>×</span>
        <input
          type='number'
          className='w-16 rounded border bg-transparent px-2 py-1 text-xs outline-none'
          style={{ borderColor: theme.node.stroke, color: theme.node.text }}
          value={genHeight}
          onChange={(e) => setGenHeight(Number(e.target.value))}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* LoRA toggle */}
      <label className='flex items-center gap-2 text-[11px] cursor-pointer' style={{ color: theme.node.muted }}>
        <input
          type='checkbox'
          className='size-3.5 rounded'
          checked={loraEnabled}
          onChange={(e) => update({ loraEnabled: e.target.checked })}
        />
        LoRA
      </label>

      {/* Placeholder */}
      <div className='flex-1 flex items-center justify-center'>
        <div className='flex flex-col items-center gap-2' style={{ color: theme.node.placeholder }}>
          <FlaskConical className='size-8 opacity-30' />
          <span className='text-xs'>ModelScope</span>
        </div>
      </div>
    </div>
  )
}
