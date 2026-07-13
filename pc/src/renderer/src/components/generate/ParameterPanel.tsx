import type { ImageQuality, ImageSize, ImageStyle } from '@shared/types/generation'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation'
import { useProviderStore } from '@/stores/providers'

// 按 provider 区分的尺寸选项
const OPENAI_SIZES: { labelKey: string; value: ImageSize }[] = [
  { labelKey: 'generate.sizes.1024x1024', value: '1024x1024' },
  { labelKey: 'generate.sizes.1024x1536', value: '1024x1536' },
  { labelKey: 'generate.sizes.1536x1024', value: '1536x1024' },
  { labelKey: 'generate.sizes.512x512', value: '512x512' },
  { labelKey: 'generate.sizes.768x768', value: '768x768' },
  { labelKey: 'generate.sizes.256x256', value: '256x256' }
]

// 4.0 默认不传 width/height，由模型智能判断
// 如需指定，推荐 2K 及以上分辨率
const JIMENG_V40_SIZES = [
  { label: '2048×2048 (2K)', value: '2048x2048' },
  { label: '2560×1440 (2K 16:9)', value: '2560x1440' },
  { label: '1440×2560 (2K 9:16)', value: '1440x2560' },
  { label: '2304×1728 (4:3)', value: '2304x1728' },
  { label: '1728×2304 (3:4)', value: '1728x2304' },
  { label: '2496×1664 (3:2)', value: '2496x1664' },
  { label: '1664×2496 (2:3)', value: '1664x2496' },
  { label: '3024×1296 (21:9)', value: '3024x1296' },
  { label: '1296×3024 (9:21)', value: '1296x3024' },
  { label: '4096×4096 (4K)', value: '4096x4096' },
  { label: '5404×3040 (4K 16:9)', value: '5404x3040' }
]

const JIMENG_V31_SIZES = [
  { label: '1328×1328', value: '1328x1328' },
  { label: '1664×936', value: '1664x936' },
  { label: '936×1664', value: '936x1664' },
  { label: '1472×1104', value: '1472x1104' },
  { label: '1104×1472', value: '1104x1472' },
  { label: '1584×1056', value: '1584x1056' },
  { label: '1056×1584', value: '1056x1584' },
  { label: '2016×864', value: '2016x864' },
  { label: '864×2016', value: '864x2016' }
]

const ASPECT_RATIOS = [
  { labelKey: 'generate.aspectRatios.1:1', value: '1:1' },
  { labelKey: 'generate.aspectRatios.16:9', value: '16:9' },
  { labelKey: 'generate.aspectRatios.9:16', value: '9:16' },
  { labelKey: 'generate.aspectRatios.4:3', value: '4:3' },
  { labelKey: 'generate.aspectRatios.3:4', value: '3:4' },
  { labelKey: 'generate.aspectRatios.3:2', value: '3:2' },
  { labelKey: 'generate.aspectRatios.2:3', value: '2:3' }
]

const QUALITIES: { labelKey: string; value: ImageQuality }[] = [
  { labelKey: 'generate.qualities.standard', value: 'standard' },
  { labelKey: 'generate.qualities.hd', value: 'hd' },
  { labelKey: 'generate.qualities.high', value: 'high' },
  { labelKey: 'generate.qualities.medium', value: 'medium' },
  { labelKey: 'generate.qualities.low', value: 'low' }
]

const STYLES: { labelKey: string; value: ImageStyle }[] = [
  { labelKey: 'generate.styles.vivid', value: 'vivid' },
  { labelKey: 'generate.styles.natural', value: 'natural' },
  { labelKey: 'generate.styles.digital-art', value: 'digital-art' },
  { labelKey: 'generate.styles.photographic', value: 'photographic' },
  { labelKey: 'generate.styles.anime', value: 'anime' }
]

