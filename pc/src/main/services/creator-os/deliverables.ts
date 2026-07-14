import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { deliverables } from '../../db/schema'
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
  return record as unknown as Deliverable
}

export async function getDeliverablesForProject(projectId: string): Promise<Deliverable[]> {
  return (await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.projectId, projectId))
    .orderBy(deliverables.sortOrder)) as unknown as Deliverable[]
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
