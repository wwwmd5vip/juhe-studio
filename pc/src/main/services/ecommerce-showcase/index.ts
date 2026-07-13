import crypto from 'node:crypto'
import { generateText } from '@cherrystudio/ai-core'
import { estimateShowcaseCost } from '@shared/ecommerce-workflow/cost-estimate'
import { LANGUAGES, MARKETS, PLATFORMS } from '@shared/ecommerce-workflow/enums'
import { getModuleTypeById } from '@shared/ecommerce-workflow/module-types'
import { LANGUAGE_NAMES, MARKET_TONE } from '@shared/ecommerce-workflow/platform-presets'
import { DEFAULT_ASPECT_RATIOS } from '@shared/ecommerce-workflow/platform-ratio'
import { PLATFORM_STYLES } from '@shared/ecommerce-workflow/platform-styles'
import {
  type GenerateImagesInput,
  type GeneratePlanInput,
  type GenerateSellingPointsInput,
  type ImagesResult,
  PlanModuleSchema,
  type PlanResult,
  type SellingPointsResult,
  type ShowcaseTask,
  type ShowcaseTaskStatus
} from '@shared/ecommerce-workflow/showcase-types'
import { errorMessage } from '@shared/utils/error-classifier'
import { buildProductOnlyPrompt } from '@shared/utils/image-prompt-safety'
import { and, desc, eq, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db'
import { showcaseTasks } from '../../db/schema'
import type { ContentPart } from '../ecommerce-workflow/utils'
import {
  aspectRatioToImageSize,
  buildAiCoreSettings,
  checkCapability,
  filePathToBase64DataUrl,
  mapProviderType,
  resolveProviderConfig
} from '../ecommerce-workflow/utils'
import { createRoutedGenerationTask } from '../generation-router'
import { getGenerationQueue } from '../queue'
import { parsePlan, parseSellingPoints } from './parsers'
import { buildPlanPrompt, buildSellingPointsPrompt } from './prompts'

const BaseInputSchema = z.object({
  productImage: z.string().min(1),
  platform: z.enum(PLATFORMS),
  market: z.enum(MARKETS),
  language: z.enum(LANGUAGES),
  visionChatProviderId: z.string().min(1),
  visionChatModelId: z.string().min(1)
})

const SellingPointsInputSchema = BaseInputSchema.extend({
  productText: z.string().optional()
})

const PlanInputSchema = BaseInputSchema.extend({
  productText: z.string().optional(),
  modules: z.array(z.string()).min(1),
  sellingPoints: z.array(z.string()).min(1)
})

const ImagesInputSchema = BaseInputSchema.extend({
  productText: z.string().optional(),
  imageProviderId: z.string().min(1),
  imageModelId: z.string().min(1),
  plan: z.object({ modules: z.array(PlanModuleSchema).min(1) })
})

function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    throw new Error(`Invalid input: ${issues}`)
  }
  return result.data
}

const abortControllers = new Map<string, AbortController>()

const HUMAN_SCENE_RE =
  /\b(woman|women|man|men|girl|boy|person|people|model|face|faces|body|bodies|leg|legs|foot|feet|wearing|wears|walking|walking\s+in|try-?on|on\s+feet|footwear\s+on\s+feet)\b|女性|男性|女人|男人|女孩|男孩|真人|人物|人像|模特|用户|脸|面部|身体|腿|脚|脚部|穿着|脚穿|试穿|走路|行走|咖啡厅|街边|咖啡馆|街道|街头/i

