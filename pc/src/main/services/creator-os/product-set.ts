import type { GenerationParams } from '@shared/types/generation'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { assets, creatorTasks, deliverables, models, projects } from '../../db/schema'
import { getGenerationQueue } from '../queue'
import type {
  BatchStatus,
  CreatorTask,
  ProductSetCancelResult,
  ProductSetRetryResult,
  ProductSetSubmitResult,
  ProductSetTemplate,
  Project
} from '@shared/types/creator-os'
import { computeBatchStatus } from '@shared/utils/creator-os-status'
import { validatePreflight } from './preflight'

async function getDefaultImageModel(): Promise<{ id: string; providerId: string } | null> {
  const modelRow = await db
    .select({ id: models.id, providerId: models.providerId })
    .from(models)
    .where(eq(models.type, 'image'))
    .limit(1)
  const row = modelRow[0]
  return row ? { id: row.id, providerId: row.providerId } : null
}

/**
 * 提交套图生成任务，同时传入每槽位的生成参数（model、providerId、prompt 等）。
 * 这是 Creator OS 的推荐入口：renderer 收集用户配置后通过 IPC 调用。
 */
export async function submitProductSetWithParams(
  projectId: string,
  slotParams: Record<string, GenerationParams>
): Promise<ProductSetSubmitResult> {
  const now = new Date().toISOString()
  const queue = getGenerationQueue()

  const projRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  const project = projRows[0]
  if (!project) return { ok: false, error: 'Project not found' }

  const sourceAssets = await db.select().from(assets).where(eq(assets.projectId, projectId))

  // Validate that we have exactly 8 slots
  const slotIds = Object.keys(slotParams)
  if (slotIds.length !== 8) {
    return { ok: false, error: `Expected 8 slot params, got ${slotIds.length}` }
  }

  const runtimeTaskIds: string[] = []

  try {
    for (let i = 0; i < slotIds.length; i++) {
      const slotId = slotIds[i]
      const params = slotParams[slotId]
      const taskId = crypto.randomUUID()
      const runtimeTaskId = crypto.randomUUID()
      runtimeTaskIds.push(runtimeTaskId)

      await db.insert(creatorTasks).values({
        id: taskId,
        projectId,
        runtimeTaskId,
        templateSlotId: slotId,
        slotIndex: i,
        status: 'pending',
        runtimeStatus: 'pending',
        createdAt: now,
        updatedAt: now
      } as typeof creatorTasks.$inferInsert)

      await db.insert(deliverables).values({
        id: crypto.randomUUID(),
        projectId,
        taskId,
        versionId: null,
        label: slotId,
        slotIndex: i,
        isSelected: true,
        sortOrder: i,
        createdAt: now,
        updatedAt: now
      } as typeof deliverables.$inferInsert)
    }

    // Enqueue with actual params
    for (let i = 0; i < slotIds.length; i++) {
      const params = slotParams[slotIds[i]]
      queue.createTask('image', params, 'normal', { id: runtimeTaskIds[i] })
    }

    await db
      .update(projects)
      .set({ batchStatus: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))

    return { ok: true, taskCount: slotIds.length, runtimeTaskIds }
  } catch (err) {
    await db
      .update(projects)
      .set({ batchStatus: 'partial', batchError: String(err), updatedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))
    return { ok: false, error: String(err) }
  }
}

const PRODUCT_SET_TEMPLATES: ProductSetTemplate[] = [
  {
    id: 'standard-8',
    name: 'Standard 8-Slot Product Set',
    slots: [
      { id: 'main', label: '主图', modelId: '', providerId: '', type: 'image', required: true },
      { id: 'detail-1', label: '细节图 1', modelId: '', providerId: '', type: 'image', required: true },
      { id: 'detail-2', label: '细节图 2', modelId: '', providerId: '', type: 'image', required: true },
      { id: 'scene', label: '场景图', modelId: '', providerId: '', type: 'image', required: false },
      { id: 'color-1', label: '颜色变体 1', modelId: '', providerId: '', type: 'image', required: false },
      { id: 'color-2', label: '颜色变体 2', modelId: '', providerId: '', type: 'image', required: false },
      { id: 'size', label: '尺寸图', modelId: '', providerId: '', type: 'image', required: false },
      { id: 'packaging', label: '包装图', modelId: '', providerId: '', type: 'image', required: false }
    ]
  }
]

function getTemplate(templateId: string): ProductSetTemplate | undefined {
  return PRODUCT_SET_TEMPLATES.find((t) => t.id === templateId)
}

