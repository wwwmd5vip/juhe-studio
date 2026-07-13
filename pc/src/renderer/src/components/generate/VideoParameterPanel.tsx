import { ArrowRight, Film, Globe, ImagePlus, Layers, Type, Upload, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation'
import { useProviderStore } from '@/stores/providers'

const DURATIONS = [5, 10]
const PIPPIT_DURATIONS = [
  { label: '~15s', value: '~15s' },
  { label: '~30s', value: '~30s' },
  { label: '40~60s', value: '40~60s' }
]
const ASPECT_RATIOS = [
  { label: 'generate.videoParams.aspectRatio_16_9', value: '16:9' },
  { label: 'generate.videoParams.aspectRatio_9_16', value: '9:16' },
  { label: 'generate.videoParams.aspectRatio_1_1', value: '1:1' },
  { label: 'generate.videoParams.aspectRatio_4_3', value: '4:3' }
]
const PIPPIT_ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' }
]

const VIDEO_MODELS = [
  { id: 'kling-3.0', label: 'Kling 3.0', description: 'generate.videoParams.provider_luma' },
  { id: 'seedance-2.0', label: 'Seedance 2.0', description: 'generate.videoParams.provider_kling' },
  { id: 'veo-3.1', label: 'Veo 3.1', description: 'generate.videoParams.provider_veo2' },
  { id: 'wan-2.6', label: 'Wan 2.6', description: 'generate.videoParams.provider_wan21' }
]

const CAMERA_MOTIONS = [
  { id: 'static', label: 'generate.videoParams.motion_static' },
  { id: 'pan', label: 'generate.videoParams.motion_pan' },
  { id: 'zoom_in', label: 'generate.videoParams.motion_zoom_in' },
  { id: 'zoom_out', label: 'generate.videoParams.motion_zoom_out' },
  { id: 'orbit', label: 'generate.videoParams.motion_orbit' }
]

// ===== Jimeng 运镜模板 =====
const JIMENG_CAMERA_TEMPLATES = [
  { id: 'static', label: 'generate.videoParams.jimeng_camera_static' },
  { id: 'pan_left', label: 'generate.videoParams.jimeng_camera_pan_left' },
  { id: 'pan_right', label: 'generate.videoParams.jimeng_camera_pan_right' },
  { id: 'tilt_up', label: 'generate.videoParams.jimeng_camera_tilt_up' },
  { id: 'tilt_down', label: 'generate.videoParams.jimeng_camera_tilt_down' },
  { id: 'zoom_in', label: 'generate.videoParams.jimeng_camera_zoom_in' },
  { id: 'zoom_out', label: 'generate.videoParams.jimeng_camera_zoom_out' },
  { id: 'orbit', label: 'generate.videoParams.jimeng_camera_orbit' },
  { id: 'dolly_in', label: 'generate.videoParams.jimeng_camera_dolly_in' },
  { id: 'dolly_out', label: 'generate.videoParams.jimeng_camera_dolly_out' }
]

// ===== 小云雀语言选项 =====
const PIPPIT_LANGUAGES = [
  { label: 'generate.videoParams.lang_chinese', value: 'Chinese' },
  { label: 'generate.videoParams.lang_english', value: 'English' },
  { label: 'generate.videoParams.lang_japanese', value: 'Japanese' },
  { label: 'generate.videoParams.lang_korean', value: 'Korean' },
  { label: 'generate.videoParams.lang_french', value: 'French' },
  { label: 'generate.videoParams.lang_german', value: 'German' },
  { label: 'generate.videoParams.lang_spanish', value: 'Spanish' },
  { label: 'generate.videoParams.lang_italian', value: 'Italian' },
  { label: 'generate.videoParams.lang_portuguese', value: 'Portuguese' },
  { label: 'generate.videoParams.lang_russian', value: 'Russian' },
  { label: 'generate.videoParams.lang_arabic', value: 'Arabic' },
  { label: 'generate.videoParams.lang_thai', value: 'Thai' },
  { label: 'generate.videoParams.lang_turkish', value: 'Turkish' },
  { label: 'generate.videoParams.lang_vietnamese', value: 'Vietnamese' },
  { label: 'generate.videoParams.lang_indonesian', value: 'Indonesian' },
  { label: 'generate.videoParams.lang_malay', value: 'Malay' },
  { label: 'generate.videoParams.lang_filipino', value: 'Filipino' },
  { label: 'generate.videoParams.lang_dutch', value: 'Dutch' },
  { label: 'generate.videoParams.lang_afrikaans', value: 'SouthAfrican' }
]

