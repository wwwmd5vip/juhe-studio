import { createFileRoute, useSearch } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Columns2,
  Image,
  Layers,
  LayoutTemplate,
  Library,
  PersonStanding,
  SlidersHorizontal,
  Sparkles,
  Video,
  Wand2,
  X,
  Zap
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AssistantPanel from '@/components/generate/AssistantPanel'
import { BatchPanel } from '@/components/generate/BatchPanel'
import { TaskProgressPanel } from '@/components/generate/TaskProgressPanel'
import { CollapsibleSection } from '@/components/generate/CollapsibleSection'
import { GenerateButton } from '@/components/generate/GenerateButton'
import { Img2ImgParameterPanel, Img2ImgSourceImage } from '@/components/generate/Img2ImgPanel'
import { ModelSelector } from '@/components/generate/ModelSelector'
import { PoseReferencePanel } from '@/components/generate/PoseReferencePanel'
import { ParameterPanel } from '@/components/generate/ParameterPanel'
import PresetPanel from '@/components/generate/PresetPanel'
import { PromptInput } from '@/components/generate/PromptInput'
import PromptOptimizer from '@/components/generate/PromptOptimizer'
import PromptReverse from '@/components/generate/PromptReverse'
import { ReferenceImages } from '@/components/generate/ReferenceImages'
import { ResultGallery } from '@/components/generate/ResultGallery'
import TemplateLibrary from '@/components/generate/TemplateLibrary'
import { VideoParameterPanel } from '@/components/generate/VideoParameterPanel'
import ImageProcessPanel from '@/components/image-process/ImageProcessPanel'
import { TemplateSelector } from '@/components/industry-templates/TemplateSelector'
import { error as toastError } from '@/components/ui/toast'
import { useGenerationStore } from '@/stores/generation'

export const Route = createFileRoute('/generate')({
  component: GeneratePage
})

type SidePanel = 'preset' | 'template' | 'image-process' | 'batch' | 'task-progress' | 'prompt-reverse' | 'assistant' | 'pose-reference' | null
type GenMode = 'image' | 'video'

const MODE_CONFIG: Record<GenMode, { icon: LucideIcon; labelKey: string; gradient: string }> = {
  image: { icon: Image, labelKey: 'generate.modes.image', gradient: 'from-[var(--juhe-cyan)] to-[var(--juhe-violet)]' },
  video: {
    icon: Video,
    labelKey: 'generate.modes.video',
    gradient: 'from-[var(--juhe-magenta)] to-[var(--juhe-amber)]'
  }
}