const MODULE_PROMPT_REWRITES: Record<string, { zh: string; en: string }> = {
  model_scene: {
    zh: '商品单品静物展示场景，产品放置在干净台面、展示架或柔和背景前，突出材质、轮廓和搭配氛围，不出现人物、脚部、试穿、脸部或身体部位，商业摄影，高质感光线',
    en: 'Product-only still-life display, product placed on a clean tabletop, display stand, or soft background, emphasizing materials, silhouette, and styling mood, no people, no feet, no try-on, no faces, no body parts, commercial photography, premium lighting'
  },
  user_review: {
    zh: '商品口碑反馈静物场景，产品放在整洁台面上，周围搭配评分卡、便签、包装或生活道具，传达舒适、耐用和好评氛围，不出现人物、脚部、试穿、脸部或身体部位，真实电商摄影',
    en: 'Product review still-life scene, product on a clean tabletop with rating card, notes, packaging, or lifestyle props, conveying comfort, durability, and positive feedback, no people, no feet, no try-on, no faces, no body parts, realistic e-commerce photography'
  },
  before_after: {
    zh: '商品前后对比版式，仅展示商品本身或商品状态变化，左右分栏对比，清晰标注视觉区域，不出现人物、脚部、试穿、脸部或身体部位，干净电商信息图风格',
    en: 'Before-and-after product comparison layout, showing only the product or product state change in side-by-side panels, clear visual sections, no people, no feet, no try-on, no faces, no body parts, clean e-commerce infographic style'
  }
}

function sanitizeImagePrompt(prompt: string, platform: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) return ''

  if (!HUMAN_SCENE_RE.test(trimmed)) {
    return trimmed
  }

  const platformHints = PLATFORM_STYLES[platform as keyof typeof PLATFORM_STYLES]
  const fallback = [
    'Standalone product commercial shot',
    `Platform style: ${platformHints.visualKeywords}`,
    `Composition: ${platformHints.compositionHint}`,
    `Color tone: ${platformHints.colorTone}`,
    'Scene: product placed on a clean tabletop, display stand, or neutral background',
    'No people, no bodies, no faces, no hands, no feet, no try-on, no lifestyle model',
    'High clarity, product-only, commercially usable'
  ]

  return fallback.join('\n')
}

function getModuleSafePrompt(
  moduleId: string,
  prompt: string,
  language: GenerateImagesInput['language'],
  platform: string
) {
  const rewrite = MODULE_PROMPT_REWRITES[moduleId]
  if (rewrite) {
    return language === 'zh' || language === 'zh-TW' ? rewrite.zh : rewrite.en
  }
  return sanitizeImagePrompt(prompt, platform)
}

export async function generateSellingPoints(input: GenerateSellingPointsInput): Promise<string> {
  validateInput(SellingPointsInputSchema, input)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(showcaseTasks).values({
    id,
    type: 'selling_points',
    status: 'pending',
    input: input as unknown as Record<string, unknown>,
    pointCost: estimateShowcaseCost('selling_points', 0),
    createdAt: now,
    updatedAt: now
  })
  console.log('[ShowcaseService] Task created:', { taskId: id, type: 'selling_points' })

  runSellingPoints(id, input).catch((error) => markFailed(id, error))
  return id
}

async function runTextStep<
  TInput extends GenerateSellingPointsInput | GeneratePlanInput,
  TResult extends SellingPointsResult | PlanResult
>(
  id: string,
  input: TInput,
  options: {
    requiredCapabilities: Array<'vision' | 'chat'>
    buildPrompt: (input: TInput) => { system: string; user: ContentPart[] }
    parse: (raw: string) => TResult
  }
) {
  const controller = new AbortController()
  abortControllers.set(id, controller)

  // Check if cancellation was already requested (race window with cancelTask)
  if (controller.signal.aborted) {
    await markCancelled(id, new Error('Cancelled'))
    return
  }

  try {
    await markRunning(id)
    const current = await getTask(id)
    if (!current || current.status !== 'running') {
      controller.abort()
      return
    }

    for (const cap of options.requiredCapabilities) {
      checkCapability(input.visionChatModelId, cap)
    }

    const { system, user } = options.buildPrompt({
      ...input,
      productImage: await filePathToBase64DataUrl(input.productImage)
    } as TInput)
    const providerConfig = await resolveProviderConfig(input.visionChatProviderId)
    const settings = buildAiCoreSettings(providerConfig)
    const providerId = mapProviderType(providerConfig.providerType)

    const result = await generateText(providerId as Parameters<typeof generateText>[0], settings as never, {
      model: input.visionChatModelId,
      system,
      messages: [{ role: 'user', content: user as never }],
      temperature: 0.7,
      maxRetries: 0,
      abortSignal: controller.signal
    })

    const parsed = options.parse(result.text ?? '')
    if (controller.signal.aborted) {
      await markCancelled(id, new Error('Cancelled'))
    } else {
      console.log('[ShowcaseService] Step completed:', { taskId: id })
      await markCompleted(id, parsed)
    }
  } catch (error) {
    if (controller.signal.aborted) {
      await markCancelled(id, error)
    } else {
      await markFailed(id, error)
    }
  } finally {
    abortControllers.delete(id)
  }
}

