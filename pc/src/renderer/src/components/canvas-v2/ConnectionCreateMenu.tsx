/**
 * ConnectionCreateMenu.tsx - 拖连创建节点菜单
 * 1:1 复刻 infinite-canvas-main
 */

import { Image, List, Music2, Settings2, Video } from 'lucide-react'
import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import { worldToScreenPosition } from './InfiniteCanvas'
import type { CanvasNodeType, Position } from './types'

interface ConnectionCreateMenuProps {
  worldPos: Position
  fromNodeType: CanvasNodeType
  handleType: 'source' | 'target'
  viewport: { x: number; y: number; k: number }
  containerRect: DOMRect | null
  onSelect: (type: CanvasNodeType) => void
  onClose: () => void
}

interface OptionItem {
  type: CanvasNodeType
  title: string
  description?: string
  icon: React.ReactNode
}

export function ConnectionCreateMenu({
  worldPos,
  fromNodeType: _fromNodeType,
  handleType,
  viewport,
  containerRect,
  onSelect,
  onClose
}: ConnectionCreateMenuProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const { t } = useTranslation()
  const theme = canvasThemes[themeResolved]

  if (!containerRect) return null

  const screenPos = worldToScreenPosition(worldPos, viewport)

  // Filter valid target types
  const downstreamTypes: CanvasNodeType[] =
    handleType === 'source'
      ? ['image', 'text', 'video', 'audio', 'output', 'group']
      : ['image', 'text', 'config', 'video', 'audio', 'llm']

  const allOptions: OptionItem[] = [
    {
      type: 'text',
      title: t('canvas.connectionMenu.textGenerate'),
      description: t('canvas.connectionMenu.textGenerateDesc'),
      icon: <List className='size-5' />
    },
    { type: 'image', title: t('canvas.connectionMenu.imageGenerate'), icon: <Image className='size-5' /> },
    { type: 'video', title: t('canvas.connectionMenu.videoGenerate'), icon: <Video className='size-5' /> },
    { type: 'audio', title: t('canvas.connectionMenu.audioReference'), icon: <Music2 className='size-5' /> },
    {
      type: 'config',
      title: t('canvas.connectionMenu.configNode'),
      description: t('canvas.connectionMenu.configNodeDesc'),
      icon: <Settings2 className='size-5' />
    }
  ]

  const options = allOptions.filter((o) => downstreamTypes.includes(o.type))

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='fixed inset-0 z-[80]' onClick={onClose} />

      {/* Menu */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      <div
        className='nodrag nopan fixed z-[85] w-[300px] rounded-[18px] border p-3 shadow-2xl'
        data-connection-create-menu
        style={{
          left: screenPos.x + (containerRect?.left ?? 0) + 16,
          top: screenPos.y + (containerRect?.top ?? 0),
          background: theme.node.panel,
          borderColor: theme.node.stroke,
          color: theme.node.text
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='mb-2 flex items-center justify-between px-1'>
          <span className='text-sm font-medium' style={{ color: theme.node.muted }}>
            {t('canvas.connectionMenu.title')}
          </span>
          <button
            type='button'
            className='grid size-7 place-items-center rounded-lg text-base opacity-55 transition hover:bg-white/10'
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Options */}
        <div className='grid gap-1'>
          {options.map((opt) => (
            <button
              key={opt.type}
              type='button'
              className='flex h-16 w-full items-center gap-3 rounded-xl px-3 transition hover:scale-[1.01]'
              style={{
                background: theme.toolbar.panel,
                color: theme.node.text
              }}
              onClick={() => onSelect(opt.type)}
            >
              <span
                className='flex size-11 shrink-0 items-center justify-center rounded-xl'
                style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}
              >
                {opt.icon}
              </span>
              <div className='flex flex-col items-start min-w-0'>
                <span className='text-sm font-medium'>{opt.title}</span>
                {opt.description ? (
                  <span className='text-xs mt-0.5 opacity-55 truncate max-w-[200px]'>{opt.description}</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
