/**
 * AudioNode - 音频节点
 * 音频播放
 */

import { Music2 } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface AudioNodeShellProps {
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
}

export function AudioNode(props: AudioNodeShellProps) {
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
      renderContent={(node, theme) => <AudioContent node={node} theme={theme} />}
    />
  )
}

function AudioContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const content = node.metadata?.content

  if (!content) {
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
      <audio src={content} controls className='w-full' data-canvas-no-zoom>
        <track kind='captions' label='English' />
      </audio>
    </div>
  )
}
