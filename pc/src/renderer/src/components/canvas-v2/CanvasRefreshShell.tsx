/**
 * CanvasRefreshShell.tsx - 画布加载骨架屏
 * 首屏加载时显示闪烁占位，仿参考项目的节点加载状态
 */
import React from 'react'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

export const CanvasRefreshShell = React.memo(function CanvasRefreshShell() {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const skeletonNodes = [
    { width: 240, height: 180, x: 120, y: 100 },
    { width: 200, height: 140, x: 500, y: 80 },
    { width: 280, height: 200, x: 240, y: 360 },
    { width: 180, height: 120, x: 600, y: 320 },
    { width: 220, height: 160, x: 400, y: 500 }
  ]

  return (
    <div
      className='absolute inset-0 z-0 flex items-center justify-center'
      style={{ background: theme.canvas.background }}
    >
      {/* Skeleton node cards */}
      {skeletonNodes.map((node, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
          key={i}
          className='canvas-node-skeleton absolute rounded-3xl'
          style={{
            width: node.width,
            height: node.height,
            left: node.x,
            top: node.y,
            borderColor: theme.node.stroke,
            borderWidth: 1,
            animationDelay: `${i * 120}ms`,
            opacity: 0.5
          }}
        />
      ))}

      {/* Center loading indicator */}
      <div
        className='relative z-10 flex flex-col items-center gap-4 rounded-2xl border px-8 py-6 shadow-2xl backdrop-blur-md'
        style={{
          background: theme.toolbar.panel,
          borderColor: theme.toolbar.border,
          boxShadow: themeResolved === 'dark' ? '0 18px 45px rgba(0,0,0,.32)' : '0 16px 40px rgba(28,25,23,.12)'
        }}
      >
        <div
          className='size-8 animate-spin rounded-full border-2'
          style={{ borderColor: theme.node.stroke, borderTopColor: '#2f80ff' }}
        />
        <span className='mono-num text-xs tracking-[0.15em]' style={{ color: theme.node.muted }}>
          画布加载中
        </span>
      </div>
    </div>
  )
})
