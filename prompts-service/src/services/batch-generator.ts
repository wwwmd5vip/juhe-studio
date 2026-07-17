import fs from 'node:fs'
import path from 'node:path'
import pLimit from 'p-limit'
import sharp from 'sharp'
import { env } from '../config.js'
import { db } from '../db/connection.js'
import { generateImage, replacePlaceholders, type ProviderConfig } from './openai-image-client.js'

let isShuttingDown = false
let currentAbort: AbortController | null = null
let isConsuming = false
let currentJobId: number | null = null

export function shutdown(): void {
  isShuttingDown = true
  currentAbort?.abort()
}

export function cancelCurrentJob(): void {
  currentAbort?.abort()
}

export function startupRecovery(): void {
  const running = db.prepare('SELECT id FROM jobs WHERE status = ?').all('running') as { id: number }[]
  for (const job of running) {
    const recover = db.transaction((jobId: number) => {
      const { changes } = db.prepare(
        "UPDATE job_items SET status = 'failed', error_message = CASE WHEN error_message IS NULL OR error_message = '' THEN ? ELSE error_message END WHERE job_id = ? AND status IN ('pending', 'processing')"
      ).run('SERVICE_RESTART', jobId)
      db.prepare(
        "UPDATE prompts SET generation_status = 'failed' WHERE id IN (SELECT prompt_id FROM job_items WHERE job_id = ? AND status = 'failed') AND generation_status = 'processing'"
      ).run(jobId)
      const { completed, total } = db
        .prepare('SELECT completed_count as completed, total_count as total FROM jobs WHERE id = ?')
        .get(jobId) as { completed: number; total: number }
      const status = completed === total ? 'completed' : completed > 0 ? 'partially_failed' : 'failed'
      db.prepare('UPDATE jobs SET status = ?, failed_count = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        status,
        changes,
        jobId
      )
      return changes
    })
    const fixedCount = recover(job.id)
    console.log(`[batch-recovery] job ${job.id} recovered: ${fixedCount} items marked failed`)
  }
}

const finalizeJob = db.transaction((jobId: number) => {
  const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId) as
    | { status: string }
    | undefined
  if (!job || job.status !== 'running') return

  const counts = db
    .prepare(
      `SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
        COUNT(*) AS total
      FROM job_items
      WHERE job_id = ?`
    )
    .get(jobId) as { completed: number; failed: number; total: number }

  const status =
    counts.completed === counts.total
      ? 'completed'
      : counts.completed > 0 || counts.failed > 0
        ? 'partially_failed'
        : 'failed'
  db.prepare(
    'UPDATE jobs SET status = ?, completed_count = ?, failed_count = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, counts.completed, counts.failed, jobId)
})

