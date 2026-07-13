/**
 * VideoNode - 视频节点
 * 视频播放、参数配置
 */

import { Video } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface VideoNodeShellProps {
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

export function VideoNode(props: VideoNodeShellProps) {
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
      renderContent={(node, theme) => <VideoContent node={node} theme={theme} />}
    />
  )
}

function VideoContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const content = node.metadata?.content

  if (!content) {
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
      src={content}
      controls
      className='h-full w-full rounded-[18px] bg-black object-contain'
      data-canvas-no-zoom
    >
      <track kind='captions' label='English' />
    </video>
  )
}
