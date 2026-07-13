/**
 * render-content.ts - 节点类型 → 内容渲染器映射
 * 用于 CanvasWorkspace 中 renderContent prop 的类型分发
 */
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { SafeImage } from '@/components/common/SafeImage'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode } from '../types'

function ImageContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const content = node.metadata?.content as string | undefined
  const status = node.metadata?.status as string | undefined
  const freeResize = (node.metadata?.freeResize as boolean) ?? false

  if (status === 'streaming' || status === 'loading' || status === 'queued') {
    return (
      <div className='flex items-center justify-center h-full' style={{ color: theme.node.muted }}>
        <div className='flex flex-col items-center gap-2'>
          <div
            className='w-6 h-6 border-2 border-t-transparent rounded-full animate-spin'
            style={{ borderColor: '#2f80ff' }}
          />
          <span className='text-[10px]'>
            {status === 'streaming' || status === 'loading'
              ? t('canvas.nodeContent.generating')
              : t('canvas.nodeContent.queued')}
          </span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className='flex items-center justify-center h-full text-red-400 text-xs p-2'>
        {node.metadata?.errorDetails || t('canvas.nodeContent.generationFailed')}
      </div>
    )
  }

  if (content) {
    if (
      content.startsWith('data:') ||
      content.startsWith('blob:') ||
      content.startsWith('file://') ||
      content.startsWith('juhe-image://') ||
      content.startsWith('http')
    ) {
      return (
        <img
          src={content}
          alt={node.title}
          className={`w-full h-full rounded-b-md ${freeResize ? 'object-fill' : 'object-contain'}`}
          draggable={false}
        />
      )
    }
    return (
      <div
        className='p-3 text-[11px] whitespace-pre-wrap break-words leading-relaxed'
        style={{ color: theme.node.text }}
      >
        {content}
      </div>
    )
  }

  return (
    <div className='flex items-center justify-center h-full text-xs' style={{ color: theme.node.muted }}>
      {t('canvas.nodeContent.emptyImage')}
    </div>
  )
}

function TextContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const content = node.metadata?.content as string | undefined
  return (
    <div
      className='p-3 text-xs whitespace-pre-wrap break-words leading-relaxed min-h-[60px]'
      style={{ color: theme.node.text }}
    >
      {content || t('canvas.nodeContent.doubleClickToEdit')}
    </div>
  )
}

function ConfigContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const prompt = (node.metadata?.prompt as string) || (node.metadata?.content as string) || ''
  const size = node.metadata?.size as string | undefined
  const count = node.metadata?.count as number | undefined
  const status = node.metadata?.status as string | undefined

  return (
    <div className='p-3 space-y-2'>
      {/* Status indicator */}
      {status && (
        <div className='flex items-center gap-1.5'>
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'success'
                ? 'bg-green-400'
                : status === 'error'
                  ? 'bg-red-400'
                  : status === 'loading' || status === 'streaming'
                    ? 'bg-blue-400 animate-pulse'
                    : ''
            }`}
          />
          <span
            className='text-[10px]'
            style={{
              color:
                status === 'success'
                  ? '#10b981'
                  : status === 'error'
                    ? '#ef4444'
                    : status === 'loading'
                      ? '#2f80ff'
                      : theme.node.muted
            }}
          >
            {status === 'loading'
              ? t('canvas.nodeContent.generating')
              : status === 'success'
                ? t('canvas.nodeContent.completed')
                : status === 'error'
                  ? node.metadata?.errorDetails || t('canvas.nodeContent.generationFailed')
                  : status}
          </span>
        </div>
      )}
      {prompt && (
        <div className='text-[11px] leading-relaxed line-clamp-3' style={{ color: theme.node.text }}>
          {prompt}
        </div>
      )}
      <div className='flex gap-2 text-[10px]' style={{ color: theme.node.muted }}>
        {size && <span>{size}</span>}
        {count != null && count > 1 && <span>x{count}</span>}
      </div>
    </div>
  )
}

function OutputContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const outputUrls = node.metadata?.outputs as string[] | undefined
  const error = node.metadata?.errorDetails as string | undefined

  if (error) {
    return <div className='flex items-center justify-center h-full text-red-400 text-xs p-2'>{error}</div>
  }

  if (outputUrls && outputUrls.length > 0) {
    return (
      <div className='p-2'>
        <div className={`grid gap-1 ${outputUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {outputUrls.slice(0, 4).map((url, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<SafeImage key={i} src={url} alt={`Output ${i + 1}`} className='w-full h-auto rounded object-cover' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='flex items-center justify-center h-full text-xs' style={{ color: theme.node.muted }}>
      {t('canvas.nodeContent.waitingForResult')}
    </div>
  )
}

/** 根据节点类型返回相应的内容渲染器 */
export function renderNodeContent(node: CanvasNode, theme: CanvasTheme): React.ReactNode {
  switch (node.type) {
    case 'image':
      return <ImageContent node={node} theme={theme} />
    case 'text':
      return <TextContent node={node} theme={theme} />
    case 'config':
      return <ConfigContent node={node} theme={theme} />
    case 'output':
      return <OutputContent node={node} theme={theme} />
    case 'video':
      return <VideoContent node={node} theme={theme} />
    case 'audio':
      return <AudioContent node={node} theme={theme} />
    case 'group':
      return <GroupContent node={node} theme={theme} />
    case 'llm':
      return <TextContent node={node} theme={theme} />
    case 'loop':
      return <LoopContent node={node} theme={theme} />
    case 'comfy':
      return <ConfigContent node={node} theme={theme} />
    case 'modelscope':
      return <ConfigContent node={node} theme={theme} />
    default:
      return <DefaultContent node={node} theme={theme} />
  }
}

function DefaultContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center justify-center h-full text-xs' style={{ color: theme.node.muted }}>
      {t('canvas.nodeContent.nodeTypeLabel', { type: node.type })}
    </div>
  )
}

function VideoContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const content = node.metadata?.content as string | undefined
  if (!content) {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-3'
        style={{ color: theme.node.placeholder }}
      >
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
        <svg className='size-7 opacity-35' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
          <polygon points='23 7 16 12 23 17 23 7' />
          <rect x='1' y='5' width='15' height='14' rx='2' ry='2' />
        </svg>
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

function AudioContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const content = node.metadata?.content as string | undefined
  if (!content) {
    return (
      <div
        className='flex h-full w-full flex-col items-center justify-center gap-2'
        style={{ color: theme.node.placeholder }}
      >
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
        <svg className='size-7 opacity-35' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
          <path d='M9 18V5l12-2v13' />
          <circle cx='6' cy='18' r='3' />
          <circle cx='18' cy='16' r='3' />
        </svg>
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
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
        <svg className='size-4 shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
          <path d='M9 18V5l12-2v13' />
        </svg>
        <span className='truncate'>{node.title || t('canvas.nodeContent.audio')}</span>
      </div>
      <audio src={content} controls className='w-full' data-canvas-no-zoom>
        <track kind='captions' label='English' />
      </audio>
    </div>
  )
}

function GroupContent({ node, theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  const count = node.metadata?.nodeIds?.length ?? 0
  return (
    <div
      className='flex h-full w-full flex-col items-center justify-center gap-2 pt-8'
      style={{ color: theme.node.muted }}
    >
      <span className='text-[10px] tracking-[0.15em]'>{t('canvas.nodeContent.groupNode', { count })}</span>
    </div>
  )
}

function LoopContent({ theme }: { node: CanvasNode; theme: CanvasTheme }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center justify-center h-full text-xs' style={{ color: theme.node.muted }}>
      {t('canvas.nodeContent.loopNode')}
    </div>
  )
}