export async function startConsumer(): Promise<void> {
  if (isShuttingDown) return
  if (isConsuming) return

  isConsuming = true

  try {
    while (!isShuttingDown) {
      const pending = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY id LIMIT 1').get('pending') as
        | { id: number; concurrency: number; provider_config: string; placeholder_value: string | null }
        | undefined
      if (!pending) break

      currentJobId = pending.id
      console.log(`[batch-consumer] starting job ${pending.id}`)

      db.prepare('UPDATE jobs SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?').run('running', pending.id)
      currentAbort = new AbortController()
      const concurrency = Math.max(1, Math.min(pending.concurrency, 32))
      const limit = pLimit(concurrency)
      const config = JSON.parse(pending.provider_config) as ProviderConfig
      const items = db.prepare('SELECT * FROM job_items WHERE job_id = ? AND status = ? ORDER BY id').all(
        pending.id,
        'pending'
      ) as { id: number; prompt_id: number }[]

      await Promise.all(
        items.map((item) =>
          limit(() => processItem(pending.id, item.id, item.prompt_id, config, pending.placeholder_value || '', currentAbort!.signal))
        )
      )

      const jobStatus = db.prepare('SELECT status FROM jobs WHERE id = ?').get(pending.id) as
        | { status: string }
        | undefined

      if (jobStatus?.status === 'running') {
        if (isShuttingDown) {
          const markRemaining = db.transaction((jobId: number) => {
            const { changes } = db
              .prepare("UPDATE job_items SET status = 'failed', error_message = ? WHERE job_id = ? AND status = ?")
              .run('SHUTDOWN_INTERRUPTED', jobId, 'pending')
            db.prepare('UPDATE jobs SET failed_count = failed_count + ? WHERE id = ?').run(changes, jobId)
            return changes
          })
          const remaining = markRemaining(pending.id)
          if (remaining > 0) {
            console.log(`[batch-consumer] job ${pending.id}: ${remaining} pending items marked failed due to shutdown`)
          }
        }

        finalizeJob(pending.id)
        console.log(`[batch-consumer] finalized job ${pending.id}`)
      } else {
        console.log(`[batch-consumer] job ${pending.id} already finalized, skipping`)
      }

      currentJobId = null
      currentAbort = null

      if (isShuttingDown) break

      // yield to the event loop before checking the next pending job
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[batch-consumer] unexpected error: ${msg}`)
    if (currentJobId !== null) {
      const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(currentJobId) as
        | { status: string }
        | undefined
      if (job?.status === 'running') {
        const failJob = db.transaction((jobId: number) => {
          const { changes } = db
            .prepare("UPDATE job_items SET status = 'failed', error_message = CASE WHEN error_message IS NULL OR error_message = '' THEN ? ELSE error_message END WHERE job_id = ? AND status IN ('pending', 'processing')")
            .run(msg, jobId)
          db.prepare('UPDATE jobs SET failed_count = failed_count + ? WHERE id = ?').run(changes, jobId)
          db.prepare(
            "UPDATE prompts SET generation_status = 'failed' WHERE id IN (SELECT prompt_id FROM job_items WHERE job_id = ? AND status = 'failed') AND generation_status = 'processing'"
          ).run(jobId)
          const { completed, total } = db
            .prepare('SELECT completed_count as completed, total_count as total FROM jobs WHERE id = ?')
            .get(jobId) as { completed: number; total: number }
          const status = completed === total ? 'completed' : completed > 0 ? 'partially_failed' : 'failed'
          db.prepare('UPDATE jobs SET status = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, jobId)
          return changes
        })
        const remaining = failJob(currentJobId)
        if (remaining > 0) {
          console.log(`[batch-consumer] job ${currentJobId}: ${remaining} items marked failed due to unexpected error`)
        }
      }
      currentJobId = null
    }
  } finally {
    currentJobId = null
    currentAbort = null
    isConsuming = false
  }
}

async function processItem(
  jobId: number,
  itemId: number,
  promptId: number,
  config: ProviderConfig,
  placeholder: string,
  signal: AbortSignal
): Promise<void> {
  if (isShuttingDown) {
    markItemFailed(itemId, promptId, jobId, 'SHUTDOWN_INTERRUPTED')
    console.log(`[batch-consumer] item ${itemId} failed: SHUTDOWN_INTERRUPTED`)
    return
  }

  markItemProcessing(itemId, promptId)

  const prompt = db.prepare('SELECT content FROM prompts WHERE id = ?').get(promptId) as { content: string } | undefined
  if (!prompt) {
    markPromptNotFound(itemId, jobId)
    console.log(`[batch-consumer] item ${itemId} failed: PROMPT_NOT_FOUND`)
    return
  }

  try {
    const finalPrompt = replacePlaceholders(prompt.content, placeholder)
    const buffer = await generateImage(config, finalPrompt, signal)
    const dir = path.join(env.UPLOAD_DIR, 'images', String(jobId))
    fs.mkdirSync(dir, { recursive: true })
    try {
      fs.accessSync(dir, fs.constants.W_OK)
    } catch {
      throw new Error('UPLOAD_DIR_NOT_WRITABLE')
    }
    const filePath = path.join(dir, `${promptId}.png`)
    await sharp(buffer).png().toFile(filePath)
    const relPath = `images/${jobId}/${promptId}.png`
    markItemCompleted(itemId, promptId, relPath, jobId)
  } catch (err: unknown) {
    const job =
      currentJobId !== null
        ? (db.prepare('SELECT status FROM jobs WHERE id = ?').get(currentJobId) as { status: string } | undefined)
        : undefined
    if (job?.status === 'cancelled') {
      markItemCancelled(itemId, promptId)
      console.log(`[batch-consumer] item ${itemId} cancelled`)
      return
    }

    const msg = err instanceof Error && err.name === 'AbortError' ? 'SHUTDOWN_INTERRUPTED' : getErrorMessage(err)
    markItemFailed(itemId, promptId, jobId, msg)
    console.log(`[batch-consumer] item ${itemId} failed: ${msg}`)
  }
}

const markItemProcessing = db.transaction((itemId: number, promptId: number) => {
  db.prepare("UPDATE job_items SET status = 'processing', attempt_count = attempt_count + 1 WHERE id = ?").run(itemId)
  db.prepare("UPDATE prompts SET generation_status = 'processing' WHERE id = ?").run(promptId)
})

const markItemCompleted = db.transaction((itemId: number, promptId: number, relPath: string, jobId: number) => {
  db.prepare("UPDATE job_items SET status = 'completed', image_path = ? WHERE id = ?").run(relPath, itemId)
  db.prepare('UPDATE prompts SET example_image_path = ?, generation_status = ? WHERE id = ?').run(relPath, 'completed', promptId)
  db.prepare('UPDATE jobs SET completed_count = completed_count + 1 WHERE id = ?').run(jobId)
})

const markItemFailed = db.transaction((itemId: number, promptId: number, jobId: number, msg: string) => {
  db.prepare("UPDATE job_items SET status = 'failed', error_message = ? WHERE id = ?").run(msg, itemId)
  db.prepare("UPDATE prompts SET generation_status = 'failed' WHERE id = ?").run(promptId)
  db.prepare('UPDATE jobs SET failed_count = failed_count + 1 WHERE id = ?').run(jobId)
})

const markItemCancelled = db.transaction((itemId: number, promptId: number) => {
  db.prepare("UPDATE job_items SET status = 'cancelled', error_message = 'CANCELLED' WHERE id = ?").run(itemId)
  db.prepare("UPDATE prompts SET generation_status = 'failed' WHERE id = ?").run(promptId)
})

const markPromptNotFound = db.transaction((itemId: number, jobId: number) => {
  db.prepare("UPDATE job_items SET status = 'failed', error_message = ? WHERE id = ?").run('PROMPT_NOT_FOUND', itemId)
  db.prepare('UPDATE jobs SET failed_count = failed_count + 1 WHERE id = ?').run(jobId)
})

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
