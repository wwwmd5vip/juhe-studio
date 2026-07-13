/**
 * CanvasNodeAngleDialog.tsx - 多角度生成弹窗
 * 设置视角参数后通过 AI 重新生成同一主体的不同角度
 */

import { RotateCcw, WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasImageAngleParams } from './types'

interface Props {
  dataUrl: string
  open: boolean
  onClose: () => void
  onConfirm: (params: CanvasImageAngleParams) => void
}

const DEFAULTS: CanvasImageAngleParams = {
  horizontalAngle: 0,
  pitchAngle: 9,
  cameraDistance: 4.8,
  wideAngle: false
}

export function CanvasNodeAngleDialog({ dataUrl, open, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const [horizontalAngle, setHorizontalAngle] = useState(DEFAULTS.horizontalAngle)
  const [pitchAngle, setPitchAngle] = useState(DEFAULTS.pitchAngle)
  const [cameraDistance, setCameraDistance] = useState(DEFAULTS.cameraDistance)
  const [wideAngle, setWideAngle] = useState(DEFAULTS.wideAngle)

  useEffect(() => {
    if (open) {
      setHorizontalAngle(DEFAULTS.horizontalAngle)
      setPitchAngle(DEFAULTS.pitchAngle)
      setCameraDistance(DEFAULTS.cameraDistance)
      setWideAngle(DEFAULTS.wideAngle)
    }
  }, [open])

  const handleReset = useCallback(() => {
    setHorizontalAngle(DEFAULTS.horizontalAngle)
    setPitchAngle(DEFAULTS.pitchAngle)
    setCameraDistance(DEFAULTS.cameraDistance)
    setWideAngle(DEFAULTS.wideAngle)
  }, [])

  const previewTransform = useMemo(() => {
    const scale = wideAngle ? 1.1 : 1
    return `perspective(520px) rotateY(${horizontalAngle * -0.45}deg) rotateX(${pitchAngle * 0.35}deg) scale(${scale})`
  }, [horizontalAngle, pitchAngle, wideAngle])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[90] flex items-center justify-center'>
      {/* backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />

      <div className='relative flex w-[860px] gap-6 rounded-2xl bg-[#1c1c1e] p-6 shadow-2xl'>
        {/* Left: 3D preview */}
        <div className='flex w-[320px] shrink-0 flex-col items-center gap-4'>
          <div className='relative mt-2 flex items-center justify-center' style={{ perspective: '520px' }}>
            <img
              src={dataUrl}
              alt={t('canvas.angle.preview')}
              className='size-48 rounded-2xl object-cover shadow-2xl'
              style={{ transform: previewTransform }}
            />
            {/* Ground shadow */}
            <div className='absolute -bottom-6 left-1/2 h-10 w-24 -translate-x-1/2 rounded-full border bg-black/20 backdrop-blur-sm' />
          </div>
          <button
            type='button'
            onClick={handleReset}
            className='flex items-center gap-1 text-xs text-white/40 transition hover:text-white/70'
          >
            <RotateCcw className='size-3' />
            {t('canvas.angle.reset')}
          </button>
          <p className='text-center text-xs text-white/30'>
            {t('canvas.angle.multiAngleHint')}
            <br />
            {t('canvas.angle.resultHint')}
          </p>
        </div>

        {/* Right: controls */}
        <div className='flex flex-1 flex-col gap-5'>
          <h3 className='text-base font-semibold text-white'>{t('canvas.toolbarDetail.angle')}</h3>

          {/* 左右角度 */}
          <AngleSlider
            label={t('canvas.angle.horizontalAngle')}
            value={horizontalAngle}
            min={-60}
            max={60}
            step={1}
            suffix='°'
            onChange={setHorizontalAngle}
          />

          {/* 俯仰角度 */}
          <AngleSlider
            label={t('canvas.angle.pitchAngle')}
            value={pitchAngle}
            min={-45}
            max={45}
            step={1}
            suffix='°'
            onChange={setPitchAngle}
          />

          {/* 镜头距离 */}
          <AngleSlider
            label={t('canvas.angle.cameraDistance')}
            value={cameraDistance}
            min={1}
            max={10}
            step={0.1}
            onChange={setCameraDistance}
          />

          {/* 广角镜头 */}
          <div className='flex items-center justify-between'>
            <span className='text-xs text-white/50'>{t('canvas.angle.wideAngle')}</span>
            <div className='flex overflow-hidden rounded-lg border border-white/10'>
              <button
                type='button'
                onClick={() => setWideAngle(false)}
                className={`px-3 py-1 text-xs transition ${!wideAngle ? 'bg-white/10 text-white' : 'text-white/40'}`}
              >
                {t('canvas.angle.standard')}
              </button>
              <button
                type='button'
                onClick={() => setWideAngle(true)}
                className={`px-3 py-1 text-xs transition ${wideAngle ? 'bg-white/10 text-white' : 'text-white/40'}`}
              >
                {t('canvas.angle.wide')}
              </button>
            </div>
          </div>

          {/* 按钮 */}
          <div className='flex gap-2 pt-1'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/5'
            >
              {t('common.cancel')}
            </button>
            <button
              type='button'
              onClick={() => onConfirm({ horizontalAngle, pitchAngle, cameraDistance, wideAngle })}
              className='flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2f80ff] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2f80ff]/90'
            >
              <WandSparkles className='size-4' />
              {t('canvas.angle.aiGenerate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- AngleSlider 子组件 ---- */

function AngleSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}) {
  const displayValue = step >= 1 ? Math.round(value) : value.toFixed(1)
  return (
    <label className='flex flex-col gap-1.5'>
      <div className='flex items-center justify-between'>
        <span className='text-xs text-white/50'>{label}</span>
        <span className='text-xs tabular-nums text-white/60'>
          {displayValue}
          {suffix || ''}
        </span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className='h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#2f80ff] outline-none'
      />
    </label>
  )
}