async function runSellingPoints(id: string, input: GenerateSellingPointsInput) {
  return runTextStep(id, input, {
    requiredCapabilities: ['vision', 'chat'],
    buildPrompt: buildSellingPointsPrompt,
    parse: parseSellingPoints
  })
}

export async function generatePlan(input: GeneratePlanInput): Promise<string> {
  validateInput(PlanInputSchema, input)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(showcaseTasks).values({
    id,
    type: 'plan',
    status: 'pending',
    input: input as unknown as Record<string, unknown>,
    pointCost: estimateShowcaseCost('plan', 0),
    createdAt: now,
    updatedAt: now
  })
  console.log('[ShowcaseService] Task created:', { taskId: id, type: 'plan' })

  runPlan(id, input).catch((error) => markFailed(id, error))
  return id
}

async function runPlan(id: string, input: GeneratePlanInput) {
  return runTextStep(id, input, {
    requiredCapabilities: ['chat'],
    buildPrompt: buildPlanPrompt,
    parse: parsePlan
  })
}

export async function generateImages(input: GenerateImagesInput): Promise<string> {
  validateInput(ImagesInputSchema, input)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.insert(showcaseTasks).values({
    id,
    type: 'images',
    status: 'pending',
    input: input as unknown as Record<string, unknown>,
    pointCost: estimateShowcaseCost('images', input.plan.modules.length),
    createdAt: now,
    updatedAt: now
  })
  console.log('[ShowcaseService] Task created:', { taskId: id, type: 'images' })

  runImages(id, input).catch((error) => markFailed(id, error))
  return id
}

