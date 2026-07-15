import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { deliverables, versions } from '../../db/schema'
import type { Deliverable } from '@shared/types/creator-os'

export async function materializeDeliverable(
  projectId: string,
  taskId: string,
  slotIndex: number,
  templateSlotId: string
): Promise<Deliverable> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record: typeof deliverables.$inferInsert = {
    id,
    projectId,
    taskId,
    versionId: null,
    label: templateSlotId,
    slotIndex,
    isSelected: true,
    sortOrder: slotIndex,
    createdAt: now,
    updatedAt: now
  }
  await db.insert(deliverables).values(record)
  return { ...record, versionFilePath: null } as unknown as Deliverable
}

export async function getDeliverablesForProject(projectId: string): Promise<Deliverable[]> {
  const rows = await db
    .select({
      id: deliverables.id,
      projectId: deliverables.projectId,
      taskId: deliverables.taskId,
      versionId: deliverables.versionId,
      versionFilePath: versions.filePath,
      label: deliverables.label,
      slotIndex: deliverables.slotIndex,
      isSelected: deliverables.isSelected,
      sortOrder: deliverables.sortOrder,
      createdAt: deliverables.createdAt,
      updatedAt: deliverables.updatedAt
    })
    .from(deliverables)
    .leftJoin(versions, eq(deliverables.versionId, versions.id))
    .where(eq(deliverables.projectId, projectId))
    .orderBy(deliverables.sortOrder)
  return rows as unknown as Deliverable[]
}

export async function updateDeliverable(
  id: string,
  data: Partial<Pick<Deliverable, 'label' | 'isSelected' | 'sortOrder'>>
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .update(deliverables)
    .set({ ...data, updatedAt: now } as typeof deliverables.$inferInsert)
    .where(eq(deliverables.id, id))
}
