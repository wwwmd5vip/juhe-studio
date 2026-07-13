/**
 * CanvasEmpty.tsx - 空画布占位引导
 * 无节点时显示操作提示和快速入口
 */
import { Film, Image, Music, Type, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasNodeType, Position } from './types'

interface CanvasEmptyProps {
  viewportScale: number
  onAddNode: (type: CanvasNodeType, position?: Position) => void
}

export function CanvasEmpty({ viewportScale, onAddNode }: CanvasEmptyProps) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const centerPos: Position = { x: -300, y: -100 }

  const nodeTypes: Array<{ type: CanvasNodeType; icon: React.ReactNode; label: string; pos: Position }> = [
    {
      type: 'image',
      icon: <Image className='w-8 h-8' />,
      label: t('canvas.nodeTypes.image'),
      pos: { x: centerPos.x - 200, y: centerPos.y }
    },
    {
      type: 'text',
      icon: <Type className='w-8 h-8' />,
      label: t('canvas.nodeTypes.text'),
      pos: { x: centerPos.x + 120, y: centerPos.y }
    },
    {
      type: 'config',
      icon: <Wand2 className='w-8 h-8' />,
      label: t('canvas.nodeTypes.config'),
      pos: { x: centerPos.x - 40, y: centerPos.y + 160 }
    },
    {
      type: 'video',
      icon: <Film className='w-8 h-8' />,
      label: t('canvas.nodeTypes.video'),
      pos: { x: centerPos.x - 200, y: centerPos.y + 300 }
    },
    {
      type: 'audio',
      icon: <Music className='w-8 h-8' />,
      label: t('canvas.nodeTypes.audio'),
      pos: { x: centerPos.x + 120, y: centerPos.y + 300 }
    }
  ]

  return (
    <div className='absolute inset-0 pointer-events-none select-none'>
      {/* Center hint */}
      <div
        className='absolute flex flex-col items-center gap-3 -translate-x-1/2 -translate-y-1/2'
        style={{
          left: '50%',
          top: '50%',
          opacity: Math.max(0.15, Math.min(0.4, viewportScale * 0.4)),
          transform: `translate(-50%, -50%) scale(${Math.max(0.8, Math.min(1.2, viewportScale))})`
        }}
      >
        <div className='text-6xl'>🎨</div>
        <p className='text-sm font-medium' style={{ color: theme.node.text }}>
          {t('canvas.empty.guideText')}
        </p>
        <p className='text-xs' style={{ color: theme.node.muted }}>
          {t('canvas.empty.shortcutHint')}
        </p>
      </div>

      {/* Ghost node buttons */}
      {nodeTypes.map((n) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
          key={n.type}
          className='absolute flex flex-col items-center gap-2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group'
          style={{
            left: `calc(50% + ${n.pos.x * viewportScale}px)`,
            top: `calc(50% + ${n.pos.y * viewportScale}px)`,
            opacity: Math.max(0.06, Math.min(0.25, viewportScale * 0.25))
          }}
          onClick={() =>
            onAddNode(n.type, {
              x: -n.pos.x / viewportScale + (window.innerWidth / 2 - n.pos.x) / viewportScale,
              y: -n.pos.y / viewportScale + (window.innerHeight / 2 - n.pos.y) / viewportScale
            })
          }
        >
          <div
            className='w-16 h-16 rounded-xl flex items-center justify-center border-2 border-dashed transition-all group-hover:opacity-80 group-hover:scale-110'
            style={{ borderColor: theme.node.stroke, background: theme.node.fill }}
          >
            {n.icon}
          </div>
          <span className='text-[10px] font-medium' style={{ color: theme.node.muted }}>
            {n.label}
          </span>
        </div>
      ))}
    </div>
  )
}
