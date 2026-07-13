/**
 * CanvasVideoSettingsPopover.tsx - 视频生成设置弹窗
 * 画质、尺寸、时长
 */

import { Settings2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { SettingsOption, SettingsPortal, SettingsSection } from './CanvasSettingsPopover'
import { canvasThemes } from './canvas-theme'

const VQUALITY_OPTIONS = [
  { value: 'auto', label: 'canvas.videoSettings.auto' },
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' }
]

const SIZE_OPTIONS = [
  { value: 'auto', label: 'canvas.videoSettings.auto' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' }
]

const SECONDS_OPTIONS = [
  { value: 'auto', label: 'canvas.videoSettings.auto' },
  { value: '4', label: '4s' },
  { value: '5', label: '5s' },
  { value: '8', label: '8s' },
  { value: '10', label: '10s' }
]

const vqualityLabel = (q: string) => VQUALITY_OPTIONS.find((o) => o.value === q)?.label || 'canvas.videoSettings.auto'
const videoSizeLabel = (s: string) => SIZE_OPTIONS.find((o) => o.value === s)?.label || 'canvas.videoSettings.auto'
const secondsLabel = (s: string | undefined) => {
  if (!s || s === 'auto') return 'canvas.videoSettings.auto'
  return `${s}s`
}

export interface VideoSettingsConfig {
  vquality?: string
  size?: string
  seconds?: string
}

interface Props {
  config: VideoSettingsConfig
  onChange: (key: string, value: string) => void
  className?: string
}

export function CanvasVideoSettingsPopover({ config, onChange, className }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const vquality = config.vquality || 'auto'
  const size = config.size || 'auto'
  const seconds = config.seconds || 'auto'

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
          {t(vqualityLabel(vquality))} · {t(videoSizeLabel(size))} · {t(secondsLabel(seconds))}
        </span>
      </button>

      <SettingsPortal open={open} onClose={() => setOpen(false)} buttonRef={buttonRef}>
        <div className='space-y-4'>
          <SettingsSection label={t('canvas.videoSettings.vquality')}>
            {VQUALITY_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={vquality === opt.value}
                onClick={() => onChange('vquality', opt.value)}
              />
            ))}
          </SettingsSection>

          <SettingsSection label={t('canvas.videoSettings.size')}>
            {SIZE_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={size === opt.value}
                onClick={() => onChange('size', opt.value)}
              />
            ))}
          </SettingsSection>

          <SettingsSection label={t('canvas.videoSettings.duration')}>
            {SECONDS_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={seconds === opt.value}
                onClick={() => onChange('seconds', opt.value)}
              />
            ))}
          </SettingsSection>
        </div>
      </SettingsPortal>
    </>
  )
}
