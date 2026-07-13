/**
 * CanvasSettingsPopover.tsx - 通用设置弹窗 Portal
 * 复刻参考项目：Portal 弹出 + 点击外部关闭 + 手动定位
 */
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

export interface SettingsPopoverProps {
  open: boolean
  onClose: () => void
  buttonRef: React.RefObject<HTMLElement | null>
  placement?: 'topLeft' | 'top' | 'topRight' | 'bottomLeft' | 'bottom' | 'bottomRight'
  width?: number
  children: React.ReactNode
}

export function SettingsPortal({
  open,
  onClose,
  buttonRef,
  placement = 'topLeft',
  width = 356,
  children
}: SettingsPopoverProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const panelRef = useRef<HTMLDivElement>(null)
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open) return
    const syncPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      setButtonRect(rect || null)
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onClose()
    }

    syncPosition()
    window.addEventListener('resize', syncPosition)
    window.addEventListener('scroll', syncPosition, true)
    window.addEventListener('pointerdown', closeOnOutsidePointer, true)
    return () => {
      window.removeEventListener('resize', syncPosition)
      window.removeEventListener('scroll', syncPosition, true)
      window.removeEventListener('pointerdown', closeOnOutsidePointer, true)
    }
  }, [open, onClose, buttonRef])

  if (!open || !buttonRect) return null

  const gap = 8
  const margin = 12
  const alignRight = placement?.endsWith('Right')
  const alignCenter = placement === 'top' || placement === 'bottom'
  const left = alignCenter
    ? buttonRect.left + buttonRect.width / 2 - width / 2
    : alignRight
      ? buttonRect.right - width
      : buttonRect.left
  const topPlacement = placement?.startsWith('top')

  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1200,
    width,
    left: Math.max(margin, Math.min(window.innerWidth - width - margin, left)),
    ...(topPlacement
      ? { bottom: window.innerHeight - buttonRect.top + gap, maxHeight: Math.max(260, buttonRect.top - margin * 2) }
      : {
          top: buttonRect.bottom + gap,
          maxHeight: Math.max(260, window.innerHeight - buttonRect.bottom - margin * 2)
        }),
    background: theme.toolbar.panel,
    borderRadius: 18,
    boxShadow: themeResolved === 'dark' ? '0 18px 54px rgba(0,0,0,.32)' : '0 18px 54px rgba(28,25,23,.16)',
    padding: 18,
    overflowY: 'auto' as const,
    color: theme.node.text
  }

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      ref={panelRef}
      className='canvas-settings-popover'
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}

/** 设置面板中的分段标题 */
export function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  return (
    <div className='space-y-2'>
      <span className='text-[11px] font-medium' style={{ color: theme.node.muted }}>
        {label}
      </span>
      <div className='flex flex-wrap gap-1.5'>{children}</div>
    </div>
  )
}

/** 设置面板中的选项按钮 */
export function SettingsOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  return (
    <button
      type='button'
      className='rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors'
      style={{
        background: active ? theme.toolbar.activeBg : theme.node.fill,
        color: active ? theme.toolbar.activeText : theme.node.text,
        border: `1px solid ${active ? theme.toolbar.activeBg : theme.node.stroke}`
      }}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
