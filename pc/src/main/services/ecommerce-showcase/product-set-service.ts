/**
 * Product Set Service — 一键生成 4 张电商套图
 *
 * 流程：
 *   1. Vision Chat 分析商品图 → 品类 + 4 个 slide prompt
 *   2. 并行提交 4 个生成任务到 Generation Queue
 *   3. 轮询等待完成
 *   4. 返回套图结果
 */
import { generateText } from '@cherrystudio/ai-core'
import { resolveProvider } from '../../utils/provider-resolver'
import { getGenerationQueue } from '../queue'
import { createRoutedGenerationTask } from '../generation-router'
import type { GenerationTask } from '@shared/types/generation'
import type { ImageSize } from '@shared/types/generation'
import type {
  ProductSetRequest,
  ProductSetResult,
  ProductSetSlide,
  ProductAnalysis
} from '@shared/ecommerce-workflow/product-set-types'

// ── Slide 预设定义 ──

const SLIDE_DEFAULTS: Array<{
  type: ProductSetSlide['type']
  label: string
  size: ImageSize
}> = [
  { type: 'main', label: '白底主图', size: '1024x1024' },
  { type: 'selling', label: '卖点海报', size: '1024x1536' },
  { type: 'scene', label: '场景图', size: '1536x1024' },
  { type: 'detail', label: '详情头图', size: '1024x1536' }
]

// ── Vision Analysis Prompt ──

const VISION_SYSTEM_PROMPT = `你是一个专业的电商视觉设计师。分析商品图片，输出 JSON：

{
  "productName": "商品名称",
  "category": "品类（如：美妆/食品/服饰/家居/数码）",
  "attributes": ["属性1", "属性2", "属性3"],
  "slides": [
    {
      "type": "main",
      "label": "白底主图",
      "prompt": "英文 prompt，描述白底产品图：柔和侧光、突出质感、纯白背景、高清产品摄影",
      "copyText": "主图文案（中文，简洁）"
    },
    {
      "type": "selling",
      "label": "卖点海报",
      "prompt": "英文 prompt，描述卖点海报：品牌色背景、核心卖点、视觉冲击力、电商海报风格",
      "copyText": "卖点文案（中文，有冲击力）"
    },
    {
      "type": "scene",
      "label": "场景图",
      "prompt": "英文 prompt，描述使用场景：产品融入生活场景、自然光、 lifestyle photography",
      "copyText": "场景文案（中文，有代入感）"
    },
    {
      "type": "detail",
      "label": "详情头图",
      "prompt": "英文 prompt，描述详情头图：产品局部特写、材质纹理、极简设计、电商详情页风格",
      "copyText": "详情文案（中文，突出品质）"
    }
  ]
}

要求：
- prompt 必须是英文，高质量，可直接用于 AI 图片生成
- copyText 是中文带货文案
- 根据实际商品品类调整视觉风格
- 只输出 JSON，不要额外说明`

/**
 * Vision 分析商品图，返回品名、品类、4 个 slide 的 prompt。
 */
async function analyzeProduct(
  productImageBase64: string,
  visionProviderId: string,
  visionModelId: string
): Promise<ProductAnalysis> {
  const resolved = await resolveProvider(visionProviderId)

  const settings: Record<string, string> = {}
  if (resolved.apiKey) settings.apiKey = resolved.apiKey
  if (resolved.baseURL) settings.baseURL = resolved.baseURL

  const result = await generateText(
    resolved.providerId as Parameters<typeof generateText>[0],
    settings as never,
    {
      model: visionModelId,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '分析这张商品图片，输出套图规划 JSON。'
            },
            {
              type: 'image',
              image: productImageBase64
            }
          ]
        }
      ],
      maxRetries: 1,
      temperature: 0.3
    }
  )

  const rawText = result.text || ''
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : rawText.trim()

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>

    return {
      productName: String(parsed.productName || '未命名商品'),
      category: String(parsed.category || '其他'),
      attributes: Array.isArray(parsed.attributes)
        ? parsed.attributes.map(String)
        : [],
      slides: Array.isArray(parsed.slides)
        ? parsed.slides.map((s: unknown) => {
            const slide = s as Record<string, unknown>
            return {
              type: (slide.type || 'main') as ProductSetSlide['type'],
              label: String(slide.label || ''),
              prompt: String(slide.prompt || ''),
              copyText: String(slide.copyText || '')
            }
          })
        : []
    }
  } catch {
    throw new Error(
      `Failed to parse vision analysis result as JSON. Raw: ${rawText.slice(0, 500)}`
    )
  }
}

