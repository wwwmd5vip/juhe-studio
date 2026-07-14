import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { creatorTasks, generations } from '../../db/schema'
import { reconcileCreatorTask } from './reconciliation'

/**
 * 应用启动时恢复中途退出的 creator tasks。
 * 当应用异常退出时，可能留下 runtimeStatus='submitting' 或 'processing' 的 task，
 * 需要检查对应的 generation record 是否已完成，并同步状态。
 */
export async function recoverStaleCreatorTasks(): Promise<number> {
  const stale = await db
    .select()
    .from(creatorTasks)
    .where(eq(creatorTasks.runtimeStatus, 'submitting'))

  let recovered = 0
  for (const task of stale) {
    try {
      const genRows = await db
        .select()
        .from(generations)
        .where(eq(generations.id, task.runtimeTaskId))
        .limit(1)

      if (genRows[0]) {
        const gen = genRows[0]
        if (gen.status === 'completed') {
          await reconcileCreatorTask(task.runtimeTaskId, 'completed', {
            id: gen.id,
            resultUrls: gen.resultUrls,
            errorMessage: gen.errorMessage
          })
          recovered++
        } else if (gen.status === 'failed') {
          await db
            .update(creatorTasks)
            .set({
              runtimeStatus: 'failed',
              errorMessage: gen.errorMessage,
              updatedAt: new Date().toISOString()
            })
            .where(eq(creatorTasks.runtimeTaskId, task.runtimeTaskId))
          recovered++
        }
      } else {
        // No generation record found → mark as failed
        await db
          .update(creatorTasks)
          .set({
            runtimeStatus: 'failed',
            errorMessage: 'Task lost: no generation record found (app may have quit before execution)',
            updatedAt: new Date().toISOString()
          })
          .where(eq(creatorTasks.runtimeTaskId, task.runtimeTaskId))
        recovered++
      }
    } catch (err) {
      console.error(`[Recovery] Failed to recover task ${task.runtimeTaskId}:`, err)
    }
  }

  return recovered
}