export async function submitProductSet(
  projectId: string,
  templateId: string
): Promise<ProductSetSubmitResult> {
  const now = new Date().toISOString()
  const queue = getGenerationQueue()

  const projRows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  const project = projRows[0]
  if (!project) return { ok: false, error: 'Project not found' }

  const template = getTemplate(templateId)
  if (!template) return { ok: false, error: `Template "${templateId}" not found` }

  const sourceAssets = await db.select().from(assets).where(eq(assets.projectId, projectId))

  const preflight = await validatePreflight(
    project as unknown as Project,
    sourceAssets as unknown as Parameters<typeof validatePreflight>[1],
    template
  )
  if (!preflight.ok) return { ok: false, error: preflight.errors.join('; '), warnings: preflight.warnings }

  await db
    .update(projects)
    .set({ batchStatus: 'submitting', updatedAt: now })
    .where(eq(projects.id, projectId))

  const runtimeTaskIds: string[] = []

  try {
    for (let i = 0; i < template.slots.length; i++) {
      const slot = template.slots[i]
      const taskId = crypto.randomUUID()
      const runtimeTaskId = crypto.randomUUID()
      runtimeTaskIds.push(runtimeTaskId)

      await db.insert(creatorTasks).values({
        id: taskId,
        projectId,
        runtimeTaskId,
        templateSlotId: slot.id,
        slotIndex: i,
        status: 'pending',
        runtimeStatus: 'pending',
        createdAt: now,
        updatedAt: now
      } as typeof creatorTasks.$inferInsert)

      // Also create a tentative deliverable
      await db.insert(deliverables).values({
        id: crypto.randomUUID(),
        projectId,
        taskId,
        versionId: null,
        label: slot.label,
        slotIndex: i,
        isSelected: true,
        sortOrder: i,
        createdAt: now,
        updatedAt: now
      } as typeof deliverables.$inferInsert)
    }

    // Enqueue all tasks — auto-resolve empty model/provider
    const defaultModel = await getDefaultImageModel()
    for (let i = 0; i < template.slots.length; i++) {
      const slot = template.slots[i]
      const providerId = slot.providerId || defaultModel?.providerId || ''
      const model = slot.modelId || defaultModel?.id || ''
      queue.createTask(
        'image',
        {
          providerId,
          model,
          prompt: slot.label
        },
        'normal',
        { id: runtimeTaskIds[i] }
      )
    }

    await db
      .update(projects)
      .set({ batchStatus: 'processing', updatedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))

    return { ok: true, taskCount: template.slots.length, runtimeTaskIds }
  } catch (err) {
    await db
      .update(projects)
      .set({ batchStatus: 'partial', batchError: String(err), updatedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))
    return { ok: false, error: String(err) }
  }
}

export async function getBatchStatus(projectId: string): Promise<BatchStatus> {
  const tasks = await db
    .select()
    .from(creatorTasks)
    .where(eq(creatorTasks.projectId, projectId))
  return computeBatchStatus(tasks as unknown as CreatorTask[])
}

export async function retryProductSetItems(
  projectId: string,
  taskIds: string[]
): Promise<ProductSetRetryResult> {
  const queue = getGenerationQueue()
  let retried = 0
  const errors: string[] = []

  for (const taskId of taskIds) {
    const rows = await db.select().from(creatorTasks).where(eq(creatorTasks.id, taskId)).limit(1)
    const cTask = rows[0]
    if (!cTask) { errors.push(`Task ${taskId} not found`); continue }
    if (cTask.runtimeStatus === 'completed') { errors.push(`Task ${taskId} already completed`); continue }

    await db
      .update(creatorTasks)
      .set({ runtimeStatus: 'pending', errorMessage: null, updatedAt: new Date().toISOString() })
      .where(eq(creatorTasks.id, taskId))

    queue.createTask('image', {} as GenerationParams, 'normal', { id: cTask.runtimeTaskId })
    retried++
  }

  return { ok: errors.length === 0, retriedCount: retried, errors }
}

export async function cancelProductSet(projectId: string): Promise<ProductSetCancelResult> {
  const queue = getGenerationQueue()
  const tasks = await db
    .select()
    .from(creatorTasks)
    .where(and(eq(creatorTasks.projectId, projectId)))

  let cancelled = 0
  for (const cTask of tasks) {
    if (cTask.runtimeStatus === 'completed') continue
    try {
      queue.cancelTask(cTask.runtimeTaskId)
    } catch { /* already done */ }
    await db
      .update(creatorTasks)
      .set({ runtimeStatus: 'cancelled', updatedAt: new Date().toISOString() })
      .where(eq(creatorTasks.id, cTask.id))
    cancelled++
  }

  await db
    .update(projects)
    .set({ batchStatus: 'idle', updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId))

  return { ok: true, cancelledCount: cancelled }
}