export function ParameterPanel() {
  const { t } = useTranslation()
  const { params, setParams } = useGenerationStore()
  const { providers } = useProviderStore()

  // 判断当前 provider 和模型
  const selectedProvider = providers.find((p) => p.id === params.providerId)
  const isJimeng = selectedProvider?.presetId === 'jimeng'
  const isJimengV40 = isJimeng && params.model === 'jimeng-t2i-v40'
  const isJimengV31 = isJimeng && params.model === 'jimeng-t2i-v31'

  // 选择合适的尺寸列表
  let sizeOptions: { label: string; value: string }[] = OPENAI_SIZES.map((s) => ({
    label: t(s.labelKey),
    value: s.value
  }))
  if (isJimengV40) {
    sizeOptions = JIMENG_V40_SIZES.map((s) => ({ label: s.label, value: s.value }))
  } else if (isJimengV31) {
    sizeOptions = JIMENG_V31_SIZES.map((s) => ({ label: s.label, value: s.value }))
  }

  return (
    <div className='space-y-4'>
      <details className='group' open>
        <summary className='text-sm font-medium cursor-pointer list-none flex items-center gap-1 hover:text-[var(--juhe-cyan)] transition-colors text-[var(--juhe-text)]'>
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
          <svg
            className='w-4 h-4 transition-transform group-open:rotate-90'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
          </svg>
          {t('generate.imageParameters')}
        </summary>

        <div className='mt-3 space-y-3 pl-1'>
          {/* Size */}
          <div>
            <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.params.size')}</label>
            <div className='grid grid-cols-3 gap-1.5'>
              {sizeOptions.map((s) => (
                <button
                  type='button'
                  key={s.value}
                  onClick={() => setParams({ size: s.value as ImageSize })}
                  className={`px-2 py-1.5 rounded-md text-xs transition-colors ${
                    params.size === s.value
                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                      : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio - only for Jimeng */}
          {isJimeng && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.params.aspectRatio')}</label>
              <div className='grid grid-cols-4 gap-1.5'>
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    type='button'
                    key={ar.value}
                    onClick={() => setParams({ aspectRatio: ar.value })}
                    className={`px-2 py-1.5 rounded-md text-xs transition-colors ${
                      params.aspectRatio === ar.value
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {t(ar.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quality */}
          <div>
            <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.params.quality')}</label>
            <div className='flex gap-1.5 flex-wrap'>
              {QUALITIES.map((q) => (
                <button
                  type='button'
                  key={q.value}
                  onClick={() => setParams({ quality: q.value })}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    params.quality === q.value
                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                      : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                  }`}
                >
                  {t(q.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.params.style')}</label>
            <div className='flex gap-1.5 flex-wrap'>
              {STYLES.map((s) => (
                <button
                  type='button'
                  key={s.value}
                  onClick={() => setParams({ style: s.value })}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    params.style === s.value
                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                      : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                  }`}
                >
                  {t(s.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Number of images */}
          <div>
            <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
              {t('generate.params.number')}: {params.n}
            </label>
            <input
              type='range'
              min={1}
              max={4}
              value={params.n ?? 1}
              onChange={(e) => setParams({ n: Number(e.target.value) })}
              className='w-full accent-[var(--juhe-cyan)]'
            />
            <div className='flex justify-between text-[10px] text-[var(--juhe-text-3)] mt-0.5'>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
            </div>
          </div>

          {/* Seed */}
          <div>
            <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.params.seed')}</label>
            <div className='flex gap-2'>
              <input
                type='number'
                value={params.seed ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  const num = val ? Number(val) : undefined
                  if (num !== undefined && (num < -99999999 || num > 99999999)) return
                  setParams({ seed: num })
                }}
                placeholder={t('generate.params.random')}
                min={-99999999}
                max={99999999}
                className='flex-1 px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                           focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
              />
              <button
                type='button'
                onClick={() => setParams({ seed: Math.floor(Math.random() * 99999999) })}
                className='px-2.5 py-1.5 rounded-md bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-xs text-[var(--juhe-text-2)] transition-colors'
                title={t('generate.params.randomSeed')}
              >
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
              </button>
              <button
                type='button'
                onClick={() => setParams({ seed: undefined })}
                className='px-2.5 py-1.5 rounded-md bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-xs text-[var(--juhe-text-2)] transition-colors'
                title={t('generate.params.clearSeed')}
              >
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
          </div>

          {/* ===== 智能扩图参数 ===== */}
          {params.model === 'jimeng-outpainting' && (
            <div className='space-y-2 pt-2 border-t border-[var(--juhe-border)]'>
              <label className='text-xs font-medium text-[var(--juhe-cyan)]'>{t('generate.params.outpainting')}</label>
              {[
                { key: 'outpaintTop', label: t('generate.outpaint.top') },
                { key: 'outpaintBottom', label: t('generate.outpaint.bottom') },
                { key: 'outpaintLeft', label: t('generate.outpaint.left') },
                { key: 'outpaintRight', label: t('generate.outpaint.right') }
              ].map(({ key, label }) => (
                <div key={key} className='flex items-center gap-2'>
                  <label className='text-xs text-[var(--juhe-text-2)] w-12'>{label}</label>
                  <input
                    type='range'
                    min={0}
                    max={1}
                    step={0.05}
                    value={(params as unknown as Record<string, number>)[key] ?? 0}
                    onChange={(e) => setParams({ [key]: Number(e.target.value) } as Partial<typeof params>)}
                    className='flex-1 accent-[var(--juhe-cyan)]'
                  />
                  <span className='text-xs text-[var(--juhe-text-2)] w-10 text-right'>
                    {Math.round(((params as unknown as Record<string, number>)[key] ?? 0) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ===== 智能超清参数 ===== */}
          {params.model === 'jimeng-super-resolution' && (
            <div className='space-y-2 pt-2 border-t border-[var(--juhe-border)]'>
              <label className='text-xs font-medium text-[var(--juhe-cyan)]'>
                {t('generate.params.superResolution')}
              </label>
              <div className='flex gap-1.5'>
                {(['4k', '8k'] as const).map((res) => (
                  <button
                    type='button'
                    key={res}
                    onClick={() => setParams({ resolution: res })}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      params.resolution === res
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {res.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== 素材提取参数 ===== */}
          {(params.model === 'jimeng-extract-product' || params.model === 'jimeng-extract-pod') && (
            <div className='space-y-2 pt-2 border-t border-[var(--juhe-border)]'>
              <label className='text-xs font-medium text-[var(--juhe-cyan)]'>{t('generate.params.extraction')}</label>
              <input
                type='text'
                value={params.editPrompt ?? ''}
                onChange={(e) => setParams({ editPrompt: e.target.value })}
                placeholder={t('generate.extraction.placeholder')}
                className='w-full px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                           focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
              />
              {params.model === 'jimeng-extract-pod' && (
                <div className='flex items-center gap-2'>
                  <label className='text-xs text-[var(--juhe-text-2)]'>{t('generate.loraWeight')}</label>
                  <input
                    type='range'
                    min={0}
                    max={1}
                    step={0.05}
                    value={params.loraWeight ?? 0.5}
                    onChange={(e) => setParams({ loraWeight: Number(e.target.value) })}
                    className='flex-1 accent-[var(--juhe-cyan)]'
                  />
                  <span className='text-xs text-[var(--juhe-text-2)] w-10 text-right'>
                    {Math.round((params.loraWeight ?? 0.5) * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ===== 动作模仿参数 ===== */}
          {(params.model === 'jimeng-dream-actor' || params.model === 'jimeng-dream-actor-v2') && (
            <div className='space-y-2 pt-2 border-t border-[var(--juhe-border)]'>
              <label className='text-xs font-medium text-[var(--juhe-cyan)]'>{t('generate.params.dreamActor')}</label>
              <input
                type='text'
                value={params.videoUrl ?? ''}
                onChange={(e) => setParams({ videoUrl: e.target.value })}
                placeholder={t('generate.dreamActor.videoUrlPlaceholder')}
                className='w-full px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                           focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
              />
              {params.model === 'jimeng-dream-actor-v2' && (
                <label className='flex items-center gap-2 text-xs text-[var(--juhe-text-2)]'>
                  <input
                    type='checkbox'
                    checked={params.cutResultFirstSecond ?? false}
                    onChange={(e) => setParams({ cutResultFirstSecond: e.target.checked })}
                    className='accent-[var(--juhe-cyan)]'
                  />
                  {t('generate.dreamActor.cutFirstSecond')}
                </label>
              )}
            </div>
          )}

          {/* ===== 小云雀营销成片参数 ===== */}
          {params.model === 'jimeng-pippit-marketing' && (
            <div className='space-y-2 pt-2 border-t border-[var(--juhe-border)]'>
              <label className='text-xs font-medium text-[var(--juhe-cyan)]'>{t('generate.params.marketing')}</label>
              <input
                type='text'
                value={params.productName ?? ''}
                onChange={(e) => setParams({ productName: e.target.value })}
                placeholder={t('generate.marketing.productNamePlaceholder')}
                className='w-full px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                           focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
              />
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
