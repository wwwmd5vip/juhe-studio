/**
 * CanvasAppearanceSettings.tsx - 画布外观设置弹窗
 * 主题切换、网格模式、图片信息显示等
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasV2Store } from '@/stores/canvas-v2-store'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'

interface Props {
  open: boolean
  onClose: () => void
}

export function CanvasAppearanceSettings({ open, onClose }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const theme = canvasThemes[themeResolved]
  const backgroundMode = useCanvasV2Store((s) => s.backgroundMode)
  const setBackgroundMode = useCanvasV2Store((s) => s.setBackgroundMode)
  const showImageInfo = useCanvasV2Store((s) => s.showImageInfo ?? true)
  const setShowImageInfo = useCanvasV2Store((s) => s.setShowImageInfo)

  const handleThemeChange = useCallback(
    (mode: 'light' | 'dark' | 'system') => {
      setThemeMode(mode)
    },
    [setThemeMode]
  )

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[95] flex items-center justify-center'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className='relative w-[440px] rounded-2xl p-6 shadow-2xl'
        style={{ background: theme.node.fill, borderColor: theme.node.stroke, borderWidth: 1 }}
      >
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-base font-semibold' style={{ color: theme.node.text }}>
            {t('canvas.appearance.title')}
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1 transition hover:bg-white/5'
            style={{ color: theme.node.muted }}
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='3' y1='3' x2='13' y2='13' />
              <line x1='13' y1='3' x2='3' y2='13' />
            </svg>
          </button>
        </div>

        {/* 主题 */}
        <section className='mb-5'>
          <h4 className='mb-3 text-xs' style={{ color: theme.node.muted }}>
            {t('canvas.appearance.theme')}
          </h4>
          <div className='flex gap-2'>
            {(
              [
                ['light', t('canvas.appearance.light')],
                ['dark', t('canvas.appearance.dark')],
                ['system', t('canvas.appearance.system')]
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type='button'
                onClick={() => handleThemeChange(mode)}
                className='flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition'
                style={{
                  borderColor: themeResolved === mode ? '#2f80ff' : theme.node.stroke,
                  background: themeResolved === mode ? '#2f80ff18' : 'transparent',
                  color: themeResolved === mode ? '#2f80ff' : theme.node.text
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 网格模式 */}
        <section className='mb-5'>
          <h4 className='mb-3 text-xs' style={{ color: theme.node.muted }}>
            {t('canvas.appearance.background')}
          </h4>
          <div className='flex gap-2'>
            {(
              [
                ['dots', t('canvas.appearance.dots')],
                ['lines', t('canvas.appearance.lines')],
                ['blank', t('canvas.appearance.blank')]
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type='button'
                onClick={() => setBackgroundMode(mode)}
                className='flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition'
                style={{
                  borderColor: backgroundMode === mode ? '#2f80ff' : theme.node.stroke,
                  background: backgroundMode === mode ? '#2f80ff18' : 'transparent',
                  color: backgroundMode === mode ? '#2f80ff' : theme.node.text
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 图片信息 */}
        <section>
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-xs' style={{ color: theme.node.text }}>
                {t('canvas.appearance.showImageInfo')}
              </h4>
              <p className='mt-0.5 text-[11px]' style={{ color: theme.node.muted }}>
                {t('canvas.appearance.showImageInfoDesc')}
              </p>
            </div>
            <button
              type='button'
              onClick={() => setShowImageInfo(!showImageInfo)}
              className='relative h-7 w-12 rounded-full transition'
              style={{
                background: showImageInfo ? '#2f80ff' : theme.node.stroke
              }}
            >
              <div
                className='absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform'
                style={{
                  left: showImageInfo ? 'calc(100% - 26px)' : '2px'
                }}
              />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
