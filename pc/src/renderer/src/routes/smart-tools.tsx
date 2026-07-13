import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, ChevronsLeftRight, Download, Eye, EyeOff, ImagePlus, RefreshCw, Search, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getToolById, SMART_TOOLS, type ToolParam } from '@/components/smart-tools/tool-registry'
import { cleanupImageProcessProgressListener, initImageProcessProgressListener, useImageProcessStore } from '@/stores/image-process'
import { useProviderStore } from '@/stores/providers'

// ---- Tool categories ----

const TOOL_CATEGORIES: { id: string; labelKey: string; toolIds: string[] }[] = [
  {
    id: 'photo',
    labelKey: 'smartTools.categories.photo',
    toolIds: ['id-photo', 'photo-repair', 'photo-restore-pro']
  },
  {
    id: 'enhance',
    labelKey: 'smartTools.categories.enhance',
    toolIds: ['bg-remove', 'auto-enhance', 'ai-portrait', 'photo-anime', 'style-transfer', 'art-filter']
  },
  {
    id: 'ecommerce',
    labelKey: 'smartTools.categories.ecommerce',
    toolIds: ['product-enhance', 'product-hero', 'logo-gen']
  },
  {
    id: 'style',
    labelKey: 'smartTools.categories.style',
    toolIds: ['hairstyle-report', 'style-upgrade']
  }
]

// ---- Route ----

interface SmartToolsSearch {
  tool?: string
}

export const Route = createFileRoute('/smart-tools')({
  validateSearch: (search: Record<string, unknown>): SmartToolsSearch => ({
    tool: typeof search.tool === 'string' ? search.tool : undefined
  }),
  component: SmartToolsPage
})

// ---- Component ----

function SmartToolsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tool: toolParam } = useSearch({ from: '/smart-tools' })
  const inputRef = useRef<HTMLInputElement>(null)
  const compareWrapperRef = useRef<HTMLDivElement>(null)

  const [selectedToolId, setSelectedToolId] = useState<string>(toolParam ?? SMART_TOOLS[0].id)
  const [dragOver, setDragOver] = useState(false)
  const [comparePosition, setComparePosition] = useState(50)
  const [showBefore, setShowBefore] = useState(true)
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({})
  const [providerId, setProviderId] = useState<string>('')
  const [modelId, setModelId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const selectedTool = getToolById(selectedToolId) ?? SMART_TOOLS[0]

  const { localTask, isProcessing, setTaskType, setSourceImage, setParams, setProviderModel, process, reset } =
    useImageProcessStore()

  // Provider data
  const { providers: allProviders, loadProviders } = useProviderStore()

  // Load providers on mount
  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  // Available providers (those with models)
  const availableProviders = useMemo(() => allProviders.filter((p) => p.models.length > 0), [allProviders])

  // Models of selected provider
  const providerModels = useMemo(() => {
    const p = allProviders.find((pr) => pr.id === providerId)
    return p?.models ?? []
  }, [allProviders, providerId])

  // Auto-select first provider when none selected
  useEffect(() => {
    if (providerId || availableProviders.length === 0) return
    const first = availableProviders[0]
    const firstModel = first.models[0]
    if (firstModel) {
      setProviderId(first.id)
      setModelId(firstModel.name)
      setProviderModel(first.id, firstModel.name)
    }
  }, [availableProviders, providerId, setProviderModel])

  // Init default param values when tool changes
  useEffect(() => {
    const defaults: Record<string, unknown> = {}
    for (const param of selectedTool.params) {
      defaults[param.id] = param.defaultValue
    }
    setParamValues(defaults)
  }, [selectedTool])

  // Init progress listener once
  useEffect(() => {
    initImageProcessProgressListener()
    return () => { cleanupImageProcessProgressListener() }
  }, [])

  // Clipboard paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const item = e.clipboardData?.items?.[0]
      if (!item?.type.startsWith('image/')) return
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => setSourceImage(reader.result as string)
      reader.readAsDataURL(file)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [setSourceImage])

  // Handle file input
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        setSourceImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    },
    [setSourceImage]
  )

  // Handle process
  const handleProcess = useCallback(async () => {
    setTaskType('smart-repair')
    const prompt = selectedTool.buildPrompt(paramValues)
    const gen = selectedTool.genDefaults
    let denoise = gen.denoise * 100
    let saturation = gen.saturation
    for (const param of selectedTool.params) {
      if (param.type === 'slider' && typeof paramValues[param.id] === 'number') {
        if (param.id === 'denoise') denoise = paramValues[param.id] as number
        if (param.id === 'saturation') saturation = paramValues[param.id] as number
      }
    }
    setParams({
      prompt,
      strength: gen.strength,
      scale: gen.scale,
      quality: gen.quality,
      style: 'default',
      denoise: denoise / 100,
      saturation
    })
    await process()
  }, [selectedTool, paramValues, process, setParams, setTaskType])

  // Drag & drop
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (!file?.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => setSourceImage(reader.result as string)
      reader.onerror = () => console.error('[SmartTools] Failed to read dropped file:', file.name)
      reader.readAsDataURL(file)
    },
    [setSourceImage]
  )

  // Compare slider
  const onCompareMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const wrapper = compareWrapperRef.current
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const update = (ev: MouseEvent) => {
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100))
      setComparePosition(pct)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', update)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', update)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Download result
  const handleDownload = useCallback(() => {
    if (!localTask?.result) return
    const a = document.createElement('a')
    a.href = localTask.result
    a.download = `${selectedTool.id}-${Date.now()}.png`
    a.click()
  }, [localTask?.result, selectedTool.id])

  // Filtered tools
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return SMART_TOOLS
    const q = searchQuery.toLowerCase()
    return SMART_TOOLS.filter((tool) => t(tool.labelKey).toLowerCase().includes(q) || tool.id.toLowerCase().includes(q))
  }, [searchQuery, t])

  // ---- Parameter renderers ----

  const _renderParam = useCallback(
    (param: ToolParam) => {
      const value = paramValues[param.id]

      if (param.type === 'toggle') {
        const checked = !!value
        return (
          <button
            key={param.id}
            type='button'
            onClick={() => setParamValues((prev) => ({ ...prev, [param.id]: !checked }))}
            className='group flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-200'
            style={{
              background: checked ? 'rgba(0,240,255,0.06)' : 'var(--juhe-surface-2)',
              border: `1px solid ${checked ? 'rgba(0,240,255,0.3)' : 'var(--juhe-border)'}`
            }}
          >
            <div
              className='relative w-9 h-5 rounded-full shrink-0 transition-all duration-200'
              style={{
                background: checked
                  ? 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-cyan-dim))'
                  : 'var(--juhe-surface-3)',
                boxShadow: checked ? '0 0 8px rgba(0,240,255,0.3)' : 'none'
              }}
            >
              <div
                className='absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200'
                style={{ left: checked ? 'calc(100% - 1.125rem)' : '0.125rem' }}
              />
            </div>
            <span className='text-sm flex-1' style={{ color: checked ? 'var(--juhe-text)' : 'var(--juhe-text-2)' }}>
              {t(param.labelKey as never)}
            </span>
          </button>
        )
      }

      if (param.type === 'select') {
        const options = param.options ?? []
        return (
          <div key={param.id} className='flex flex-col gap-2.5'>
            <span
              className='text-[10px] font-bold uppercase tracking-[0.15em] px-0.5'
              style={{ color: 'var(--juhe-text-3)' }}
            >
              {t(param.labelKey as never)}
            </span>
            <div className='flex flex-wrap gap-1.5'>
              {options.map((opt) => {
                const active = value === opt.id
                return (
                  <button
                    key={opt.id}
                    type='button'
                    onClick={() => setParamValues((prev) => ({ ...prev, [param.id]: opt.id }))}
                    className='px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 hover:scale-[1.02]'
                    style={{
                      background: active
                        ? 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-cyan-dim))'
                        : 'var(--juhe-surface-2)',
                      color: active ? 'var(--juhe-void)' : 'var(--juhe-text-2)',
                      border: `1px solid ${active ? 'var(--juhe-cyan)' : 'var(--juhe-border)'}`,
                      boxShadow: active ? '0 0 12px rgba(0,240,255,0.2)' : 'none'
                    }}
                  >
                    {t(opt.labelKey as never)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      }

      if (param.type === 'slider') {
        const numValue = Number(value ?? param.defaultValue)
        const min = param.min ?? 0
        const max = param.max ?? 100
        const pct = ((numValue - min) / (max - min)) * 100
        return (
          <div key={param.id} className='flex flex-col gap-2.5'>
            <div className='flex items-center justify-between'>
              <span
                className='text-[10px] font-bold uppercase tracking-[0.15em] px-0.5'
                style={{ color: 'var(--juhe-text-3)' }}
              >
                {t(param.labelKey as never)}
              </span>
              <span
                className='text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-md'
                style={{ color: 'var(--juhe-cyan)', background: 'rgba(0,240,255,0.08)' }}
              >
                {String(numValue)}
              </span>
            </div>
            <div className='relative h-8 flex items-center'>
              <input
                type='range'
                min={min}
                max={max}
                step={param.step ?? 1}
                value={numValue}
                onChange={(e) => setParamValues((prev) => ({ ...prev, [param.id]: Number(e.target.value) }))}
                className='w-full h-1.5 rounded-full appearance-none cursor-pointer relative z-10'
                style={{ background: 'transparent', accentColor: 'var(--juhe-cyan)' }}
              />
              <div
                className='absolute inset-y-0 my-auto h-1.5 rounded-full pointer-events-none'
                style={{
                  width: '100%',
                  background: `linear-gradient(to right, var(--juhe-cyan) 0%, var(--juhe-cyan) ${pct}%, var(--juhe-surface-3) ${pct}%, var(--juhe-surface-3) 100%)`
                }}
              />
            </div>
          </div>
        )
      }

      return null
    },
    [paramValues, t]
  )

  // Inline compact variant for the params bar in right panel
  const renderParamInline = useCallback(
    (param: ToolParam) => {
      const value = paramValues[param.id]

      if (param.type === 'toggle') {
        const checked = !!value
        return (
          <button
            key={param.id}
            type='button'
            onClick={() => setParamValues((prev) => ({ ...prev, [param.id]: !checked }))}
            className='flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 shrink-0'
            style={{
              background: checked ? 'rgba(0,240,255,0.1)' : 'var(--juhe-void-2)',
              color: checked ? 'var(--juhe-cyan)' : 'var(--juhe-text-3)',
              border: `1px solid ${checked ? 'rgba(0,240,255,0.3)' : 'var(--juhe-border)'}`
            }}
          >
            <div
              className='w-3 h-3 rounded-full shrink-0 transition-all duration-200'
              style={{
                background: checked ? 'var(--juhe-cyan)' : 'var(--juhe-surface-3)',
                boxShadow: checked ? '0 0 4px rgba(0,240,255,0.4)' : 'none'
              }}
            />
            {t(param.labelKey as never)}
          </button>
        )
      }

      if (param.type === 'select') {
        const options = param.options ?? []
        return (
          <div key={param.id} className='flex items-center gap-1.5 shrink-0'>
            <span className='text-[10px] font-semibold opacity-60' style={{ color: 'var(--juhe-text-3)' }}>
              {t(param.labelKey as never)}:
            </span>
            {options.map((opt) => {
              const active = value === opt.id
              return (
                <button
                  key={opt.id}
                  type='button'
                  onClick={() => setParamValues((prev) => ({ ...prev, [param.id]: opt.id }))}
                  className='px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200'
                  style={{
                    background: active ? 'var(--juhe-cyan)' : 'var(--juhe-void-2)',
                    color: active ? 'var(--juhe-void)' : 'var(--juhe-text-3)',
                    border: `1px solid ${active ? 'var(--juhe-cyan)' : 'var(--juhe-border)'}`
                  }}
                >
                  {t(opt.labelKey as never)}
                </button>
              )
            })}
          </div>
        )
      }

      if (param.type === 'slider') {
        const numValue = Number(value ?? param.defaultValue)
        const min = param.min ?? 0
        const max = param.max ?? 100
        const _pct = ((numValue - min) / (max - min)) * 100
        return (
          <div key={param.id} className='flex items-center gap-2 shrink-0'>
            <span className='text-[10px] font-semibold opacity-60' style={{ color: 'var(--juhe-text-3)' }}>
              {t(param.labelKey as never)}
            </span>
            <input
              type='range'
              min={min}
              max={max}
              step={param.step ?? 1}
              value={numValue}
              onChange={(e) => setParamValues((prev) => ({ ...prev, [param.id]: Number(e.target.value) }))}
              className='w-16 h-1 rounded-full appearance-none cursor-pointer'
              style={{ accentColor: 'var(--juhe-cyan)' }}
            />
            <span
              className='text-[10px] font-mono tabular-nums min-w-[1.5rem] text-right'
              style={{ color: 'var(--juhe-cyan)' }}
            >
              {String(numValue)}
            </span>
          </div>
        )
      }

      return null
    },
    [paramValues, t]
  )

  // ---- Render ----

  return (
    <div className='h-[calc(100vh-3rem)] flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <header
        className='flex items-center gap-4 px-5 py-3.5 border-b shrink-0'
        style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
      >
        <button
          type='button'
          onClick={() => navigate({ to: '/' })}
          className='p-1.5 rounded-lg transition-all duration-200 hover:bg-[var(--juhe-surface-2)] hover:scale-105'
          style={{ color: 'var(--juhe-text-2)' }}
        >
          <ArrowLeft className='w-4 h-4' />
        </button>
        <div>
          <h1 className='text-sm font-bold' style={{ color: 'var(--juhe-text)' }}>
            {t('smartTools.title')}
          </h1>
          <span className='text-[11px]' style={{ color: 'var(--juhe-text-3)' }}>
            {t('smartTools.subtitle')}
          </span>
        </div>
      </header>

      <div className='flex-1 flex overflow-hidden'>
        {/* Left: Tool Selector + Params */}
        <div
          className='w-72 shrink-0 border-r overflow-y-auto flex flex-col gap-5 p-4'
          style={{ borderColor: 'var(--juhe-border)', background: 'var(--juhe-surface)' }}
        >
          {/* Search */}
          <div className='relative'>
            <Search
              className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none'
              style={{ color: 'var(--juhe-text-3)' }}
            />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('smartTools.searchPlaceholder')}
              className='w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none transition-all duration-200 border'
              style={{
                background: 'var(--juhe-surface-2)',
                color: 'var(--juhe-text)',
                borderColor: searchQuery ? 'var(--juhe-cyan)' : 'var(--juhe-border)',
                boxShadow: searchQuery ? '0 0 8px rgba(0,240,255,0.08)' : 'none'
              }}
            />
          </div>

          {/* Tool categories */}
          {TOOL_CATEGORIES.map((category) => {
            const catTools = filteredTools.filter((t) => category.toolIds.includes(t.id))
            if (catTools.length === 0) return null
            return (
              <div key={category.id} className='flex flex-col gap-1'>
                <span
                  className='text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-1'
                  style={{ color: 'var(--juhe-text-3)' }}
                >
                  {t(category.labelKey as never)}
                </span>
                {catTools.map((tool) => {
                  const isSelected = selectedToolId === tool.id
                  return (
                    <button
                      key={tool.id}
                      type='button'
                      onClick={() => {
                        setSelectedToolId(tool.id)
                        reset()
                      }}
                      className='group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200'
                      style={{
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(0,240,255,0.03))'
                          : 'transparent',
                        color: isSelected ? 'var(--juhe-cyan)' : 'var(--juhe-text-2)',
                        border: `1px solid ${isSelected ? 'rgba(0,240,255,0.3)' : 'transparent'}`,
                        boxShadow: isSelected ? '0 0 16px rgba(0,240,255,0.06)' : 'none'
                      }}
                    >
                      <div
                        className='w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200'
                        style={{ background: isSelected ? 'rgba(0,240,255,0.12)' : 'var(--juhe-surface-2)' }}
                      >
                        <tool.icon className='w-4 h-4' />
                      </div>
                      <div className='min-w-0'>
                        <div className='text-xs font-semibold truncate'>{t(tool.labelKey)}</div>
                        <div
                          className='text-[10px] truncate'
                          style={{
                            color: isSelected ? 'rgba(0,240,255,0.6)' : 'var(--juhe-text-3)',
                            opacity: isSelected ? 1 : 0.6
                          }}
                        >
                          {t(tool.descriptionKey)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Right: Settings + Params + Image + Result */}
        <div className='flex-1 flex flex-col items-center justify-center p-8 gap-4 overflow-auto'>
          {/* Compact model selector */}
          <div
            className='w-full max-w-2xl px-4 py-2.5 rounded-2xl border flex items-center gap-4 shrink-0'
            style={{ background: 'var(--juhe-surface-2)', borderColor: 'var(--juhe-border)' }}
          >
            <span
              className='text-[10px] font-bold uppercase tracking-wider shrink-0'
              style={{ color: 'var(--juhe-text-3)' }}
            >
              {t('smartTools.modelSettings')}
            </span>
            <div className='flex-1 flex items-center gap-3'>
              <select
                value={providerId}
                onChange={(e) => {
                  const pid = e.target.value
                  setProviderId(pid)
                  const p = allProviders.find((pr) => pr.id === pid)
                  if (p?.models[0]) {
                    setModelId(p.models[0].name)
                    setProviderModel(pid, p.models[0].name)
                  }
                }}
                className='flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none border cursor-pointer transition-all'
                style={{
                  background: 'var(--juhe-void-2)',
                  color: 'var(--juhe-text)',
                  borderColor: 'var(--juhe-border)'
                }}
              >
                <option value=''>{t('smartTools.selectProvider')}</option>
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value)
                  setProviderModel(providerId, e.target.value)
                }}
                disabled={!providerId}
                className='flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none border cursor-pointer transition-all disabled:opacity-40'
                style={{
                  background: 'var(--juhe-void-2)',
                  color: 'var(--juhe-text)',
                  borderColor: 'var(--juhe-border)'
                }}
              >
                <option value=''>{t('smartTools.selectModel')}</option>
                {providerModels.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.displayName || m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tool parameters — compact bar */}
          {selectedTool.params.length > 0 && (
            <div
              className='w-full max-w-2xl px-4 py-2.5 rounded-2xl border flex items-center gap-3 flex-wrap shrink-0'
              style={{ background: 'var(--juhe-surface-2)', borderColor: 'var(--juhe-border)' }}
            >
              <span
                className='text-[10px] font-bold uppercase tracking-wider shrink-0'
                style={{ color: 'var(--juhe-text-3)' }}
              >
                {t('smartTools.toolParams')}
              </span>
              {selectedTool.params.map(renderParamInline)}
            </div>
          )}

          {/* Upload / Result area */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
          <div
            className={[
              'relative w-full max-w-2xl rounded-3xl border-2 transition-all duration-300',
              localTask?.result ? 'border-transparent' : 'border-dashed',
              dragOver ? 'scale-[1.01]' : ''
            ].join(' ')}
            style={{
              borderColor: dragOver
                ? 'var(--juhe-cyan)'
                : localTask?.sourceImage
                  ? 'transparent'
                  : 'var(--juhe-border)',
              background: localTask?.sourceImage ? 'transparent' : 'var(--juhe-surface-2)',
              minHeight: 320,
              boxShadow: dragOver
                ? '0 0 40px rgba(0,240,255,0.15), inset 0 0 40px rgba(0,240,255,0.05)'
                : localTask?.sourceImage
                  ? 'none'
                  : 'inset 0 2px 12px rgba(0,0,0,0.2)'
            }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <input ref={inputRef} type='file' accept='image/*' className='hidden' onChange={handleFileSelect} />

            {!localTask?.sourceImage ? (
              /* Upload placeholder */
              <button
                type='button'
                onClick={() => inputRef.current?.click()}
                className='absolute inset-0 flex flex-col items-center justify-center gap-4'
              >
                <div
                  className='w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse'
                  style={{ background: 'rgba(0,240,255,0.06)' }}
                >
                  <ImagePlus className='w-7 h-7' style={{ color: 'var(--juhe-cyan)' }} />
                </div>
                <div className='flex flex-col items-center gap-1'>
                  <span className='text-sm font-semibold' style={{ color: 'var(--juhe-text)' }}>
                    {t('smartTools.uploadTitle')}
                  </span>
                  <span className='text-[11px]' style={{ color: 'var(--juhe-text-3)' }}>
                    {t('smartTools.uploadHint')}
                  </span>
                  <div className='flex items-center gap-1.5 mt-2'>
                    <div
                      className='flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium'
                      style={{ background: 'var(--juhe-surface-3)', color: 'var(--juhe-text-3)' }}
                    >
                      <Upload className='w-3 h-3' /> {t('smartTools.clickOrDrag')}
                    </div>
                    <div
                      className='flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium'
                      style={{ background: 'var(--juhe-surface-3)', color: 'var(--juhe-text-3)' }}
                    >
                      Ctrl+V
                    </div>
                  </div>
                </div>
              </button>
            ) : localTask?.result ? (
              /* Result with compare slider */
              <div className='relative w-full'>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
                <div
                  ref={compareWrapperRef}
                  className='relative w-full overflow-hidden rounded-3xl select-none'
                  style={{ aspectRatio: '1', cursor: 'ew-resize' }}
                  onMouseDown={onCompareMouseDown}
                >
                  <img
                    src={localTask.result}
                    alt='Result'
                    className='absolute inset-0 w-full h-full object-cover'
                    draggable={false}
                  />
                  <div
                    className='absolute inset-0 overflow-hidden transition-opacity duration-300'
                    style={{ width: `${comparePosition}%`, opacity: showBefore ? 1 : 0 }}
                  >
                    <img
                      src={localTask.sourceImage}
                      alt='Before'
                      className='absolute inset-0 object-cover'
                      style={{ width: `${(100 / comparePosition) * 100}%`, height: '100%', maxWidth: 'none' }}
                      draggable={false}
                    />
                  </div>
                  <div
                    className='absolute top-4 left-4 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm transition-opacity duration-300'
                    style={{ background: 'rgba(0,0,0,0.5)', color: 'white', opacity: showBefore ? 1 : 0 }}
                  >
                    {t('smartTools.before')}
                  </div>
                  <div
                    className='absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm'
                    style={{ background: 'rgba(0,240,255,0.15)', color: 'var(--juhe-cyan)' }}
                  >
                    {t('smartTools.after')}
                  </div>
                  {showBefore && (
                    <div
                      className='absolute top-0 bottom-0 flex items-center justify-center'
                      style={{ left: `${comparePosition}%` }}
                    >
                      <div className='w-0.5 h-full' style={{ background: 'rgba(0,240,255,0.4)' }} />
                      <div
                        className='absolute w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2'
                        style={{
                          background: 'white',
                          borderColor: 'var(--juhe-cyan)',
                          boxShadow: '0 0 16px rgba(0,240,255,0.4)'
                        }}
                      >
                        <ChevronsLeftRight className='w-4 h-4' style={{ color: 'var(--juhe-cyan-dim)' }} />
                      </div>
                    </div>
                  )}
                </div>
                {/* Result toolbar */}
                <div className='absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => setShowBefore((v) => !v)}
                    className='flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-medium backdrop-blur-md transition-all duration-200 hover:scale-105 border'
                    style={{
                      background: 'rgba(20,20,32,0.85)',
                      color: 'var(--juhe-text-2)',
                      borderColor: 'var(--juhe-border)'
                    }}
                  >
                    {showBefore ? <EyeOff className='w-3 h-3' /> : <Eye className='w-3 h-3' />}
                    {showBefore ? t('smartTools.after') : t('smartTools.compare')}
                  </button>
                  <button
                    type='button'
                    onClick={handleDownload}
                    className='flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-medium transition-all duration-200 hover:scale-105'
                    style={{
                      background: 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-cyan-dim))',
                      color: 'var(--juhe-void)',
                      boxShadow: '0 2px 12px rgba(0,240,255,0.25)'
                    }}
                  >
                    <Download className='w-3 h-3' /> {t('smartTools.downloadResult')}
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      reset()
                      inputRef.current?.click()
                    }}
                    className='flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-medium backdrop-blur-md transition-all duration-200 hover:scale-105 border'
                    style={{
                      background: 'rgba(20,20,32,0.85)',
                      color: 'var(--juhe-text-2)',
                      borderColor: 'var(--juhe-border)'
                    }}
                  >
                    <RefreshCw className='w-3 h-3' /> {t('smartTools.retry')}
                  </button>
                </div>
              </div>
            ) : (
              /* Source image with processing overlay */
              <div className='relative w-full rounded-3xl overflow-hidden' style={{ aspectRatio: '1' }}>
                <img src={localTask.sourceImage} alt='Source' className='w-full h-full object-cover' />
                {isProcessing && (
                  <div
                    className='absolute inset-0 flex flex-col items-center justify-center gap-4 backdrop-blur-sm'
                    style={{ background: 'rgba(0,0,0,0.65)' }}
                  >
                    <div className='relative w-16 h-16'>
                      <div
                        className='absolute inset-0 rounded-full animate-spin'
                        style={{
                          border: '2px solid transparent',
                          borderTopColor: 'var(--juhe-cyan)',
                          borderRightColor: 'var(--juhe-cyan)'
                        }}
                      />
                      <div
                        className='absolute inset-2 rounded-full animate-spin'
                        style={{
                          border: '2px solid transparent',
                          borderBottomColor: 'var(--juhe-violet)',
                          animationDirection: 'reverse',
                          animationDuration: '0.8s'
                        }}
                      />
                    </div>
                    <div className='flex flex-col items-center gap-2'>
                      <span className='text-sm font-semibold' style={{ color: 'white' }}>
                        {t('smartTools.processing')}
                      </span>
                      <div className='flex gap-1 items-center'>
                        {[
                          t('smartTools.processingStep'),
                          '·',
                          t('smartTools.processingStep2'),
                          '·',
                          t('smartTools.processingStep3')
                        ].map((step, i) => (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                            key={i}
                            className='text-[10px]'
                            style={{
                              color: i <= (localTask?.progress ?? 0) / 33 ? 'var(--juhe-cyan)' : 'rgba(255,255,255,0.3)'
                            }}
                          >
                            {step}
                          </span>
                        ))}
                      </div>
                      <div
                        className='w-48 h-1 rounded-full overflow-hidden mt-1'
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                      >
                        <div
                          className='h-full rounded-full transition-all duration-500'
                          style={{
                            width: `${localTask?.progress ?? 0}%`,
                            background: 'linear-gradient(90deg, var(--juhe-cyan), var(--juhe-violet))'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Start button */}
          {localTask?.sourceImage && !isProcessing && !localTask?.result && (
            <button
              type='button'
              onClick={handleProcess}
              className='px-8 py-3.5 rounded-full text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95'
              style={{
                background: 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-violet))',
                color: 'white',
                boxShadow: '0 4px 24px rgba(0,240,255,0.25)'
              }}
            >
              {t('common.start')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
