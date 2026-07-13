import { Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function TitleBar() {
  const { t } = useTranslation()

  return (
    <div
      className='h-10 flex items-center justify-between px-4 draggable select-none relative overflow-hidden'
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,20,0.95) 0%, rgba(10,10,20,0.85) 100%)',
        borderBottom: '1px solid rgba(0,240,255,0.08)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div
        className='absolute inset-0 opacity-30 pointer-events-none'
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />

      {/* Left: Brand */}
      <div className='flex items-center gap-2.5 relative z-10'>
        <div
          className='w-5 h-5 rounded flex items-center justify-center bg-[linear-gradient(135deg,var(--juhe-cyan),var(--juhe-violet))] shadow-[0_0_10px_rgba(0,240,255,0.3)]'
        >
          <Zap size={12} className='text-white' strokeWidth={2.5} />
        </div>
        <span
          className='text-xs font-semibold tracking-[0.15em] uppercase text-[var(--juhe-text)] [font-family:var(--font-display)]'
        >
          {t('app.name')}
        </span>
        <span
          className='text-[9px] px-1.5 py-0.5 rounded text-[var(--juhe-cyan)] bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.2)] [font-family:var(--font-mono)]'
        >
          BETA
        </span>
      </div>

      {/* Right: window controls */}
      <div className='flex items-center gap-3 relative z-10 no-drag'>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={() => window.api?.window?.minimize()}
            className='p-1.5 rounded transition-colors hover:bg-white/5'
            aria-label='minimize'
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
              <path d='M1 5H9' className='stroke-[var(--juhe-text-3)]' strokeWidth='1.2' strokeLinecap='round' />
            </svg>
          </button>
          <button
            type='button'
            onClick={() => window.api?.window?.maximize()}
            className='p-1.5 rounded transition-colors hover:bg-white/5'
            aria-label='maximize'
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
              <rect x='1' y='1' width='8' height='8' rx='1.5' className='stroke-[var(--juhe-text-3)]' strokeWidth='1.2' />
            </svg>
          </button>
          <button
            type='button'
            onClick={() => window.api?.window?.close()}
            className='p-1.5 rounded transition-colors hover:bg-red-500/20 group'
            aria-label='close'
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
              <path
                d='M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5'
                strokeWidth='1.2'
                strokeLinecap='round'
                className='stroke-[var(--juhe-text-3)] group-hover:stroke-red-400 transition-colors'
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
