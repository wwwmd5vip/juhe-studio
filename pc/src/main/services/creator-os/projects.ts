import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { assets, creatorTasks, deliverables, projects } from '../../db/schema'
import type { Project } from '@shared/types/creator-os'

export async function createProject(data: Partial<Project>): Promise<Project> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record: typeof projects.$inferInsert = {
    id,
    name: data.name || 'Untitled Project',
    category: data.category || 'product_set',
    status: data.status || 'draft',
    description: data.description || null,
    batchStatus: 'idle',
    batchError: null,
    createdAt: now,
    updatedAt: now
  }
  await db.insert(projects).values(record)
  return { ...record, batchStatus: 'idle' } as unknown as Project
}

export async function listProjects(): Promise<Project[]> {
  const rows = await db.select().from(projects).orderBy(projects.updatedAt)
  // Drizzle returns newest first by default with the above orderBy
  return rows as unknown as Project[]
}

export async function getProject(id: string): Promise<Project | null> {
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  return (result[0] as unknown as Project) ?? null
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
  const now = new Date().toISOString()
  await db
    .update(projects)
    .set({ ...data, updatedAt: now } as typeof projects.$inferInsert)
    .where(eq(projects.id, id))
  return (await getProject(id))!
}

export async function deleteProject(id: string): Promise<void> {
  // Cascade: delete child assets, creatorTasks, deliverables first
  await db.transaction(async (tx) => {
    await tx.delete(assets).where(eq(assets.projectId, id))
    await tx.delete(creatorTasks).where(eq(creatorTasks.projectId, id))
    await tx.delete(deliverables).where(eq(deliverables.projectId, id))
    await tx.delete(projects).where(eq(projects.id, id))
  })
}
