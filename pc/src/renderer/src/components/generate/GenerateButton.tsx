import { Image, ImagePlus, Loader2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { error as toastError } from '@/components/ui/toast'
import { initGenerationProgressListener, useGenerationStore } from '@/stores/generation'

interface GenerateButtonProps {
  genMode?: 'image' | 'video' | 'img2img'
  buttonRef?: React.Ref<HTMLButtonElement>
}

const COOLDOWN_MS = 1000

export function GenerateButton({ genMode = 'image', buttonRef }: GenerateButtonProps) {
  const { t } = useTranslation()
  const { params, isGenerating, createTask, activeTaskId, cancelTask, setParams } = useGenerationStore()
  const [autoOptimizing, setAutoOptimizing] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  // Initialize progress listener
  useEffect(() => {
    initGenerationProgressListener()
    return () => {
      // cleanup handled at module level
    }
  }, [])

  // img2img requires a source image
  const hasSourceImage = genMode === 'img2img' ? !!(params.firstFrame || params.referenceImages?.length) : true
  const canGenerate = (params.prompt?.trim().length ?? 0) > 0 && params.providerId && params.model && hasSourceImage

  const handleGenerate = async () => {
    if (cooldown) return
    if (!canGenerate) return

    // Start cooldown
    setCooldown(true)
    setTimeout(() => setCooldown(false), COOLDOWN_MS)

    let taskParams = params

    // Auto-optimize prompt if enabled (skip for img2img)
    if (params.autoOptimize && genMode !== 'img2img') {
      setAutoOptimizing(true)
      try {
        const res = await window.api.prompt.optimize({
          prompt: params.prompt,
          mode: 'enhance',
          providerId: params.optimizerProviderId || undefined,
          modelId: params.optimizerModel || undefined
        })
        if (res?.optimized) {
          setParams({ prompt: res.optimized })
          taskParams = { ...params, prompt: res.optimized }
        }
      } catch (err) {
        console.error('Auto-optimize failed:', err)
        toastError({ description: '自动优化提示词失败，将使用原始提示词生成' })
      } finally {
        setAutoOptimizing(false)
      }
    }

    // For img2img, use image type with reference images
    const taskType = genMode === 'img2img' ? 'image' : genMode
    await createTask(taskType, taskParams)
  }

  const handleCancel = async () => {
    if (activeTaskId) {
      await cancelTask(activeTaskId)
    }
  }

  const isBusy = autoOptimizing
  const isDisabled = cooldown || isBusy || !canGenerate

  const buttonConfig = {
    image: {
      icon: Image,
      label: t('generate.generateButton.generateImage')
    },
    video: {
      icon: Video,
      label: t('generate.generateButton.generateVideo')
    },
    img2img: {
      icon: ImagePlus,
      label: t('generate.generateButton.generateImg2Img')
    }
  }

  const config = buttonConfig[genMode]
  const Icon = config.icon

  return (
    <div className='flex gap-2'>
      {/* Generate button - always available (with cooldown) */}
      <button
        ref={buttonRef}
        type='button'
        onClick={handleGenerate}
        disabled={isDisabled}
        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
          isDisabled
            ? 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] cursor-not-allowed'
            : 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] shadow-lg shadow-[var(--juhe-cyan)]/20'
        }`}
      >
        <span className='flex items-center justify-center gap-2'>
          {isBusy ? (
            <Loader2 className='w-4 h-4 animate-spin' />
          ) : cooldown ? (
            <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
              <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
              <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
            </svg>
          ) : (
            <Icon className='w-4 h-4' />
          )}
          {isBusy ? t('generate.generateButton.optimizing') : config.label}
        </span>
      </button>

      {/* Cancel button - only shown when a task is running */}
      {isGenerating && activeTaskId && (
        <button
          type='button'
          onClick={handleCancel}
          className='px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/20'
          title={t('generate.generateButton.cancelImage')}
        >
          <span className='flex items-center gap-1.5'>
            <span className='size-2.5 rounded-full bg-[var(--juhe-magenta)] animate-pulse' />
            {t('generate.generateButton.cancelImage')}
          </span>
        </button>
      )}
    </div>
  )
}