/**
 * 等待一组生成任务全部完成。
 */
async function waitForTasks(
  taskIds: string[],
  timeoutMs = 300_000
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  const start = Date.now()
  const queue = getGenerationQueue()

  while (Date.now() - start < timeoutMs) {
    let allDone = true

    for (const taskId of taskIds) {
      if (results.has(taskId)) continue

      const fresh = queue.getTask(taskId)
      if (!fresh) continue

      if (fresh.status === 'completed') {
        const url = fresh.outputs?.[0]?.url
        if (url) results.set(taskId, url)
      } else if (fresh.status === 'failed') {
        results.set(taskId, '')
      } else {
        allDone = false
      }
    }

    if (allDone) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return results
}

/**
 * 生成电商套图。
 */
export async function generateProductSet(
  req: ProductSetRequest
): Promise<ProductSetResult> {
  const visionPid = req.visionProviderId || req.providerId
  const visionMid = req.visionModelId || req.modelId

  // Step 1: Vision 分析
  const analysis = await analyzeProduct(
    req.productImage,
    visionPid,
    visionMid
  )

  // Step 2: 确保至少 4 个 slide
  const slidePrompts = new Map<string, string>()
  const slideCopyTexts = new Map<string, string>()

  for (const s of analysis.slides) {
    slidePrompts.set(s.type, s.prompt)
    slideCopyTexts.set(s.type, s.copyText)
  }

  for (const def of SLIDE_DEFAULTS) {
    if (!slidePrompts.has(def.type)) {
      const fallback = slidePrompts.values().next().value
      slidePrompts.set(
        def.type,
        fallback || `Product photo of ${analysis.productName}, ${def.type} style, high quality`
      )
    }
  }

  // Step 3: 并行提交 4 个生成任务
  const slideTaskMap = new Map<string, string>() // taskId → slide type

  const slides: ProductSetSlide[] = SLIDE_DEFAULTS.map((def) => ({
    type: def.type,
    label: def.label,
    aspectRatio: def.size === '1024x1024' ? '1:1' : def.size === '1536x1024' ? '16:9' : '3:4',
    prompt: slidePrompts.get(def.type) || '',
    copyText: slideCopyTexts.get(def.type) || '',
    status: 'pending' as const
  }))

  for (const slide of slides) {
    const def = SLIDE_DEFAULTS.find((d) => d.type === slide.type)!
    const task = await createRoutedGenerationTask({
      providerId: req.providerId,
      model: req.modelId,
      prompt: slide.prompt,
      size: def.size,
      referenceImages: [req.productImage],
      referenceMode: 'fusion'
    })
    slideTaskMap.set(task.id, slide.type)
    slide.status = 'generating'
  }

  // Step 4: 等待完成
  const taskIds = Array.from(slideTaskMap.keys())
  const urls = await waitForTasks(taskIds)

  for (const slide of slides) {
    // 找到对应的 task id
    const taskId = Array.from(slideTaskMap.entries()).find(
      ([, type]) => type === slide.type
    )?.[0]

    if (taskId) {
      const url = urls.get(taskId)
      if (url) {
        slide.imageUrl = url
        slide.status = 'done'
      } else {
        slide.status = 'error'
        slide.error = 'Generation failed or timed out'
      }
    }
  }

  return {
    productName: analysis.productName,
    category: analysis.category,
    slides
  }
}
