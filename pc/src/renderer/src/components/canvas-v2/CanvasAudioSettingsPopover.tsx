/**
 * CanvasAudioSettingsPopover.tsx - 音频生成设置弹窗
 * 音色、格式、语速
 */

import { Settings2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { SettingsOption, SettingsPortal, SettingsSection } from './CanvasSettingsPopover'
import { canvasThemes } from './canvas-theme'

const VOICE_OPTIONS = [
  { value: 'auto', label: 'canvas.audioSettings.auto' },
  { value: 'female-qingxin', label: 'canvas.audioSettings.femaleQingxin' },
  { value: 'female-wenrou', label: 'canvas.audioSettings.femaleWenrou' },
  { value: 'male-wenhou', label: 'canvas.audioSettings.maleWenhou' },
  { value: 'male-chenwen', label: 'canvas.audioSettings.maleChenwen' }
]

const FORMAT_OPTIONS = [
  { value: 'auto', label: 'canvas.audioSettings.auto' },
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'ogg', label: 'OGG' }
]

const SPEED_OPTIONS = [
  { value: 'auto', label: 'canvas.audioSettings.auto' },
  { value: '0.8', label: '0.8x' },
  { value: '1.0', label: '1.0x' },
  { value: '1.2', label: '1.2x' },
  { value: '1.5', label: '1.5x' }
]

const voiceLabel = (v: string) => VOICE_OPTIONS.find((o) => o.value === v)?.label || 'canvas.audioSettings.auto'
const formatLabel = (f: string) => FORMAT_OPTIONS.find((o) => o.value === f)?.label || 'canvas.audioSettings.auto'
const speedLabel = (s: string) => SPEED_OPTIONS.find((o) => o.value === s)?.label || 'canvas.audioSettings.auto'

export interface AudioSettingsConfig {
  audioVoice?: string
  audioFormat?: string
  audioSpeed?: string
}

interface Props {
  config: AudioSettingsConfig
  onChange: (key: string, value: string) => void
  className?: string
}

export function CanvasAudioSettingsPopover({ config, onChange, className }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const voice = config.audioVoice || 'auto'
  const format = config.audioFormat || 'auto'
  const speed = config.audioSpeed || 'auto'

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
          {t(voiceLabel(voice))} · {t(formatLabel(format))} · {t(speedLabel(speed))}
        </span>
      </button>

      <SettingsPortal open={open} onClose={() => setOpen(false)} buttonRef={buttonRef}>
        <div className='space-y-4'>
          <SettingsSection label={t('canvas.audioSettings.voice')}>
            {VOICE_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={voice === opt.value}
                onClick={() => onChange('audioVoice', opt.value)}
              />
            ))}
          </SettingsSection>

          <SettingsSection label={t('canvas.audioSettings.format')}>
            {FORMAT_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={format === opt.value}
                onClick={() => onChange('audioFormat', opt.value)}
              />
            ))}
          </SettingsSection>

          <SettingsSection label={t('canvas.audioSettings.speed')}>
            {SPEED_OPTIONS.map((opt) => (
              <SettingsOption
                key={opt.value}
                label={t(opt.label)}
                active={speed === opt.value}
                onClick={() => onChange('audioSpeed', opt.value)}
              />
            ))}
          </SettingsSection>
        </div>
      </SettingsPortal>
    </>
  )
}