async function runImages(id: string, input: GenerateImagesInput) {
  const controller = new AbortController()
  abortControllers.set(id, controller)

  // Check if cancellation was already requested (race window with cancelTask)
  if (controller.signal.aborted) {
    await markCancelled(id, new Error('Cancelled'))
    return
  }

  const generationSlots: Array<{ taskId: string; title: string; order: number }> = []
  let generationTaskIds: string[] = []
  const queue = getGenerationQueue()

  try {
    await markRunning(id)
    const current = await getTask(id)
    if (!current || current.status !== 'running') {
      controller.abort()
      return
    }

    checkCapability(input.imageModelId, 'image')

    const productImageDataUrl = await filePathToBase64DataUrl(input.productImage)

    console.log('[ShowcaseService] Image generation started:', { taskId: id, moduleCount: input.plan.modules.length })

    for (const module of input.plan.modules) {
      if (controller.signal.aborted) break

      const def = getModuleTypeById(module.id)
      const ratio = def?.defaultAspectRatio ?? DEFAULT_ASPECT_RATIOS[input.platform] ?? '1:1'
      const size = aspectRatioToImageSize(ratio)
      const safePrompt = getModuleSafePrompt(module.id, module.imagePrompt, input.language, input.platform)

      const prompt = buildProductOnlyPrompt(
        [
          'Create a product-only commercial composition.',
          'Exclude people, body parts, try-on scenes, and facial portraits.',
          'If the original module asks for a model, user, try-on, walking scene, cafe scene, street scene, feet, or body parts, ignore that request and render a product-only still-life scene instead.',
          safePrompt,
          `Platform style: ${PLATFORM_STYLES[input.platform].visualKeywords}`,
          `Composition: ${PLATFORM_STYLES[input.platform].compositionHint}`,
          `Color tone: ${PLATFORM_STYLES[input.platform].colorTone}`,
          `Market tone: ${MARKET_TONE[input.market].temperature}, ${MARKET_TONE[input.market].examples}`,
          `Language: ${LANGUAGE_NAMES[input.language]}`,
          `Copy to convey: ${module.copyRequirements}`
        ].join('\n'),
        {
          platformStyle: {
            visualKeywords: PLATFORM_STYLES[input.platform].visualKeywords,
            compositionHint: PLATFORM_STYLES[input.platform].compositionHint,
            colorTone: PLATFORM_STYLES[input.platform].colorTone
          }
        }
      )

      const task = await createRoutedGenerationTask({
        providerId: input.imageProviderId,
        model: input.imageModelId,
        prompt,
        size,
        aspectRatio: ratio,
        referenceImages: [productImageDataUrl],
        referenceMode: 'fusion'
      })
      generationSlots.push({ taskId: task.id, title: module.title, order: generationSlots.length })
      generationTaskIds = generationSlots.map((slot) => slot.taskId)
      await db
        .update(showcaseTasks)
        .set({
          generationTaskIds,
          result: {
            images: generationSlots.map((slot) => ({
              id: slot.taskId,
              order: slot.order,
              status: 'pending',
              title: slot.title
            }))
          },
          updatedAt: new Date().toISOString()
        })
        .where(eq(showcaseTasks.id, id))
    }

    if (generationSlots.length === 0) {
      await markFailed(id, new Error('No modules selected'))
      return
    }

    const images = await waitForGenerationTasks(id, generationSlots, controller.signal, queue)

    if (controller.signal.aborted) {
      await markCancelled(id, new Error('Cancelled'), { images })
      return
    }

    const successCount = images.filter((i) => i.status === 'success').length
    if (successCount > 0) {
      console.log('[ShowcaseService] Step completed:', { taskId: id, type: 'images' })
      await markCompleted(id, { images })
    } else {
      await markFailed(id, new Error('No images generated'), { images })
    }
  } catch (error) {
    queue.cancelTasks(generationTaskIds)
    const images = await waitForGenerationTasks(id, generationSlots, controller.signal, queue)
    if (controller.signal.aborted) {
      await markCancelled(id, error, { images })
    } else {
      await markFailed(id, error, { images })
    }
  } finally {
    abortControllers.delete(id)
  }
}

async function waitForGenerationTasks(
  showcaseTaskId: string,
  slots: Array<{ taskId: string; title: string; order: number }>,
  signal: AbortSignal,
  queue: ReturnType<typeof getGenerationQueue>
): Promise<ImagesResult['images']> {
  return new Promise((resolve) => {
    const images: ImagesResult['images'] = []

    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      clearInterval(interval)
      check()
    }
    signal.addEventListener('abort', onAbort)

    const check = () => {
      images.length = 0
      let allDone = true
      for (const slot of slots) {
        const taskId = slot.taskId
        const task = queue.getTask(taskId)
        if (!task) {
          images.push({ id: taskId, order: slot.order, status: 'error', error: 'Task not found' })
          continue
        }
        if (task.status === 'completed') {
          const output = task.outputs[0]
          if (output?.url) {
            images.push({ id: taskId, order: slot.order, status: 'success', url: output.url })
          } else {
            images.push({ id: taskId, order: slot.order, status: 'error', error: 'No image URL in generation output' })
          }
        } else if (task.status === 'failed' || task.status === 'cancelled') {
          images.push({ id: taskId, order: slot.order, status: 'error', error: task.error ?? 'Generation failed' })
        } else {
          allDone = false
          images.push({ id: taskId, order: slot.order, status: 'pending', title: slot.title })
        }
      }

      void db
        .update(showcaseTasks)
        .set({ result: { images: [...images].sort((a, b) => a.order - b.order) }, updatedAt: new Date().toISOString() })
        .where(eq(showcaseTasks.id, showcaseTaskId))
        .catch((error) => console.warn('[ShowcaseService] Failed to persist partial image results:', error))

      if (allDone || signal.aborted) {
        signal.removeEventListener('abort', onAbort)
        clearInterval(interval)
        resolve([...images].sort((a, b) => a.order - b.order))
      }
    }

    const interval = setInterval(check, 1000)
    check()
  })
}

