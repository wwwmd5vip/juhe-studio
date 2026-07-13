import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Layers, LayoutGrid, Package, Shirt, ShoppingBag, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProductSetFlow } from '@/components/ecommerce/ProductSetFlow'
import { ProductShowcaseFlow } from '@/components/ecommerce/ProductShowcaseFlow'
import { SceneCompositionFlow } from '@/components/ecommerce/SceneCompositionFlow'
import { TryonFlow } from '@/components/ecommerce/TryonFlow'

// ---- Presets ----

type PresetId = 'product-set' | 'tryon' | 'scene-composition' | 'product-showcase'

const PRESETS = [
  {
    id: 'product-set' as const,
    icon: Package,
    titleKey: 'ecommerce.presetProductSet',
    descKey: 'ecommerce.presetProductSetDesc'
  },
  { id: 'tryon' as const, icon: Shirt, titleKey: 'ecommerce.presetTryon', descKey: 'ecommerce.presetTryonDesc' },
  {
    id: 'scene-composition' as const,
    icon: Layers,
    titleKey: 'ecommerce.presetSceneComposition',
    descKey: 'ecommerce.presetSceneCompositionDesc'
  },
  {
    id: 'product-showcase' as const,
    icon: LayoutGrid,
    titleKey: 'ecommerce.presetProductShowcase',
    descKey: 'ecommerce.presetProductShowcaseDesc'
  }
]

// ---- Route ----

export const Route = createFileRoute('/ecommerce')({ component: EcommercePage })

// ---- Composed Page ----

function EcommercePage() {
  const { t } = useTranslation()
  const [activePreset, setActivePreset] = useState<PresetId | null>(null)

  if (!activePreset) {
    return (
      <PageLayout>
        <div className='max-w-3xl mx-auto px-6 py-10'>
          <h2 className='text-lg font-bold mb-2' style={{ color: 'var(--juhe-text)' }}>
            {t('ecommerce.choosePreset')}
          </h2>
          <p className='text-sm mb-6' style={{ color: 'var(--juhe-text-3)' }}>
            {t('ecommerce.choosePresetDesc')}
          </p>

          {/* Amazon Planner — highlighted entry */}
          <Link
            to='/ecommerce-amazon'
            className='group flex items-center gap-4 p-5 rounded-2xl border mb-6 transition-all hover:-translate-y-0.5'
            style={{ borderColor: 'var(--juhe-border)', background: 'linear-gradient(135deg, rgba(255,165,0,0.08) 0%, rgba(255,165,0,0.02) 100%)' }}
          >
            <div
              className='w-12 h-12 rounded-xl flex items-center justify-center shrink-0'
              style={{ background: 'rgba(255,165,0,0.15)' }}
            >
              <Sparkles className='w-5 h-5' style={{ color: '#ffa500' }} />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-semibold mb-0.5 flex items-center gap-2' style={{ color: 'var(--juhe-text)' }}>
                Amazon Planner
                <span className='text-[9px] px-1.5 py-0.5 rounded-full bg-[#ffa500]/20 text-[#ffa500] font-medium'>Listing + A+</span>
              </div>
              <p className='text-xs leading-relaxed' style={{ color: 'var(--juhe-text-3)' }}>
                AI 驱动的 Amazon 图片策划工具，输入产品信息自动策划 Listing 主附图与 A+ Content 模块方案
              </p>
            </div>
            <ArrowRight className='w-4 h-4 shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all' style={{ color: '#ffa500' }} />
          </Link>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type='button'
                onClick={() => setActivePreset(preset.id)}
                className='group flex flex-col items-start gap-3 p-5 rounded-2xl border text-left transition-all hover:-translate-y-0.5'
                style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
              >
                <div
                  className='w-11 h-11 rounded-xl flex items-center justify-center'
                  style={{ background: 'var(--juhe-cyan-glow)' }}
                >
                  <preset.icon className='w-5 h-5' style={{ color: 'var(--juhe-cyan)' }} />
                </div>
                <div>
                  <div
                    className='text-sm font-semibold mb-1 flex items-center gap-2'
                    style={{ color: 'var(--juhe-text)' }}
                  >
                    {t(preset.titleKey)}
                    <ArrowRight
                      className='w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all'
                      style={{ color: 'var(--juhe-cyan)' }}
                    />
                  </div>
                  <p className='text-xs leading-relaxed' style={{ color: 'var(--juhe-text-3)' }}>
                    {t(preset.descKey)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className='max-w-4xl mx-auto px-6 py-8'>
        <button
          type='button'
          onClick={() => setActivePreset(null)}
          className='text-xs font-medium mb-6 transition-colors hover:opacity-80'
          style={{ color: 'var(--juhe-text-3)' }}
        >
          ← {t('ecommerce.backToPresets')}
        </button>

        {activePreset === 'product-set' && <ProductSetFlow />}
        {activePreset === 'tryon' && <TryonFlow />}
        {activePreset === 'scene-composition' && <SceneCompositionFlow />}
        {activePreset === 'product-showcase' && <ProductShowcaseFlow />}
      </div>
    </PageLayout>
  )
}

// ---- Layout shell ----

function PageLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className='h-[calc(100vh-3rem)] flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      <header
        className='flex items-center gap-4 px-4 py-3 border-b shrink-0'
        style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
      >
        <ShoppingBag className='w-5 h-5' style={{ color: 'var(--juhe-cyan)' }} />
        <h1 className='text-sm font-bold' style={{ color: 'var(--juhe-text)' }}>
          {t('ecommerce.title')}
        </h1>
        <span className='text-[11px]' style={{ color: 'var(--juhe-text-3)' }}>
          {t('ecommerce.subtitle')}
        </span>
      </header>
      <div className='flex-1 overflow-y-auto'>{children}</div>
      <footer
        className='shrink-0 px-4 py-2 border-t flex justify-center'
        style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
      >
        <Link
          to='/ecommerce-workflow'
          className='text-[11px] transition-colors hover:opacity-80'
          style={{ color: 'var(--juhe-text-3)' }}
        >
          {t('ecommerce.advancedWorkflow')} →
        </Link>
      </footer>
    </div>
  )
}