function GeneratePage() {
  const { t } = useTranslation()
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)
  const [genMode, setGenMode] = useState<GenMode>('image')
  const { params, tasks, setParams } = useGenerationStore()
  const search = useSearch({ from: '/generate' }) as { prompt?: string; mode?: string; ref?: string }
  const [quickOptimizing, setQuickOptimizing] = useState(false)
  const [sourceCompare, setSourceCompare] = useState(false)
  const [showTemplateLib, setShowTemplateLib] = useState(false)

  // Resizable left panel
  const [panelWidth, setPanelWidth] = useState(400)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const isImg2Img = genMode === 'image' && !!params.firstFrame

  useEffect(() => {
    if (search.prompt) setParams({ prompt: search.prompt })
  }, [search.prompt, setParams])

  useEffect(() => {
    if (search.ref) setParams({ referenceImages: [search.ref] })
  }, [search.ref, setParams])

  useEffect(() => {
    if (search.mode === 'img2img') setGenMode('image')
  }, [search.mode])

  // Panel resize drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: panelWidth }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      const next = Math.min(560, Math.max(320, dragRef.current.startWidth + delta))
      setPanelWidth(next)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelWidth])

  const handleSetGenMode = useCallback(
    (mode: GenMode) => {
      setGenMode(mode)
      if (mode === 'image') {
        setParams({ duration: undefined, fps: undefined, motionStrength: undefined, cameraMotion: undefined, lastFrame: null })
      } else {
        setParams({ referenceImages: undefined, firstFrame: null, transformation: undefined })
      }
    },
    [setParams]
  )

  const handleInsertPreset = (text: string) => {
    const current = params.prompt || ''
    const separator = current.trim() && !current.endsWith(',') ? ', ' : ''
    setParams({ prompt: current + separator + text })
  }

  const handleOptimized = (optimized: string) => setParams({ prompt: optimized })
  const handleApplyTemplate = (prompt: string) => setParams({ prompt })

  const togglePanel = (panel: SidePanel) => setSidePanel((prev) => (prev === panel ? null : panel))

  const handleQuickOptimize = useCallback(async () => {
    const currentPrompt = params.prompt
    if (!currentPrompt?.trim() || quickOptimizing) return
    setQuickOptimizing(true)
    try {
      const res = await window.api.prompt.optimize({
        prompt: currentPrompt,
        mode: 'enhance',
        providerId: params.optimizerProviderId || undefined,
        modelId: params.optimizerModel || undefined
      })
      if (res?.optimized) setParams({ prompt: res.optimized })
    } catch {
      toastError({ description: '快速优化提示词失败，请重试' })
    } finally {
      setQuickOptimizing(false)
    }
  }, [params.prompt, params.optimizerProviderId, params.optimizerModel, quickOptimizing, setParams])

  const generateButtonRef = useRef<HTMLButtonElement>(null)
  const sidePanelRef = useRef(sidePanel)
  sidePanelRef.current = sidePanel

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        generateButtonRef.current?.click()
        return
      }
      if (e.key === 'Escape' && sidePanelRef.current) setSidePanel(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className='h-[calc(100vh-3rem)] flex' style={{ background: 'var(--juhe-void)' }}>
      {/* Left Panel - resizable */}
      <div
        className='shrink-0 border-r border-[var(--juhe-border)] flex flex-col relative'
        style={{ width: panelWidth, background: 'var(--juhe-void-2)' }}
      >
        {/* Header with mode switch */}
        <div className='px-4 pt-4 pb-3 border-b border-[var(--juhe-border)]'>
          <h1 className='text-lg font-bold tracking-tight mb-3' style={{ fontFamily: 'var(--font-display)' }}>
            <span className='gradient-text'>
              {genMode === 'image' ? t('generate.imageGeneration') : t('generate.videoGeneration')}
            </span>
          </h1>

          {/* Mode Switch */}
          <div className='flex bg-[var(--juhe-surface)] rounded-xl p-1 gap-0.5'>
            {(Object.entries(MODE_CONFIG) as [GenMode, (typeof MODE_CONFIG)[GenMode]][]).map(([mode, config]) => {
              const Icon = config.icon
              const isActive = genMode === mode
              return (
                <button
                  key={mode}
                  type='button'
                  onClick={() => handleSetGenMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-br ${config.gradient} text-white shadow-lg translate-y-[-1px]`
                      : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]'
                  }`}
                >
                  <Icon className='w-3.5 h-3.5' />
                  {t(config.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          {/* Model + Prompt integrated card */}
          <div className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] overflow-hidden'>
            <div className='p-3 space-y-3'>
              <ModelSelector mode={genMode} />
              <PromptInput />
              {/* Prompt helper row */}
              <div className='flex items-center gap-1.5 flex-wrap'>
                <PromptOptimizer
                  prompt={params.prompt || ''}
                  onOptimized={handleOptimized}
                  onQuickOptimize={handleQuickOptimize}
                  quickOptimizing={quickOptimizing}
                />
                <button
                  type='button'
                  onClick={() => setParams({ autoOptimize: !params.autoOptimize })}
                  className={`flex items-center gap-1 px-2.5 h-7 text-[11px] rounded-lg transition-all ${
                    params.autoOptimize
                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)]/20 to-[var(--juhe-violet)]/20 text-[var(--juhe-cyan)] border border-[var(--juhe-cyan)]/30'
                      : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] border border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/30'
                  }`}
                  title={t('generate.promptOptimizer.autoOptimize')}
                >
                  <Zap className='w-3 h-3' />
                  <span className='hidden sm:inline'>{t('generate.promptOptimizer.autoOptimize')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tools Section */}
          <CollapsibleSection title={t('generate.toolsSection')} defaultExpanded>
            <div className='flex flex-wrap gap-1.5'>
              {[
                { id: 'preset' as const, icon: Library, label: t('generate.tools.library') },
                { id: 'template' as const, icon: LayoutTemplate, label: t('generate.tools.template') },
                { id: 'image-process' as const, icon: SlidersHorizontal, label: t('generate.tools.process') },
                ...(genMode === 'image' ? [{ id: 'batch' as const, icon: Layers, label: t('generate.tools.batch') }] : []),
                { id: 'prompt-reverse' as const, icon: Wand2, label: t('generate.tools.reverse') },
                { id: 'assistant' as const, icon: Sparkles, label: t('generate.tools.assistant') },
                { id: 'pose-reference' as const, icon: PersonStanding, label: t('generate.tools.poseReference') },
                { id: 'industry-template' as const, icon: Library, label: t('generate.tools.industryTemplate') },
                { id: 'task-progress' as const, icon: Activity, label: t('generate.tools.taskProgress') }
              ].map((tool) => {
                const Icon = tool.icon
                const isActive = sidePanel === tool.id
                if (tool.id === 'industry-template') {
                  return (
                    <button
                      key={tool.id}
                      type='button'
                      onClick={() => setShowTemplateLib(true)}
                      className='flex items-center gap-1.5 px-3 h-7 text-[11px] rounded-lg transition-all duration-200 bg-[var(--juhe-surface)] border border-[var(--juhe-amber)]/30 text-[var(--juhe-amber)] hover:bg-[var(--juhe-amber)]/10'
                      title={t('generate.tools.industryTemplate')}
                    >
                      <Library className='w-3.5 h-3.5' />
                      {t('generate.tools.industryTemplate')}
                    </button>
                  )
                }
                return (
                  <button
                    key={tool.id}
                    type='button'
                    onClick={() => togglePanel(tool.id)}
                    className={`flex items-center gap-1.5 px-3 h-7 text-[11px] rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white shadow-lg shadow-[var(--juhe-cyan)]/10'
                        : 'bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/30 hover:bg-[var(--juhe-surface-2)]'
                    }`}
                    title={tool.label}
                  >
                    <Icon className='w-3.5 h-3.5' />
                    {tool.label}
                  </button>
                )
              })}
            </div>
          </CollapsibleSection>

          {/* Reference Section */}
          {genMode === 'image' && (
            <CollapsibleSection
              title={isImg2Img ? t('img2img.sourceImage') : t('generate.referenceSection')}
              defaultExpanded={false}
            >
              <div className='space-y-3'>
                <Img2ImgSourceImage />
                {!isImg2Img && <ReferenceImages />}
              </div>
            </CollapsibleSection>
          )}

          {genMode === 'video' && (
            <CollapsibleSection title={t('generate.referenceSection')} defaultExpanded={false}>
              <ReferenceImages />
            </CollapsibleSection>
          )}

          {/* Parameters */}
          <CollapsibleSection title={t('generate.paramsSection')} defaultExpanded={false}>
            <div className='space-y-3'>
              {genMode === 'image' && !isImg2Img && <ParameterPanel />}
              {genMode === 'video' && <VideoParameterPanel />}
              {isImg2Img && <Img2ImgParameterPanel />}
            </div>
          </CollapsibleSection>
        </div>

        {/* Generate Button */}
        <div className='p-3 border-t border-[var(--juhe-border)]' style={{ background: 'var(--juhe-void-2)' }}>
          <GenerateButton genMode={genMode} buttonRef={generateButtonRef} />
        </div>

        {/* Resize handle */}
        <div
          className='absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-[var(--juhe-cyan)]/20 transition-colors'
          onMouseDown={handleDragStart}
        />
      </div>

      {/* Middle - Results */}
      <div className='flex-1 min-w-0 overflow-hidden relative'>
        <div className='absolute inset-0 grid-bg opacity-50 pointer-events-none' />
        <div className='h-full p-5 relative flex flex-col'>
          {/* Before/After floating card */}
          {isImg2Img && !sourceCompare && (
            <button
              type='button'
              onClick={() => setSourceCompare(true)}
              className='absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)]/30 transition-colors shadow-lg'
            >
              <Columns2 className='w-3.5 h-3.5' />
              {t('img2img.compare')}
            </button>
          )}
          {isImg2Img && sourceCompare && (() => {
            const latestCompleted = [...tasks]
              .sort((a, b) => b.createdAt - a.createdAt)
              .find((tt) => tt.status === 'completed' && tt.outputs.length > 0)
            const resultImg = latestCompleted?.outputs[0]
            const resultSrc = resultImg?.base64
              ? `data:${resultImg.mediaType || 'image/png'};base64,${resultImg.base64}`
              : resultImg?.url

            return (
              <div className='absolute top-4 right-4 z-20 w-[420px] rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] shadow-2xl overflow-hidden'>
                <div className='flex items-center justify-between px-3 py-2 border-b border-[var(--juhe-border)]'>
                  <span className='text-xs font-medium text-[var(--juhe-text)]'>{t('img2img.beforeAfter')}</span>
                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => setSourceCompare(false)}
                      className='p-1 rounded hover:bg-[var(--juhe-surface)] text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] transition-colors'
                    >
                      <X className='w-3.5 h-3.5' />
                    </button>
                  </div>
                </div>
                {latestCompleted ? (
                  <div className='grid grid-cols-2'>
                    <div className='border-r border-[var(--juhe-border)]'>
                      <div className='px-2 py-1.5 text-[10px] font-medium text-[var(--juhe-text-3)] bg-[var(--juhe-surface)]/50'>
                        {t('img2img.sourceImage')}
                      </div>
                      <img src={params.firstFrame ?? undefined} alt='' className='w-full object-contain max-h-[220px]' />
                    </div>
                    <div>
                      <div className='px-2 py-1.5 text-[10px] font-medium text-[var(--juhe-text-3)] bg-[var(--juhe-surface)]/50'>
                        {t('imageProcess.result')}
                      </div>
                      {resultSrc ? (
                        <img src={resultSrc} alt='' className='w-full object-contain max-h-[220px]' />
                      ) : (
                        <div className='flex items-center justify-center h-[180px] text-[10px] text-[var(--juhe-text-3)]'>
                          {t('imageProcess.result')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className='px-4 py-6 text-center text-xs text-[var(--juhe-text-3)]'>
                    {t('generate.imageGeneration')}
                  </div>
                )}
              </div>
            )
          })()}

          <div className='flex-1 min-h-0'>
            <ResultGallery />
          </div>
        </div>

        {/* Right Side Panel — overlay */}
        {sidePanel && (
          <div
            className='absolute right-0 top-0 bottom-0 w-[340px] z-30 border-l border-[var(--juhe-border)] shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col'
            style={{ background: 'var(--juhe-void-2)' }}
          >
            <div className='flex-1 overflow-y-auto'>
              {sidePanel === 'preset' && <PresetPanel onInsert={handleInsertPreset} onClose={() => setSidePanel(null)} />}
              {sidePanel === 'template' && <TemplateLibrary onApply={handleApplyTemplate} onClose={() => setSidePanel(null)} />}
              {sidePanel === 'image-process' && <ImageProcessPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === 'batch' && <BatchPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === 'task-progress' && <TaskProgressPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === 'prompt-reverse' && <PromptReverse onApply={handleApplyTemplate} />}
              {sidePanel === 'assistant' && <AssistantPanel onApply={handleApplyTemplate} onClose={() => setSidePanel(null)} />}
              {sidePanel === 'pose-reference' && <PoseReferencePanel onClose={() => setSidePanel(null)} />}
            </div>
          </div>
        )}
      </div>

      {/* Industry Template Library */}
      {showTemplateLib && (
        <TemplateSelector
          onApply={(prompt) => { setParams({ prompt }); setShowTemplateLib(false) }}
          onClose={() => setShowTemplateLib(false)}
        />
      )}
    </div>
  )
}
