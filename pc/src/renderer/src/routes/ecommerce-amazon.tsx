/**
 * ecommerce-amazon.tsx — Amazon Planner（Listing + A+ Content 策划）
 * 融合 amazon-image-studio 的策划工作流到桌面端
 */

import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useGenerationStore } from '@/stores/generation'
import { useProviderStore } from '@/stores/providers'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import {
  A_PLUS_CONTENT_TYPES,
  buildListingPlannerSystemPrompt,
  buildListingPlannerUserPrompt,
  buildAPlusPlannerSystemPrompt,
  buildAPlusPlannerUserPrompt,
  getAPlusModuleSpecs,
  getAPlusContentTypeLabel,
  insertAPlusModuleSpecAfter,
  removeAPlusModuleSpecAt,
  type AmazonPlannerMode,
  type APlusContentType,
  type AmazonPromptDraft,
  type AmazonImagePlan,
  type AmazonAPlusPlan,
} from '@/lib/amazon-planner'

export const Route = createFileRoute('/ecommerce-amazon')({
  component: AmazonPlannerPage
})

// ===== Helpers =====

async function getConfig(key: string): Promise<string> {
  try {
    const val = await window.api.config.get(key)
    return typeof val === 'string' ? val : ''
  } catch {
    return ''
  }
}

async function callPlannerAPI(systemPrompt: string, userPrompt: string, model: string): Promise<string> {
  const baseURL = (await getConfig('juheBaseUrl')).replace(/\/$/, '') || 'http://101.96.196.48:7075'
  const apiKey = await getConfig('auth.apiKey')
  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      stream: false,
    }),
  })
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      if (body?.error?.message) detail = body.error.message
    } catch { /* ignore parse error */ }
    throw new Error(detail)
  }
  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

