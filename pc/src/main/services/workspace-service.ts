/**
 * Workspace 服务 — CRUD + 查询实体归属
 */
import { eq, isNull, and } from 'drizzle-orm'
import { db } from '../db'
import { workspaces, chatSessions, workflows, promptTemplates } from '../db/schema'

export interface WorkspaceData {
  name: string
  description?: string
  icon?: string
  color?: string
}

export async function listWorkspaces() {
  return db.select().from(workspaces).orderBy(workspaces.name)
}

export async function getWorkspace(id: string) {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createWorkspace(data: WorkspaceData) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record = {
    id,
    name: data.name,
    description: data.description || null,
    icon: data.icon || 'folder',
    color: data.color || '#6366f1',
    createdAt: now,
    updatedAt: now
  }
  await db.insert(workspaces).values(record)
  return record
}

export async function updateWorkspace(id: string, data: Partial<WorkspaceData>) {
  const now = new Date().toISOString()
  await db
    .update(workspaces)
    .set({ ...data, updatedAt: now })
    .where(eq(workspaces.id, id))
  return getWorkspace(id)
}

export async function deleteWorkspace(id: string) {
  // 先解除关联
  await db.update(chatSessions).set({ workspaceId: null }).where(eq(chatSessions.workspaceId, id))
  await db.update(workflows).set({ workspaceId: null }).where(eq(workflows.workspaceId, id))
  await db.update(promptTemplates).set({ workspaceId: null }).where(eq(promptTemplates.workspaceId, id))

  await db.delete(workspaces).where(eq(workspaces.id, id))
}

/** 获取工作区下的实体统计 */
export async function getWorkspaceStats(id: string) {
  const [sessions, wfs, prompts] = await Promise.all([
    db.select().from(chatSessions).where(eq(chatSessions.workspaceId, id)),
    db.select().from(workflows).where(eq(workflows.workspaceId, id)),
    db.select().from(promptTemplates).where(eq(promptTemplates.workspaceId, id))
  ])
  return { sessions: sessions.length, workflows: wfs.length, prompts: prompts.length }
}

/** 获取未分类实体（workspaceId 为 null） */
export async function getUncategorizedCount() {
  const [sessions, wfs, prompts] = await Promise.all([
    db.select().from(chatSessions).where(isNull(chatSessions.workspaceId)),
    db.select().from(workflows).where(isNull(workflows.workspaceId)),
    db.select().from(promptTemplates).where(isNull(promptTemplates.workspaceId))
  ])
  return { sessions: sessions.length, workflows: wfs.length, prompts: prompts.length }
}