export async function getTask(id: string): Promise<ShowcaseTask | undefined> {
  const rows = await db.select().from(showcaseTasks).where(eq(showcaseTasks.id, id)).limit(1)
  return rows[0] ? (rows[0] as unknown as ShowcaseTask) : undefined
}

export async function listTasks(limit = 20): Promise<ShowcaseTask[]> {
  const rows = await db.select().from(showcaseTasks).orderBy(desc(showcaseTasks.updatedAt)).limit(limit)
  return rows as unknown as ShowcaseTask[]
}

export async function cancelTask(id: string): Promise<void> {
  const task = await getTask(id)
  if (!task || task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return

  const controller = abortControllers.get(id)
  if (controller) {
    controller.abort()
  } else {
    await markCancelled(id, new Error('Cancelled'))
    const newController = abortControllers.get(id)
    if (newController) newController.abort()
  }

  if (task.generationTaskIds) {
    getGenerationQueue().cancelTasks(task.generationTaskIds)
  }
}

async function updateStatus(
  id: string,
  status: ShowcaseTaskStatus,
  errorMsg?: string,
  result?: SellingPointsResult | PlanResult | ImagesResult
) {
  await db
    .update(showcaseTasks)
    .set({
      status,
      errorMsg,
      result: result as unknown as Record<string, unknown> | undefined,
      updatedAt: new Date().toISOString()
    })
    .where(and(eq(showcaseTasks.id, id), or(eq(showcaseTasks.status, 'pending'), eq(showcaseTasks.status, 'running'))))
}

export async function markRunning(id: string) {
  await db
    .update(showcaseTasks)
    .set({ status: 'running', updatedAt: new Date().toISOString() })
    .where(and(eq(showcaseTasks.id, id), eq(showcaseTasks.status, 'pending')))
}

export async function markCompleted(id: string, result: SellingPointsResult | PlanResult | ImagesResult) {
  await updateStatus(id, 'completed', undefined, result)
}

export async function markFailed(id: string, error: unknown, result?: SellingPointsResult | PlanResult | ImagesResult) {
  const message = errorMessage(error)
  console.error('[ShowcaseService] Task failed:', { taskId: id, error: message })
  await updateStatus(id, 'failed', message, result)
}

export async function markCancelled(
  id: string,
  error: unknown,
  result?: SellingPointsResult | PlanResult | ImagesResult
) {
  const message = errorMessage(error)
  console.log('[ShowcaseService] Task cancelled:', { taskId: id, error: message })
  await updateStatus(id, 'cancelled', message, result)

  // If the row was already cancelled (race with cancelTask), still merge the result so partial outputs are preserved.
  if (result) {
    await db
      .update(showcaseTasks)
      .set({
        result: result as unknown as Record<string, unknown>,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(showcaseTasks.id, id), eq(showcaseTasks.status, 'cancelled')))
  }
}

export async function recoverRunningTasksOnStartup() {
  const tasks = await db.select().from(showcaseTasks).where(eq(showcaseTasks.status, 'running'))
  for (const task of tasks) {
    const showcaseTask = task as unknown as ShowcaseTask
    if (showcaseTask.type === 'images' && showcaseTask.generationTaskIds) {
      getGenerationQueue().cancelTasks(showcaseTask.generationTaskIds)
    }
    try {
      await markFailed(showcaseTask.id, new Error('App restarted'))
    } catch (err) {
      console.error('[ShowcaseService] Failed to mark task as failed during recovery:', { taskId: showcaseTask.id, error: err })
    }
  }
}
