/**
 * CanvasSidebar.tsx - 画布左侧节点面板
 * 快速拖拽或点击添加节点到画布
 */
import { Bot, FileText, Film, Image, Music, Package, Repeat, Type, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasNodeType } from './types'

interface CanvasSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onAddNode: (type: CanvasNodeType, position?: { x: number; y: number }) => void
  viewportCenter: { x: number; y: number }
}

export function CanvasSidebar({ isOpen, onToggle, onAddNode, viewportCenter }: CanvasSidebarProps) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const NODE_ITEMS = [
    { type: 'image' as CanvasNodeType, icon: <Image className='w-5 h-5' />, label: t('canvas.nodeTypes.image') },
    { type: 'text' as CanvasNodeType, icon: <Type className='w-5 h-5' />, label: t('canvas.nodeTypes.text') },
    { type: 'config' as CanvasNodeType, icon: <Wand2 className='w-5 h-5' />, label: t('canvas.nodeTypes.config') },
    { type: 'video' as CanvasNodeType, icon: <Film className='w-5 h-5' />, label: t('canvas.nodeTypes.video') },
    { type: 'audio' as CanvasNodeType, icon: <Music className='w-5 h-5' />, label: t('canvas.nodeTypes.audio') },
    { type: 'output' as CanvasNodeType, icon: <FileText className='w-5 h-5' />, label: t('canvas.nodeTypes.output') },
    { type: 'llm' as CanvasNodeType, icon: <Bot className='w-5 h-5' />, label: t('canvas.nodeTypes.llm') },
    { type: 'loop' as CanvasNodeType, icon: <Repeat className='w-5 h-5' />, label: t('canvas.nodeTypes.loop') }
  ]

  const handleDragStart = (e: React.DragEvent, type: CanvasNodeType) => {
    e.dataTransfer.setData('canvas/node-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (type: CanvasNodeType) => {
    const offset = Math.random() * 80 - 40
    onAddNode(type, {
      x: viewportCenter.x + offset,
      y: viewportCenter.y + offset
    })
  }

  return (
    <>
      {/* Toggle button */}
      <button
        type='button'
        onClick={onToggle}
        className='absolute left-3 top-3 z-40 flex size-8 items-center justify-center rounded-lg transition-colors backdrop-blur'
        style={{
          background: isOpen ? theme.toolbar.panel : 'transparent',
          border: `1px solid ${isOpen ? theme.toolbar.border : 'transparent'}`,
          color: theme.toolbar.item,
          boxShadow: isOpen
            ? undefined
            : themeResolved === 'dark'
              ? '0 18px 45px rgba(0,0,0,.32)'
              : '0 16px 40px rgba(28,25,23,.12)'
        }}
        title={t('canvas.sidebar.title')}
      >
        <Package className='w-4 h-4' />
      </button>

      {/* Sidebar */}
      {isOpen && (
        <div
          className='absolute left-3 top-14 z-40 rounded-xl border p-2 backdrop-blur flex flex-col gap-1'
          style={{
            background: theme.toolbar.panel,
            borderColor: theme.toolbar.border,
            boxShadow: themeResolved === 'dark' ? '0 18px 45px rgba(0,0,0,.32)' : '0 16px 40px rgba(28,25,23,.12)'
          }}
        >
          {NODE_ITEMS.map((item) => (
            <button
              type='button'
              key={item.type}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              onClick={() => handleClick(item.type)}
              className='flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors'
              style={{
                color: theme.toolbar.item,
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = theme.toolbar.itemHover
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
