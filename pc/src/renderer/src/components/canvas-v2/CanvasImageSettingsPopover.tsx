/**
 * CanvasImageSettingsPopover.tsx - 图片生成设置弹窗
 * 质量、尺寸、张数
 */

import { Settings2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { SettingsOption, SettingsPortal, SettingsSection } from './CanvasSettingsPopover'
import { canvasThemes } from './canvas-theme'

const QUALITY_OPTIONS = [
  { value: 'auto', label: 'canvas.imageSettings.auto' },
  { value: 'standard', label: 'canvas.imageSettings.standard' },
  { value: 'hd', label: 'canvas.imageSettings.hd' },
  { value: '4k', label: '4K' }
]

const SIZE_OPTIONS = [
  { value: 'auto', label: 'canvas.imageSettings.auto' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' }
]

const COUNT_OPTIONS = [1, 2, 3, 4, 6, 9]

export interface ImageSettingsConfig {
  quality?: string
  size?: string
  count?: number
}

const qualityLabel = (q: string) => QUALITY_OPTIONS.find((o) => o.value === q)?.label || 'canvas.imageSettings.auto'
const sizeLabel = (s: string) => SIZE_OPTIONS.find((o) => o.value === s)?.label || 'canvas.imageSettings.auto'

interface Props {
  config: ImageSettingsConfig
  onChange: (key: string, value: string | number) => void
  className?: string
}

export function CanvasImageSettingsPopover({ config, onChange, className }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const quality = config.quality || 'auto'
  const size = config.size || 'auto'
  const count = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)))

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        className={`flex h-8 max-w-[180px] items-center gap-1.5 truncate rounded-full px-2.5 text-xs font-medium transition hover:opacity-80 ${className || ''}`}
        style={{ background: theme.node.fill, color: theme.node.text, border: `1px solid ${theme.node.stroke}` }}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className='size-3.5 shrink-0' />
        <span className='truncate'>
          {t(qualityLabel(quality))} · {t(sizeLabel(size))} · {t('canvas.imageSettings.images', { count })}
        </span>
      </button>

      <SettingsPortal open={open} onClose={() => setOpen(false)} buttonRef={buttonRef}>
        <div className='space-y-4'>
          <SettingsSection label={t('canvas.imageSettings.quality')}>
            {QUALITY_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={quality === opt.value}
                onClick={() => onChange('quality', opt.value)}
              />
            ))}
          </SettingsSection>

          <SettingsSection label={t('canvas.imageSettings.size')}>
            {SIZE_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={size === opt.value}
                onClick={() => onChange('size', opt.value)}
              />
            ))}
          </SettingsSection>

          <SettingsSection label={t('canvas.imageSettings.count')}>
            {COUNT_OPTIONS.map((n) => (
              <SettingsOption
                key={n}
                label={t('canvas.imageSettings.images', { count: n })}
                active={count === n}
                onClick={() => onChange('count', n)}
              />
            ))}
          </SettingsSection>
        </div>
      </SettingsPortal>
    </>
  )
}