function parsePlanJSON(text: string): unknown[] {
  // Try to extract JSON array from response
  const cleaned = text.trim()
  const match = cleaned.match(/\[[\s\S]*?\]/);
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ===== Main Component =====

function AmazonPlannerPage() {
  const createTask = useGenerationStore((s) => s.createTask)
  const { providers, loadProviders } = useProviderStore()

  // Mode
  const [mode, setMode] = useState<AmazonPlannerMode>('listing')

  // Load providers on mount
  useEffect(() => {
    const timer = setTimeout(() => { loadProviders() }, 50)
    return () => clearTimeout(timer)
  }, [loadProviders])

  // Helper: check if model supports a capability using shared resolver
  const modelHasCap = (m: { capabilities?: string[] | null }, cap: string) => {
    const caps = resolveModelCapabilities({ name: (m as { name?: string }).name ?? '', capabilities: m.capabilities, type: null })
    return caps.includes(cap as never)
  }

  // Text model selection (models with 'chat' capability)
  const textProviders = providers
    .filter((p) => p.isEnabled !== false)
    .map((p) => ({ ...p, models: p.models.filter((m) => m.isEnabled !== false && modelHasCap(m, 'chat')) }))
    .filter((p) => p.models.length > 0)
  const [textProviderId, setTextProviderId] = useState('')
  const [textModelId, setTextModelId] = useState('')

  // Image model selection (models with 'image' capability)
  const imageProviders = providers
    .filter((p) => p.isEnabled !== false)
    .map((p) => ({ ...p, models: p.models.filter((m) => m.isEnabled !== false && modelHasCap(m, 'image')) }))
    .filter((p) => p.models.length > 0)
  const [imageProviderId, setImageProviderId] = useState('')
  const [imageModelId, setImageModelId] = useState('')

  const textProvider = textProviders.find((p) => p.id === textProviderId)
  const textModels = textProvider?.models ?? []
  const textModel = textModels.find((m) => m.name === textModelId)

  const imageProvider = imageProviders.find((p) => p.id === imageProviderId)
  const imageModels = imageProvider?.models ?? []
  const selectedImageModel = imageModels.find((m) => m.name === imageModelId)

  // Auto-initialize model selections when providers become available
  useEffect(() => {
    if (textProviders.length > 0 && !textProviderId) {
      const first = textProviders[0]
      if (first.models.length > 0) {
        setTextProviderId(first.id)
        setTextModelId(first.models[0].name)
      }
    }
  }, [textProviders, textProviderId])

  useEffect(() => {
    if (imageProviders.length > 0 && !imageProviderId) {
      const first = imageProviders[0]
      if (first.models.length > 0) {
        setImageProviderId(first.id)
        setImageModelId(first.models[0].name)
      }
    }
  }, [imageProviders, imageProviderId])

  // Validate current selections when providers change
  useEffect(() => {
    if (textProviderId && textProvider) {
      const validModel = textModels.some((m) => m.name === textModelId)
      if (!validModel && textModels.length > 0) {
        setTextModelId(textModels[0].name)
      }
    }
  }, [textProviderId, textProvider, textModels, textModelId])

  useEffect(() => {
    if (imageProviderId && imageProvider) {
      const validModel = imageModels.some((m) => m.name === imageModelId)
      if (!validModel && imageModels.length > 0) {
        setImageModelId(imageModels[0].name)
      }
    }
  }, [imageProviderId, imageProvider, imageModels, imageModelId])

  // Product input
  const [title, setTitle] = useState('')
  const [bullets, setBullets] = useState('')
  const [brandName, setBrandName] = useState('')
  const [description, setDescription] = useState('')

  // Listing config
  const [imageCount, setImageCount] = useState(7)

  // A+ config
  const [aPlusType, setAPlusType] = useState<APlusContentType>('standard-large')
  const [moduleSpecs, setModuleSpecs] = useState(() => getAPlusModuleSpecs('standard-large'))

  // Planning state
  const [planning, setPlanning] = useState(false)
  const [listingPlans, setListingPlans] = useState<AmazonImagePlan[]>([])
  const [aPlusPlans, setAPlusPlans] = useState<AmazonAPlusPlan[]>([])
  const [error, setError] = useState<string | null>(null)

  const draft: AmazonPromptDraft = {
    title: title.trim(),
    brandName: brandName.trim() || undefined,
    bullets: bullets.split('\n').map((b) => b.trim()).filter(Boolean),
    description: description.trim() || undefined,
  }

  const canPlan = (mode === 'listing' ? title.trim() : true) && textModel

  // Handle Listing planning
  const handlePlanListing = useCallback(async () => {
    if (!canPlan || !textModel) return
    setPlanning(true)
    setError(null)
    try {
      const system = buildListingPlannerSystemPrompt()
      const user = buildListingPlannerUserPrompt(draft, imageCount)
      const raw = await callPlannerAPI(system, user, textModel.name)
      const parsed = parsePlanJSON(raw) as Array<Record<string, unknown>>
      const plans: AmazonImagePlan[] = parsed
        .filter((p) => p && typeof p.slot === 'string')
        .map((p) => ({
          slot: p.slot as string,
          label: (p.label as string) || (p.slot as string),
          prompt: (p.prompt as string) || '',
          negativePrompt: (p.negativePrompt as string) || '',
          planMarkdown: (p.planMarkdown as string) || '',
        }))
      setListingPlans(plans)
      if (plans.length === 0) setError('未能解析策划结果，请重试')
    } catch (err) {
      setError(err instanceof Error ? err.message : '策划失败')
    } finally {
      setPlanning(false)
    }
  }, [canPlan, textProvider, textModel, draft, imageCount])

  // Handle A+ planning
  const handlePlanAPlus = useCallback(async () => {
    if (!canPlan || !textModel) return
    setPlanning(true)
    setError(null)
    try {
      const system = buildAPlusPlannerSystemPrompt()
      const user = buildAPlusPlannerUserPrompt(draft, aPlusType, moduleSpecs)
      const raw = await callPlannerAPI(system, user, textModel.name)
      const parsed = parsePlanJSON(raw) as Array<Record<string, unknown>>
      const plans: AmazonAPlusPlan[] = parsed
        .filter((p) => p && typeof p.slot === 'string')
        .map((p) => {
          const spec = moduleSpecs.find((s) => s.slot === p.slot)
          return {
            slot: p.slot as string,
            label: (p.label as string) || (p.slot as string),
            displayLabel: (p.displayLabel as string) || spec?.displayLabel || (p.slot as string),
            moduleType: spec?.moduleType || 'single-image',
            uploadSize: spec ? `${spec.uploadWidth}x${spec.uploadHeight}` : '970x600',
            generationSize: '2048x2048',
            prompt: (p.prompt as string) || '',
            textTitle: (p.textTitle as string) || '',
            textBody: (p.textBody as string) || '',
            negativePrompt: (p.negativePrompt as string) || '',
            planMarkdown: (p.planMarkdown as string) || '',
          }
        })
      setAPlusPlans(plans)
      if (plans.length === 0) setError('未能解析策划结果，请重试')
    } catch (err) {
      setError(err instanceof Error ? err.message : '策划失败')
    } finally {
      setPlanning(false)
    }
  }, [canPlan, textProvider, textModel, draft, aPlusType, moduleSpecs])

  // Generate single image
  const handleGenerate = useCallback(async (prompt: string, _slot: string) => {
    if (!imageProvider || !selectedImageModel) return
    await createTask('image', {
      prompt,
      providerId: imageProvider.id,
      model: selectedImageModel.name,
    })
  }, [createTask, imageProvider, selectedImageModel])

  // Remove module
  const handleRemoveModule = (index: number) => {
    setModuleSpecs(removeAPlusModuleSpecAt(aPlusType, moduleSpecs, index))
  }

  // Add module
  const handleAddModule = (index: number) => {
    setModuleSpecs(insertAPlusModuleSpecAfter(aPlusType, moduleSpecs, index))
  }

  // Reset modules
  const handleResetModules = () => {
    setModuleSpecs(getAPlusModuleSpecs(aPlusType))
  }

  const plans: (AmazonImagePlan | AmazonAPlusPlan)[] = mode === 'listing' ? listingPlans : aPlusPlans

  return (
    <div className='h-[calc(100vh-3rem)] flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='px-5 pt-4 pb-3 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center gap-2 mb-3'>
          <span className='text-sm font-bold text-[var(--juhe-text)]'>Amazon Planner</span>
          <span className='text-[10px] px-2 py-0.5 rounded-full bg-[var(--juhe-amber)]/20 text-[var(--juhe-amber)] font-medium'>Listing + A+</span>
        </div>
        {/* Mode tabs */}
        <div className='flex bg-[var(--juhe-surface)] rounded-lg p-0.5 gap-0.5'>
          {(['listing', 'aplus'] as const).map((m) => (
            <button
              key={m}
              type='button'
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                mode === m
                  ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white shadow-md'
                  : 'text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
              }`}
            >
              {m === 'listing' ? 'Listing 图片策划' : 'A+ Content 策划'}
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection: Text (planning) + Image (generation) */}
      <div className='px-5 py-3 border-b border-[var(--juhe-border)] space-y-2'>
        {/* Text model for AI planning */}
        <div className='flex items-center gap-2'>
          <span className='text-[10px] px-1.5 py-0.5 rounded bg-[var(--juhe-cyan)]/15 text-[var(--juhe-cyan)] font-medium shrink-0'>文字</span>
          <label className='text-[11px] font-medium text-[var(--juhe-text-3)] shrink-0'>服务商</label>
          <select
            value={textProviderId}
            onChange={(e) => { setTextProviderId(e.target.value); setTextModelId('') }}
            className='flex-1 max-w-[160px] h-7 px-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)] outline-none'
          >
            {textProviders.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
          <label className='text-[11px] font-medium text-[var(--juhe-text-3)] shrink-0 ml-1'>模型</label>
          <select
            value={textModelId}
            onChange={(e) => setTextModelId(e.target.value)}
            className='flex-1 max-w-[180px] h-7 px-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)] outline-none'
          >
            {textModels.map((m) => (
              <option key={m.name} value={m.name}>{m.displayName || m.name}</option>
            ))}
          </select>
        </div>
        {/* Image model for generation */}
        <div className='flex items-center gap-2'>
          <span className='text-[10px] px-1.5 py-0.5 rounded bg-[var(--juhe-violet)]/15 text-[var(--juhe-violet)] font-medium shrink-0'>图像</span>
          <label className='text-[11px] font-medium text-[var(--juhe-text-3)] shrink-0'>服务商</label>
          <select
            value={imageProviderId}
            onChange={(e) => { setImageProviderId(e.target.value); setImageModelId('') }}
            className='flex-1 max-w-[160px] h-7 px-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)] outline-none'
          >
            {imageProviders.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
          <label className='text-[11px] font-medium text-[var(--juhe-text-3)] shrink-0 ml-1'>模型</label>
          <select
            value={imageModelId}
            onChange={(e) => setImageModelId(e.target.value)}
            className='flex-1 max-w-[180px] h-7 px-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)] outline-none'
          >
            {imageModels.map((m) => (
              <option key={m.name} value={m.name}>{m.displayName || m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-5 space-y-4'>
        {/* Product Info */}
        <section className='space-y-3'>
          <h3 className='text-xs font-semibold text-[var(--juhe-text-2)] uppercase tracking-wider'>产品信息 Product Info</h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <div>
              <label className='block text-[11px] font-medium text-[var(--juhe-text-3)] mb-1'>产品标题 Title</label>
              <input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='输入Amazon产品标题'
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)] outline-none focus:border-[var(--juhe-cyan)]'
              />
            </div>
            <div>
              <label className='block text-[11px] font-medium text-[var(--juhe-text-3)] mb-1'>品牌 Brand</label>
              <input
                type='text'
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder='品牌名称（可选）'
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)] outline-none focus:border-[var(--juhe-cyan)]'
              />
            </div>
          </div>
          <div>
            <label className='block text-[11px] font-medium text-[var(--juhe-text-3)] mb-1'>五点描述 Bullets（每行一条）</label>
            <textarea
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              placeholder='每行输入一个卖点&#10;例如：&#10;高品质材料&#10;人体工学设计'
              rows={4}
              className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)] outline-none focus:border-[var(--juhe-cyan)] resize-none'
            />
          </div>
          <details className='group'>
            <summary className='text-xs text-[var(--juhe-text-3)] cursor-pointer flex items-center gap-1'>
              <ChevronDown className='w-3 h-3 transition-transform group-open:rotate-90' />
              补充描述 Description（可选）
            </summary>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='产品详细描述、材质、规格等'
              rows={3}
              className='w-full mt-2 px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm text-[var(--juhe-text)] outline-none focus:border-[var(--juhe-cyan)] resize-none'
            />
          </details>
        </section>

        {/* Mode-specific config */}
        {mode === 'listing' ? (
          <section>
            <label className='block text-[11px] font-medium text-[var(--juhe-text-3)] mb-1.5'>策划图片数量</label>
            <div className='flex gap-1.5'>
              {[7, 8, 9, 10, 11, 12].map((n) => (
                <button
                  key={n}
                  type='button'
                  onClick={() => setImageCount(n)}
                  className={`w-10 h-8 rounded-lg text-xs font-medium transition-all ${
                    imageCount === n
                      ? 'bg-[var(--juhe-cyan)] text-white'
                      : 'bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:border-[var(--juhe-cyan)]/30'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className='space-y-3'>
            <div>
              <label className='block text-[11px] font-medium text-[var(--juhe-text-3)] mb-1.5'>A+ 类型</label>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
                {A_PLUS_CONTENT_TYPES.map((type) => (
                  <button
                    key={type}
                    type='button'
                    onClick={() => { setAPlusType(type); setModuleSpecs(getAPlusModuleSpecs(type)) }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      aPlusType === type
                        ? 'bg-[var(--juhe-cyan)] text-white'
                        : 'bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:border-[var(--juhe-cyan)]/30'
                    }`}
                  >
                    {getAPlusContentTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>
            {/* Module specs editor */}
            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <label className='text-[11px] font-medium text-[var(--juhe-text-3)]'>模块编排 ({moduleSpecs.length})</label>
                <button
                  type='button'
                  onClick={handleResetModules}
                  className='text-[10px] text-[var(--juhe-cyan)] hover:underline'
                >
                  恢复默认
                </button>
              </div>
              <div className='space-y-1.5 max-h-[200px] overflow-y-auto'>
                {moduleSpecs.map((spec, i) => (
                  <div key={`${spec.slot}-${i}`} className='flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
                    <span className='text-[10px] text-[var(--juhe-text-3)] font-mono w-10 shrink-0'>{spec.slot}</span>
                    <span className='text-xs text-[var(--juhe-text)] flex-1 truncate'>{spec.displayLabel}</span>
                    <span className='text-[10px] text-[var(--juhe-text-3)] shrink-0'>{spec.uploadWidth}x{spec.uploadHeight}</span>
                    <div className='flex gap-1 shrink-0'>
                      <button type='button' onClick={() => handleAddModule(i)} className='p-1 rounded hover:bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)]' title='下方添加'>
                        <Sparkles className='w-3 h-3' />
                      </button>
                      {moduleSpecs.length > 1 && (
                        <button type='button' onClick={() => handleRemoveModule(i)} className='p-1 rounded hover:bg-red-500/20 text-[var(--juhe-text-3)] hover:text-red-400' title='删除'>
                          <Trash2 className='w-3 h-3' />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Plan button */}
        <button
          type='button'
          onClick={mode === 'listing' ? handlePlanListing : handlePlanAPlus}
          disabled={!canPlan || planning}
          className='w-full py-3 rounded-xl font-medium text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] hover:shadow-lg hover:shadow-[var(--juhe-cyan)]/20 flex items-center justify-center gap-2'
        >
          {planning ? <Loader2 className='w-4 h-4 animate-spin' /> : <Sparkles className='w-4 h-4' />}
          {planning ? 'AI 策划中...' : 'AI 策划生成方案'}
        </button>

        {/* Error */}
        {error && (
          <div className='px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2'>
            <X className='w-3.5 h-3.5 shrink-0' />
            {error}
          </div>
        )}

        {/* Results */}
        {plans.length > 0 && (
          <section className='space-y-3'>
            <h3 className='text-xs font-semibold text-[var(--juhe-text-2)] uppercase tracking-wider'>
              策划结果 ({plans.length} 张)
            </h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {plans.map((plan, i) => (
                <div key={`${plan.slot}-${i}`} className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] overflow-hidden'>
                  <div className='px-3 py-2 border-b border-[var(--juhe-border)] flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] px-2 py-0.5 rounded-full bg-[var(--juhe-cyan)]/20 text-[var(--juhe-cyan)] font-mono'>{plan.slot}</span>
                      <span className='text-xs font-medium text-[var(--juhe-text)]'>{plan.label || plan.slot}</span>
                    </div>
                    <button
                      type='button'
                      onClick={() => handleGenerate(plan.prompt, plan.slot)}
                      disabled={!plan.prompt}
                      className='px-3 py-1 rounded-lg text-[10px] font-medium bg-[var(--juhe-cyan)] text-white hover:bg-[var(--juhe-cyan)]/80 disabled:opacity-40 transition-colors'
                    >
                      生成
                    </button>
                  </div>
                  <div className='p-3'>
                    <p className='text-[11px] text-[var(--juhe-text-2)] line-clamp-3 leading-relaxed'>{plan.prompt || '无提示词'}</p>
                    {'negativePrompt' in plan && plan.negativePrompt && (
                      <p className='text-[10px] text-[var(--juhe-text-3)] mt-1 line-clamp-2'>
                        <span className='font-medium'>排除：</span>{plan.negativePrompt}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
