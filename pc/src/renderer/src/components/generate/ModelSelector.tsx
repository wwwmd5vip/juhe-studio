import type { Model } from '@shared/types/provider'
import { AlertCircle, Loader2, Pin, PinOff } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/stores/generation'
import { useProviderStore } from '@/stores/providers'

interface ModelSelectorProps {
  /** 生成模式：image 只显示 image 模型，video 只显示 video 模型，img2img 显示 image 模型 */
  mode?: 'image' | 'video' | 'img2img'
}

export function ModelSelector({ mode }: ModelSelectorProps = {}) {
  const { t } = useTranslation()
  const { providers, loadProviders, isLoading, error } = useProviderStore()
  const { params, setParams, defaultModels, setDefaultModel } = useGenerationStore()

  useEffect(() => {
    const start = performance.now()
    console.log(`[ModelSelector] ⏱️ loadProviders() started at ${start.toFixed(1)}ms`)
    // Defer provider loading to next frame to allow initial render to paint first
    const timer = setTimeout(() => {
      loadProviders()
        .then(() => {
          const end = performance.now()
          console.log(
            `[ModelSelector] ⏱️ loadProviders() completed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms)`
          )
        })
        .catch((err) => {
          const end = performance.now()
          console.error(
            `[ModelSelector] ⏱️ loadProviders() failed at ${end.toFixed(1)}ms (+${(end - start).toFixed(1)}ms):`,
            err
          )
        })
    }, 0)
    return () => clearTimeout(timer)
  }, [loadProviders])

  // 判断模型是否匹配当前模式（针对 Jimeng 等特殊 provider 做精确过滤）
  const modelMatchesMode = useCallback((m: Model): boolean => {
    if (!mode) return true
    const caps = Array.isArray(m.capabilities) ? m.capabilities : []
    const name = m.name || ''

    // Jimeng 模型精确匹配：不按 capabilities，按模型名称前缀
    if (name.startsWith('jimeng-')) {
      // 图生图模式：只显示图生图3.0
      if (mode === 'img2img') {
        return name === 'jimeng-i2i-v30'
      }
      // 视频模式：显示所有视频相关接口
      if (mode === 'video') {
        return (
          name.startsWith('jimeng-t2v-') ||
          name.startsWith('jimeng-i2v-') ||
          name.startsWith('jimeng-dream-actor') ||
          name.startsWith('jimeng-pippit-video') ||
          name === 'jimeng-pippit-marketing'
        )
      }
      // 图片模式：显示所有图片生成/编辑接口
      if (mode === 'image') {
        return (
          name.startsWith('jimeng-t2i-') ||
          name === 'jimeng-i2i-v30' ||
          name === 'jimeng-seedream46-cvtob' ||
          name === 'jimeng-outpainting' ||
          name === 'jimeng-super-resolution' ||
          name === 'jimeng-inpainting' ||
          name === 'jimeng-extract-product' ||
          name === 'jimeng-extract-pod'
        )
      }
      return true
    }

    // 其他模型按 capabilities 过滤
    if (mode === 'img2img') return caps.includes('image')
    return caps.includes(mode)
  }, [mode])

  // 只显示已启用且包含符合能力要求模型的 provider
  const availableProviders = useMemo(() => {
    return providers
      .filter((p) => p.isEnabled)
      .map((p) => ({
        ...p,
        models: mode ? p.models.filter((m) => m.isEnabled && modelMatchesMode(m)) : p.models.filter((m) => m.isEnabled)
      }))
      .filter((p) => p.models.length > 0)
  }, [providers, mode, modelMatchesMode])

  // 当前选中的 provider
  const selectedProvider = useMemo(
    () => availableProviders.find((p) => p.id === params.providerId),
    [availableProviders, params.providerId]
  )

  // 当前 provider 的模型列表
  const availableModels = useMemo(() => selectedProvider?.models || [], [selectedProvider])

  // 获取当前模式的默认模型配置
  const modeKey = mode || 'image'
  const savedDefault = defaultModels[modeKey]
  const isCurrentPinned = savedDefault?.providerId === params.providerId && savedDefault?.model === params.model

  // 当模式切换或 provider 列表变化时，优先使用用户保存的默认模型
  useEffect(() => {
    if (availableProviders.length === 0) return

    // 如果有保存的默认模型且仍然可用，优先使用它
    if (savedDefault) {
      const providerStillAvailable = availableProviders.find((p) => p.id === savedDefault.providerId)
      const modelStillAvailable = providerStillAvailable?.models.find((m) => m.name === savedDefault.model)
      if (providerStillAvailable && modelStillAvailable) {
        // 仅当当前选择无效时才恢复默认
        const currentModel = availableModels.find((m) => m.name === params.model)
        const isCurrentValid = selectedProvider && currentModel !== undefined
        if (!isCurrentValid) {
          setParams({
            providerId: savedDefault.providerId,
            model: savedDefault.model
          })
          return
        }
      }
    }

    // 检查当前选择是否对当前模式有效
    const currentModel = availableModels.find((m) => m.name === params.model)
    let isValid = selectedProvider && currentModel !== undefined

    // Jimeng 模型特殊处理
    if (isValid && params.model?.startsWith('jimeng-')) {
      const isImageMode = mode === 'image' || mode === 'img2img'
      const isVideoMode = mode === 'video'
      const isImageModel =
        params.model.startsWith('jimeng-t2i-') ||
        params.model === 'jimeng-i2i-v30' ||
        params.model === 'jimeng-seedream46-cvtob' ||
        params.model === 'jimeng-outpainting' ||
        params.model === 'jimeng-super-resolution' ||
        params.model === 'jimeng-inpainting' ||
        params.model === 'jimeng-extract-product' ||
        params.model === 'jimeng-extract-pod'
      const isVideoModel =
        params.model.startsWith('jimeng-t2v-') ||
        params.model.startsWith('jimeng-i2v-') ||
        params.model.startsWith('jimeng-dream-actor') ||
        params.model.startsWith('jimeng-pippit-video') ||
        params.model === 'jimeng-pippit-marketing'

      if (isImageMode && !isImageModel) isValid = false
      if (isVideoMode && !isVideoModel) isValid = false
    }

    if (!isValid) {
      const fallback = availableProviders[0]
      const fallbackModel = mode
        ? fallback.models.find((m) => {
            const name = m.name || ''
            if (mode === 'img2img') {
              return name === 'jimeng-i2i-v30' || m.capabilities?.includes('image')
            }
            if (mode === 'video') {
              return (
                name.startsWith('jimeng-t2v-') ||
                name.startsWith('jimeng-i2v-') ||
                name.startsWith('jimeng-dream-actor') ||
                name.startsWith('jimeng-pippit-video') ||
                name === 'jimeng-pippit-marketing' ||
                m.capabilities?.includes('video')
              )
            }
            return (
              name.startsWith('jimeng-t2i-') ||
              name === 'jimeng-i2i-v30' ||
              name === 'jimeng-seedream46-cvtob' ||
              name === 'jimeng-outpainting' ||
              name === 'jimeng-super-resolution' ||
              name === 'jimeng-inpainting' ||
              name === 'jimeng-extract-product' ||
              name === 'jimeng-extract-pod' ||
              m.capabilities?.includes('image')
            )
          })
        : fallback.models[0]
      setParams({
        providerId: fallback.id,
        model: fallbackModel?.name || fallback.models[0]?.name
      })
    }
  }, [availableProviders, selectedProvider, availableModels, params.model, setParams, mode, savedDefault])

  const handleProviderChange = (providerId: string) => {
    const provider = availableProviders.find((p) => p.id === providerId)
    if (!provider) return

    const selectedModel = mode
      ? provider.models.find((m) => {
          const name = m.name || ''
          if (mode === 'img2img') {
            return name === 'jimeng-i2i-v30' || m.capabilities?.includes('image')
          }
          if (mode === 'video') {
            return (
              name.startsWith('jimeng-t2v-') ||
              name.startsWith('jimeng-i2v-') ||
              name.startsWith('jimeng-dream-actor') ||
              name.startsWith('jimeng-pippit-video') ||
              name === 'jimeng-pippit-marketing' ||
              m.capabilities?.includes('video')
            )
          }
          return (
            name.startsWith('jimeng-t2i-') ||
            name === 'jimeng-i2i-v30' ||
            name === 'jimeng-seedream46-cvtob' ||
            name === 'jimeng-outpainting' ||
            name === 'jimeng-super-resolution' ||
            name === 'jimeng-inpainting' ||
            name === 'jimeng-extract-product' ||
            name === 'jimeng-extract-pod' ||
            m.capabilities?.includes('image')
          )
        })
      : provider.models[0]

    setParams({
      providerId,
      model: selectedModel?.name || provider.models[0]?.name
    })
  }

  const handlePinDefault = () => {
    if (!params.providerId || !params.model) return
    if (isCurrentPinned) {
      // 取消固定
      // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
            setDefaultModel(modeKey, undefined as any)
    } else {
      setDefaultModel(modeKey, { providerId: params.providerId, model: params.model })
    }
  }

  return (
    <div className='space-y-3'>
      {error && (
        <div className='flex items-center gap-2 p-2 rounded-lg bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] text-xs'>
          <AlertCircle className='w-3.5 h-3.5 shrink-0' />
          {error}
        </div>
      )}
      <div>
        <div className='flex items-center justify-between mb-1.5'>
          <label className='block text-sm font-medium text-[var(--juhe-text)]'>
            {t('generate.modelSelector.provider')}
          </label>
          {params.providerId && params.model && (
            <button
              type='button'
              onClick={handlePinDefault}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                isCurrentPinned
                  ? 'bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                  : 'text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)]'
              }`}
              title={
                isCurrentPinned ? t('generate.modelSelector.unpinDefault') : t('generate.modelSelector.pinDefault')
              }
            >
              {isCurrentPinned ? <Pin className='w-3 h-3' /> : <PinOff className='w-3 h-3' />}
              {isCurrentPinned ? t('generate.modelSelector.pinned') : t('generate.modelSelector.pinDefault')}
            </button>
          )}
        </div>
        <div className='relative'>
          <select
            value={params.providerId || ''}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={isLoading}
            className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)]
                       focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30 disabled:opacity-50'
          >
            <option value=''>{isLoading ? t('common.loading') : t('generate.modelSelector.selectProvider')}</option>
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.models.length} models)
              </option>
            ))}
          </select>
          {isLoading && (
            <Loader2 className='absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[var(--juhe-text-3)]' />
          )}
        </div>
        {availableProviders.length === 0 && !isLoading && (
          <p className='text-xs text-[var(--juhe-text-3)] mt-1'>{t('generate.modelSelector.noProviders')}</p>
        )}
      </div>

      {params.providerId && (
        <div>
          <label className='block text-sm font-medium mb-1.5 text-[var(--juhe-text)]'>
            {t('generate.modelSelector.model')}
          </label>
          <select
            value={params.model || ''}
            onChange={(e) => setParams({ model: e.target.value })}
            className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)]
                       focus:outline-none focus:border-[var(--juhe-cyan)] focus:ring-1 focus:ring-[var(--juhe-cyan)]/30'
          >
            <option value=''>{t('generate.modelSelector.selectModel')}</option>
            {availableModels.map((m) => (
              <option key={m.id} value={m.name}>
                {m.displayName || m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
