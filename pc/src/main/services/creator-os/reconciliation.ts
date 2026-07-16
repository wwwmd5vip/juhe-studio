import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { creatorTasks, deliverables, projects, versions } from '../../db/schema'

/**
 * 当生成任务的运行时执行器完成执行后，协调 creatorTasks 状态
 * 并将成功结果物化为 versions 行，同时更新 deliverables.versionId。
 */
export async function reconcileCreatorTask(
  runtimeTaskId: string,
  status: 'completed' | 'failed',
  genRecord: { id: string; resultUrls?: string | null; errorMessage?: string | null }
) {
  const now = new Date().toISOString()
  const cTask = await db
    .select()
    .from(creatorTasks)
    .where(eq(creatorTasks.runtimeTaskId, runtimeTaskId))
    .limit(1)
  const row = cTask[0]
  if (!row) return

  const newRuntimeStatus = status === 'completed' ? 'completed' : 'failed'

  await db.transaction(async (tx) => {
    await tx
      .update(creatorTasks)
      .set({
        runtimeStatus: newRuntimeStatus,
        errorMessage: genRecord.errorMessage ?? null,
        updatedAt: now
      })
      .where(eq(creatorTasks.runtimeTaskId, runtimeTaskId))

    if (status === 'completed' && genRecord.resultUrls) {
      const urls =
        typeof genRecord.resultUrls === 'string'
          ? JSON.parse(genRecord.resultUrls)
          : genRecord.resultUrls
      const urlArray = Array.isArray(urls) ? urls : []
      for (let vi = 0; vi < urlArray.length; vi++) {
        const versionId = crypto.randomUUID()
        await tx.insert(versions).values({
          id: versionId,
          taskId: row.id,
          generationId: genRecord.id,
          versionNumber: vi + 1,
          filePath: urlArray[vi],
          mimeType: 'image/png',
          isSelected: vi === 0,
          metadata: null,
          createdAt: now
        } as typeof versions.$inferInsert)

        // Link deliverable to the first version
        if (vi === 0) {
          await tx
            .update(deliverables)
            .set({ versionId, updatedAt: now })
            .where(eq(deliverables.taskId, row.id))
        }
      }
    }

    // Finalize batchStatus when all tasks for this project are done
    const allTasks = await tx
      .select({ runtimeStatus: creatorTasks.runtimeStatus })
      .from(creatorTasks)
      .where(eq(creatorTasks.projectId, row.projectId))

    const pending = allTasks.filter((t) => t.runtimeStatus === 'pending' || t.runtimeStatus === 'submitting' || t.runtimeStatus === 'processing')
    if (pending.length === 0) {
      const failed = allTasks.filter((t) => t.runtimeStatus === 'failed')
      const finalStatus = failed.length === allTasks.length ? 'failed' : failed.length > 0 ? 'partial' : 'completed'
      await tx
        .update(projects)
        .set({ batchStatus: finalStatus, updatedAt: now })
        .where(eq(projects.id, row.projectId))
    }
  })
}
