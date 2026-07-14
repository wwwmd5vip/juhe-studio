import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { creatorTasks, versions } from '../../db/schema'

/**
 * 当生成任务的运行时执行器完成执行后，协调 creatorTasks 状态
 * 并将成功结果物化为 versions 行。
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
        await tx.insert(versions).values({
          id: crypto.randomUUID(),
          taskId: row.id,
          generationId: genRecord.id,
          versionNumber: vi + 1,
          filePath: urlArray[vi],
          mimeType: 'image/png',
          isSelected: vi === 0,
          metadata: null,
          createdAt: now
        } as typeof versions.$inferInsert)
      }
    }
  })
}