// ===== Jimeng 模型类型检测 =====
function getJimengModelType(
  model: string
):
  | 't2v'
  | 'i2v-first'
  | 'i2v-first-tail'
  | 'i2v-recamera'
  | 'i2v-s2'
  | 'dream-actor'
  | 'pippit-marketing'
  | 'pippit-video'
  | 'pippit-video-with-ref'
  | null {
  if (!model?.startsWith('jimeng-')) return null
  if (model.includes('first-tail')) return 'i2v-first-tail'
  if (model.includes('recamera')) return 'i2v-recamera'
  if (model.includes('s2')) return 'i2v-s2'
  if (model.includes('first')) return 'i2v-first'
  if (model.includes('dream-actor')) return 'dream-actor'
  if (model.includes('pippit-marketing')) return 'pippit-marketing'
  if (model.includes('pippit-video-v2-with-ref')) return 'pippit-video-with-ref'
  if (model.includes('pippit-video')) return 'pippit-video'
  if (model.includes('pippit')) return 'pippit-video'
  return 't2v'
}

export function VideoParameterPanel() {
  const { t } = useTranslation()
  const { params, setParams } = useGenerationStore()
  const { providers } = useProviderStore()

  const isJimengModel = params.model?.startsWith('jimeng-')
  const jimengType = getJimengModelType(params.model || '')
  const selectedProvider = providers.find((p) => p.id === params.providerId)
  const isJimengProvider = selectedProvider?.presetId === 'jimeng'
  const showVideoModelSelector = !isJimengModel && !isJimengProvider

  const isPippit = jimengType?.startsWith('pippit')
  const isPippitMarketing = jimengType === 'pippit-marketing'
  const isPippitVideoWithRef = jimengType === 'pippit-video-with-ref'

  // 处理图片上传
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'firstFrame' | 'lastFrame' | 'reference' | 'model'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      if (target === 'firstFrame') {
        setParams({ firstFrame: dataUrl })
      } else if (target === 'lastFrame') {
        setParams({ lastFrame: dataUrl })
      } else if (target === 'reference') {
        const newImages = [...(params.referenceImages || []), dataUrl]
        setParams({ referenceImages: newImages })
      } else if (target === 'model') {
        const newImages = [...(params.modelImages || []), dataUrl]
        setParams({ modelImages: newImages })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // 处理视频URL输入
  const handleVideoUrlAdd = () => {
    const url = window.prompt(t('generate.videoParams.referenceVideoUrlPrompt'))
    if (!url) return
    const newUrls = [...(params.videoUrls || []), url]
    setParams({ videoUrls: newUrls })
  }

  const removeReferenceImage = (index: number) => {
    const newImages = (params.referenceImages || []).filter((_, i) => i !== index)
    setParams({ referenceImages: newImages })
  }

  const removeModelImage = (index: number) => {
    const newImages = (params.modelImages || []).filter((_, i) => i !== index)
    setParams({ modelImages: newImages })
  }

  const removeVideoUrl = (index: number) => {
    const newUrls = (params.videoUrls || []).filter((_, i) => i !== index)
    setParams({ videoUrls: newUrls })
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
          {t('generate.videoParams.videoParameters')}
        </summary>

        <div className='mt-3 space-y-3 pl-1'>
          {/* ===== Jimeng 模型类型提示 ===== */}
          {isJimengModel && jimengType && (
            <div className='p-2 rounded-lg bg-[var(--juhe-cyan)]/5 border border-[var(--juhe-cyan)]/20'>
              <p className='text-xs text-[var(--juhe-cyan)] font-medium'>
                {jimengType === 't2v' && t('generate.videoParams.jimeng_hint_t2v')}
                {jimengType === 'i2v-first' && t('generate.videoParams.jimeng_hint_i2v_first')}
                {jimengType === 'i2v-first-tail' && t('generate.videoParams.jimeng_hint_i2v_first_tail')}
                {jimengType === 'i2v-recamera' && t('generate.videoParams.jimeng_hint_i2v_recamera')}
                {jimengType === 'i2v-s2' && t('generate.videoParams.jimeng_hint_i2v_s2')}
                {jimengType === 'dream-actor' && t('generate.videoParams.jimeng_hint_dream_actor')}
                {jimengType === 'pippit-marketing' && t('generate.videoParams.jimeng_hint_pippit_marketing')}
                {jimengType === 'pippit-video' && t('generate.videoParams.jimeng_hint_pippit_video')}
                {jimengType === 'pippit-video-with-ref' && t('generate.videoParams.jimeng_hint_pippit_video_with_ref')}
              </p>
            </div>
          )}

          {/* Video Model - only show for non-Jimeng providers */}
          {showVideoModelSelector && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.videoModel')}
              </label>
              <div className='space-y-1'>
                {VIDEO_MODELS.map((m) => (
                  <button
                    type='button'
                    key={m.id}
                    onClick={() => setParams({ videoModel: m.id })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                      params.videoModel === m.id
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    <span className='font-medium'>{m.label}</span>
                    <span className='text-[10px] opacity-70'>{t(m.description)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== 小云雀营销成片 - 产品名称 ===== */}
          {isPippitMarketing && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 flex items-center gap-1'>
                <Type className='w-3 h-3' />
                {t('generate.videoParams.productName')}
              </label>
              <input
                type='text'
                value={params.productName || ''}
                onChange={(e) => setParams({ productName: e.target.value })}
                placeholder={t('generate.videoParams.productNamePlaceholder')}
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)]
                           focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30
                           placeholder:text-[var(--juhe-text-3)]'
              />
            </div>
          )}

          {/* ===== Jimeng 图生视频 - 参考图上传 ===== */}
          {isJimengModel &&
            (jimengType === 'i2v-first' ||
              jimengType === 'i2v-recamera' ||
              jimengType === 'i2v-s2' ||
              jimengType === 'dream-actor') && (
              <div>
                <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                  {jimengType === 'dream-actor'
                    ? t('generate.videoParams.uploadCharacterImage')
                    : t('generate.videoParams.uploadReferenceImage')}
                </label>
                <div className='grid grid-cols-2 gap-2'>
                  {(params.referenceImages || []).map((img: string, idx: number) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                      key={idx}
                      className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'
                    >
                      <img
                        src={img}
                        alt={t('generate.videoParams.referenceImageAlt', { n: idx + 1 })}
                        className='w-full h-full object-cover'
                      />
                      <button
                        type='button'
                        onClick={() => removeReferenceImage(idx)}
                        className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </div>
                  ))}
                  {(params.referenceImages || []).length < 1 && (
                    <label className='aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                      <input
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={(e) => handleImageUpload(e, 'reference')}
                      />
                      <ImagePlus className='w-5 h-5 text-[var(--juhe-text-3)]' />
                      <span className='text-[10px] text-[var(--juhe-text-3)]'>
                        {t('generate.videoParams.clickToUpload')}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

          {/* ===== 小云雀 - 参考图上传（可多张） ===== */}
          {isPippit && !isPippitMarketing && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.referenceImagesLabel', { count: (params.referenceImages || []).length })}
              </label>
              <div className='grid grid-cols-3 gap-2'>
                {(params.referenceImages || []).map((img: string, idx: number) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                    key={idx}
                    className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-square'
                  >
                    <img
                      src={img}
                      alt={t('generate.videoParams.referenceImageAlt', { n: idx + 1 })}
                      className='w-full h-full object-cover'
                    />
                    <button
                      type='button'
                      onClick={() => removeReferenceImage(idx)}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
                {(params.referenceImages || []).length < 50 && (
                  <label className='aspect-square rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'reference')}
                    />
                    <ImagePlus className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>{t('generate.videoParams.addImage')}</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ===== 小云雀营销成片 - 商品图上传 ===== */}
          {isPippitMarketing && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.productMainImage')}
              </label>
              <div className='grid grid-cols-2 gap-2'>
                {(params.referenceImages || []).map((img: string, idx: number) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                    key={idx}
                    className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'
                  >
                    <img
                      src={img}
                      alt={t('generate.videoParams.productImageAlt', { n: idx + 1 })}
                      className='w-full h-full object-cover'
                    />
                    <button
                      type='button'
                      onClick={() => removeReferenceImage(idx)}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
                {(params.referenceImages || []).length < 5 && (
                  <label className='aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'reference')}
                    />
                    <ImagePlus className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>
                      {t('generate.videoParams.uploadProductImage')}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ===== 小云雀营销成片 - 模特图上传 ===== */}
          {isPippitMarketing && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.modelImageOptional')}
              </label>
              <div className='grid grid-cols-2 gap-2'>
                {(params.modelImages || []).map((img: string, idx: number) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                    key={idx}
                    className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'
                  >
                    <img
                      src={img}
                      alt={t('generate.videoParams.modelImageAlt', { n: idx + 1 })}
                      className='w-full h-full object-cover'
                    />
                    <button
                      type='button'
                      onClick={() => removeModelImage(idx)}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
                {(params.modelImages || []).length < 5 && (
                  <label className='aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'model')}
                    />
                    <ImagePlus className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>
                      {t('generate.videoParams.uploadModelImage')}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ===== 小云雀有参考视频 - 参考视频URL ===== */}
          {isPippitVideoWithRef && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 flex items-center gap-1'>
                <Film className='w-3 h-3' />
                {t('generate.videoParams.referenceVideoUrlLabel', { count: (params.videoUrls || []).length })}
              </label>
              <div className='space-y-1.5'>
                {(params.videoUrls || []).map((url: string, idx: number) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                    key={idx}
                    className='flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--juhe-surface-2)] text-xs'
                  >
                    <span className='flex-1 truncate text-[var(--juhe-text-2)]'>{url}</span>
                    <button
                      type='button'
                      onClick={() => removeVideoUrl(idx)}
                      className='p-0.5 rounded hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] transition-colors shrink-0'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
                <button
                  type='button'
                  onClick={handleVideoUrlAdd}
                  className='w-full py-1.5 rounded-md border border-dashed border-[var(--juhe-border)] text-xs text-[var(--juhe-text-2)]
                             hover:border-[var(--juhe-cyan)]/50 hover:text-[var(--juhe-cyan)] transition-colors flex items-center justify-center gap-1'
                >
                  <Film className='w-3 h-3' />
                  {t('generate.videoParams.addReferenceVideoUrl')}
                </button>
              </div>
            </div>
          )}

          {/* ===== Jimeng 首尾帧 - 首帧/尾帧上传 ===== */}
          {isJimengModel && jimengType === 'i2v-first-tail' && (
            <div className='grid grid-cols-2 gap-3'>
              {/* 首帧 */}
              <div>
                <label className='text-[10px] text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.firstFrameImage')}
                </label>
                {params.firstFrame ? (
                  <div className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'>
                    <img
                      src={params.firstFrame}
                      alt={t('generate.videoParams.firstFrameAlt')}
                      className='w-full h-full object-cover'
                    />
                    <button
                      type='button'
                      onClick={() => setParams({ firstFrame: null })}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ) : (
                  <label className='w-full aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'firstFrame')}
                    />
                    <Upload className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>
                      {t('generate.videoParams.uploadFirstFrameAlt')}
                    </span>
                  </label>
                )}
              </div>
              {/* 尾帧 */}
              <div>
                <label className='text-[10px] text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.lastFrameImage')}
                </label>
                {params.lastFrame ? (
                  <div className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'>
                    <img
                      src={params.lastFrame}
                      alt={t('generate.videoParams.lastFrameAlt')}
                      className='w-full h-full object-cover'
                    />
                    <button
                      type='button'
                      onClick={() => setParams({ lastFrame: null })}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ) : (
                  <label className='w-full aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'lastFrame')}
                    />
                    <Upload className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>
                      {t('generate.videoParams.uploadLastFrameAlt')}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Duration - 普通视频 */}
          {!isPippit && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.duration')}
              </label>
              <div className='flex gap-1.5'>
                {DURATIONS.map((d) => (
                  <button
                    type='button'
                    key={d}
                    onClick={() => setParams({ duration: d })}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      params.duration === d
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration - 小云雀 */}
          {isPippit && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.videoDuration')}
              </label>
              <div className='flex gap-1.5'>
                {PIPPIT_DURATIONS.map((d) => (
                  <button
                    type='button'
                    key={d.value}
                    // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
                    onClick={() => setParams({ duration: d.value as any })}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      String(params.duration) === d.value
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aspect Ratio - 普通视频 */}
          {!isPippit && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.aspectRatio')}
              </label>
              <div className='grid grid-cols-2 gap-1.5'>
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
                    {t(ar.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aspect Ratio - 小云雀 */}
          {isPippit && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.aspectRatioLabel')}
              </label>
              <div className='grid grid-cols-2 gap-1.5'>
                {PIPPIT_ASPECT_RATIOS.map((ar) => (
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
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FPS - only for non-Jimeng */}
          {!isJimengModel && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.videoParams.fps')}</label>
              <div className='flex gap-1.5'>
                {[24, 30, 60].map((f) => (
                  <button
                    type='button'
                    key={f}
                    onClick={() => setParams({ fps: f })}
                    className={`flex-1 px-2 py-1 rounded-md text-xs transition-colors ${
                      params.fps === f
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {f}fps
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Camera Motion - only for non-Jimeng */}
          {!isJimengModel && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.cameraMotion')}
              </label>
              <div className='flex gap-1.5 flex-wrap'>
                {CAMERA_MOTIONS.map((cm) => (
                  <button
                    type='button'
                    key={cm.id}
                    onClick={() => setParams({ cameraMotion: cm.id as typeof params.cameraMotion })}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      params.cameraMotion === cm.id
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {t(cm.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resolution - only for non-Jimeng */}
          {!isJimengModel && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.resolution')}
              </label>
              <div className='flex gap-1.5'>
                {(['720p', '1080p', '4K'] as const).map((r) => (
                  <button
                    type='button'
                    key={r}
                    onClick={() => setParams({ resolution: r })}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                      params.resolution === r
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Negative Prompt - collapsible, only for non-Jimeng */}
          {!isJimengModel && (
            <details className='group'>
              <summary className='text-xs text-[var(--juhe-text-2)] cursor-pointer hover:text-[var(--juhe-text)] transition-colors list-none flex items-center gap-1'>
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
                <svg
                  className='w-3.5 h-3.5 transition-transform group-open:rotate-90'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                </svg>
                {t('generate.videoParams.negativePrompt')}
              </summary>
              <textarea
                value={params.negativePrompt || ''}
                onChange={(e) => setParams({ negativePrompt: e.target.value })}
                placeholder={t('generate.negativePromptPlaceholder')}
                className='w-full mt-2 px-3 py-2.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                           resize-none min-h-[60px]
                           focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)] focus:border-transparent
                           placeholder:text-[var(--juhe-text-3)]/60'
              />
            </details>
          )}

          {/* Mode Selector - only for non-Jimeng */}
          {!isJimengModel && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>{t('generate.videoParams.mode')}</label>
              <div className='grid grid-cols-4 gap-1 p-1 bg-[var(--juhe-surface-2)] rounded-lg'>
                {[
                  { id: 'text' as const, label: t('generate.videoParams.modeText'), icon: Type },
                  { id: 'image' as const, label: t('generate.videoParams.modeImage'), icon: ImagePlus },
                  { id: 'first-last-frame' as const, label: t('generate.videoParams.modeFirstLast'), icon: ArrowRight },
                  { id: 'multi-reference' as const, label: t('generate.videoParams.modeMultiRef'), icon: Layers }
                ].map((m) => {
                  const Icon = m.icon
                  const active = (params.mode || 'text') === m.id
                  return (
                    <button
                      type='button'
                      key={m.id}
                      onClick={() => setParams({ mode: m.id })}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                        active
                          ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white shadow-sm'
                          : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-3)]'
                      }`}
                    >
                      <Icon className='w-3.5 h-3.5' />
                      <span>{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* First-Last-Frame Mode - only for non-Jimeng */}
          {!isJimengModel && params.mode === 'first-last-frame' && (
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='text-[10px] text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.firstFrame')}
                </label>
                {params.firstFrame ? (
                  <div className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'>
                    <img src={params.firstFrame} alt='First Frame' className='w-full h-full object-cover' />
                    <button
                      type='button'
                      onClick={() => setParams({ firstFrame: null })}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ) : (
                  <label className='w-full aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'firstFrame')}
                    />
                    <Upload className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>
                      {t('generate.videoParams.uploadFirstFrame')}
                    </span>
                  </label>
                )}
              </div>
              <div>
                <label className='text-[10px] text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.lastFrame')}
                </label>
                {params.lastFrame ? (
                  <div className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'>
                    <img src={params.lastFrame} alt='Last Frame' className='w-full h-full object-cover' />
                    <button
                      type='button'
                      onClick={() => setParams({ lastFrame: null })}
                      className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ) : (
                  <label className='w-full aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                    <input
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={(e) => handleImageUpload(e, 'lastFrame')}
                    />
                    <Upload className='w-5 h-5 text-[var(--juhe-text-3)]' />
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>
                      {t('generate.videoParams.uploadLastFrame')}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Image Mode - only for non-Jimeng */}
          {!isJimengModel && params.mode === 'image' && (
            <div className='space-y-3'>
              <div>
                <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.referenceImage')}
                </label>
                <div className='grid grid-cols-2 gap-2'>
                  {(params.referenceImages || []).map((img: string, idx: number) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                      key={idx}
                      className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-video'
                    >
                      <img src={img} alt={`Reference ${idx + 1}`} className='w-full h-full object-cover' />
                      <button
                        type='button'
                        onClick={() => {
                          const newImages = (params.referenceImages || []).filter((_, i) => i !== idx)
                          setParams({ referenceImages: newImages })
                        }}
                        className='absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    </div>
                  ))}
                  {(params.referenceImages || []).length < 4 && (
                    <label className='aspect-video rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer'>
                      <input
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={(e) => handleImageUpload(e, 'reference')}
                      />
                      <ImagePlus className='w-5 h-5 text-[var(--juhe-text-3)]' />
                      <span className='text-[10px] text-[var(--juhe-text-3)]'>
                        {t('common.upload')} ({(params.referenceImages || []).length}/4)
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.motionStrength')}: {params.motionStrength}%
                </label>
                <input
                  type='range'
                  min={0}
                  max={100}
                  value={params.motionStrength}
                  onChange={(e) => setParams({ motionStrength: Number(e.target.value) })}
                  className='w-full h-2 bg-[var(--juhe-surface-2)] rounded-lg appearance-none cursor-pointer accent-[var(--juhe-cyan)]'
                />
                <div className='flex justify-between text-[10px] text-[var(--juhe-text-3)] mt-1'>
                  <span>{t('imageProcess.params.conservative')}</span>
                  <span>{t('imageProcess.params.aggressive')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Reference Mode - only for non-Jimeng */}
          {!isJimengModel && params.mode === 'multi-reference' && (
            <div className='space-y-2'>
              <div>
                <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                  {t('generate.videoParams.referenceImages')}
                </label>
                <div className='space-y-2'>
                  {(params.referenceImages || []).map((img: string, idx: number) => {
                    const currentTag = (params.referenceTags || [])[idx] || 'character'
                    const REF_TAGS = [
                      { value: 'character', label: t('generate.videoParams.tagCharacter') },
                      { value: 'scene', label: t('generate.videoParams.tagScene') },
                      { value: 'object', label: t('generate.videoParams.tagObject') },
                      { value: 'style', label: t('generate.videoParams.tagStyle') }
                    ] as const
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={idx} className='flex gap-2 items-center'>
                        <div className='relative group w-16 h-16 rounded-lg overflow-hidden border border-[var(--juhe-border)] shrink-0'>
                          <img src={img} alt={`Reference ${idx + 1}`} className='w-full h-full object-cover' />
                          <button
                            type='button'
                            onClick={() => {
                              const newImages = (params.referenceImages || []).filter((_, i) => i !== idx)
                              const newTags = (params.referenceTags || []).filter((_, i) => i !== idx)
                              setParams({ referenceImages: newImages, referenceTags: newTags })
                            }}
                            className='absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                          >
                            <X className='w-2.5 h-2.5' />
                          </button>
                        </div>
                        <div className='flex-1 min-w-0'>
                          <label className='text-[10px] text-[var(--juhe-text-3)] block mb-1'>
                            {t('generate.videoParams.referenceTag')}
                          </label>
                          <div className='flex gap-1'>
                            {REF_TAGS.map((tag) => {
                              const active = currentTag === tag.value
                              return (
                                <button
                                  type='button'
                                  key={tag.value}
                                  onClick={() => {
                                    const newTags = [...(params.referenceTags || [])]
                                    newTags[idx] = tag.value
                                    setParams({ referenceTags: newTags })
                                  }}
                                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                                    active
                                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                                      : 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-2)] hover:bg-[var(--juhe-surface-3)]'
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {(params.referenceImages || []).length < 4 && (
                    <label className='w-full py-3 rounded-lg border-2 border-dashed border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/50 bg-[var(--juhe-surface)]/50 flex items-center justify-center gap-2 transition-colors cursor-pointer'>
                      <input
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={(e) => handleImageUpload(e, 'reference')}
                      />
                      <ImagePlus className='w-4 h-4 text-[var(--juhe-text-3)]' />
                      <span className='text-xs text-[var(--juhe-text-3)]'>
                        {t('common.upload')} ({(params.referenceImages || []).length}/4)
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== Jimeng 运镜模板（仅 recamera） ===== */}
          {isJimengModel && jimengType === 'i2v-recamera' && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.cameraMethod')}
              </label>
              <div className='flex gap-1.5 flex-wrap'>
                {JIMENG_CAMERA_TEMPLATES.map((tmpl) => (
                  <button
                    type='button'
                    key={tmpl.id}
                    onClick={() => setParams({ camera: tmpl.id })}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      params.camera === tmpl.id
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {t(tmpl.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Camera Strength - for Jimeng recamera */}
          {isJimengModel && jimengType === 'i2v-recamera' && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 block'>
                {t('generate.videoParams.cameraStrength')}
              </label>
              <div className='flex gap-1.5'>
                {(['weak', 'medium', 'strong'] as const).map((s) => (
                  <button
                    type='button'
                    key={s}
                    onClick={() => setParams({ cameraStrength: s })}
                    className={`flex-1 px-2 py-1 rounded-md text-xs transition-colors ${
                      params.cameraStrength === s
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-surface-3)] text-[var(--juhe-text-2)]'
                    }`}
                  >
                    {t(`generate.videoParams.strength_${s}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== 小云雀语言选择 ===== */}
          {isPippit && (
            <div>
              <label className='text-xs text-[var(--juhe-text-2)] mb-1 flex items-center gap-1'>
                <Globe className='w-3 h-3' />
                {t('generate.videoParams.language')}
              </label>
              <select
                value={params.language || 'Chinese'}
                onChange={(e) => setParams({ language: e.target.value })}
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)]
                           focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
              >
                {PIPPIT_LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {t(lang.label)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ===== 小云雀水印开关 ===== */}
          {isPippit && (
            <div className='flex items-center justify-between'>
              <label className='text-xs text-[var(--juhe-text-2)]'>{t('generate.videoParams.enableWatermark')}</label>
              <button
                type='button'
                onClick={() => setParams({ enableWatermark: !(params.enableWatermark ?? true) })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  (params.enableWatermark ?? true) ? 'bg-[var(--juhe-cyan)]' : 'bg-[var(--juhe-text-dim)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    (params.enableWatermark ?? true) ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Cost Estimate */}
          <div className='p-2 rounded-md bg-[var(--juhe-surface)]/50'>
            <div className='flex items-center justify-between text-[10px] text-[var(--juhe-text-2)]'>
              <span>{t('generate.videoParams.estimatedCost')}</span>
              <span>~${((typeof params.duration === 'number' ? params.duration : 5) * 0.05).toFixed(2)}</span>
            </div>
            <div className='text-[10px] text-[var(--juhe-text-3)] mt-0.5'>
              {t('generate.videoParams.generationTimeNote')}
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}
