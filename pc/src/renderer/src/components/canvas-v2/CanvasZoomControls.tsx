import { Tooltip } from '@cherrystudio/ui'
import { Compass, Focus, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

interface CanvasZoomControlsProps {
  scale: number
  onScaleChange: (scale: number) => void
  onReset: () => void
  isMiniMapOpen: boolean
  onToggleMiniMap: () => void
}

export function CanvasZoomControls({
  scale,
  onScaleChange,
  onReset,
  isMiniMapOpen,
  onToggleMiniMap
}: CanvasZoomControlsProps) {
  const { t } = useTranslation()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const dockStyle = {
    background: theme.toolbar.panel,
    borderColor: theme.toolbar.border,
    color: theme.toolbar.item,
    boxShadow: themeResolved === 'dark' ? '0 18px 45px rgba(0,0,0,.32)' : '0 16px 40px rgba(28,25,23,.12)'
  }
  const activeStyle = { background: theme.toolbar.activeBg, color: theme.toolbar.activeText }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className='absolute bottom-5 left-5 z-50'
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className='flex h-11 items-center gap-1 rounded-xl border px-2 shadow-lg backdrop-blur' style={dockStyle}>
        <Tooltip title={isMiniMapOpen ? t('canvas.actions.closeMiniMap') : t('canvas.actions.openMiniMap')}>
          <button
            type='button'
            className='flex size-8 items-center justify-center rounded-lg transition-colors hover:opacity-80'
            style={isMiniMapOpen ? activeStyle : { color: theme.toolbar.item }}
            onClick={onToggleMiniMap}
            aria-label={isMiniMapOpen ? t('canvas.actions.closeMiniMap') : t('canvas.actions.openMiniMap')}
          >
            <Compass className='size-4' />
          </button>
        </Tooltip>

        <Tooltip title={t('canvas.actions.fitView')}>
          <button
            type='button'
            className='flex size-8 items-center justify-center rounded-lg transition-colors hover:opacity-80'
            style={{ color: theme.toolbar.item }}
            onClick={onReset}
            aria-label={t('canvas.actions.fitView')}
          >
            <Focus className='size-4' />
          </button>
        </Tooltip>

        <input
          type='range'
          min='5'
          max='500'
          step='1'
          value={Math.round(scale * 100)}
          className='w-20'
          style={{ accentColor: theme.node.activeStroke }}
          onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
          aria-label={t('canvas.actions.zoom')}
          title={t('canvas.actions.zoom')}
        />

        <span className='w-10 text-right text-xs tabular-nums' style={{ color: theme.node.muted }}>
          {Math.round(scale * 100)}%
        </span>

        <Tooltip title={t('canvas.hints.title')}>
          <button
            type='button'
            className='flex size-8 items-center justify-center rounded-lg transition-colors hover:opacity-80'
            style={shortcutsOpen ? activeStyle : { color: theme.toolbar.item }}
            onClick={() => setShortcutsOpen(true)}
            aria-label={t('canvas.hints.title')}
          >
            <HelpCircle className='size-4' />
          </button>
        </Tooltip>
      </div>

      {/* Shortcuts Modal */}
      {shortcutsOpen && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
// biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div className='fixed inset-0 z-[100] flex items-center justify-center' onClick={() => setShortcutsOpen(false)}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
          <div
            className='w-80 rounded-2xl border p-6 shadow-2xl'
            style={{
              background: theme.toolbar.panel,
              borderColor: theme.toolbar.border,
              color: theme.node.text
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className='mb-4 text-base font-semibold'>{t('canvas.hints.title')}</h3>
            <div className='space-y-3 border-t pt-4 text-sm' style={{ borderColor: theme.node.stroke }}>
              <Shortcut label={t('canvas.hints.dragMove')} value={t('canvas.hints.dragMove')} />
              <Shortcut label={t('canvas.hints.zoom')} value={t('canvas.hints.zoom')} />
              <Shortcut label='Ctrl/Cmd + 拖动' value={t('canvas.hints.selectionControls')} />
              <Shortcut label='Shift/Ctrl/Cmd + 点击' value={t('canvas.shortcuts.appendSelect')} />
              <Shortcut label='Ctrl/Cmd + C/V' value={t('canvas.hints.copyPaste')} />
              <Shortcut label='Delete/Backspace' value={t('canvas.shortcuts.deleteSelected')} />
            </div>
            <button
              type='button'
              className='mt-4 w-full rounded-lg border py-2 text-sm transition-colors hover:opacity-80'
              style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}
              onClick={() => setShortcutsOpen(false)}
            >
              {t('canvas.lightbox.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Shortcut({ label, value }: { label: string; value: string }) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  return (
    <div className='flex items-center justify-between gap-4'>
      <span className='text-sm font-medium'>{label}</span>
      <span style={{ color: theme.node.muted }}>{value}</span>
    </div>
  )
}
