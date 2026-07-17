import type { FastifyInstance } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { z } from 'zod'
import { db } from '../../db/connection.js'
import { cancelCurrentJob } from '../../services/batch-generator.js'
import { requireAuth, getCsrfToken, verifyCsrfToken } from './auth.js'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

type JobItemRow = {
  id: number
  prompt_id: number
  status: string
  error_message?: string
  image_path?: string
  attempt_count: number
}

export async function jobsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST') {
      await verifyCsrfToken(request, reply)
    }
  })

  app.get('/jobs', async (request, reply) => {
    const rows = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 100').all() as {
      id: number
      name: string
      status: string
      completed_count: number
      total_count: number
      failed_count: number
      concurrency: number
      created_at: string
    }[]
    return reply.view('pages/jobs.ejs', {
      title: '生成任务',
      error: null,
      csrfToken: getCsrfToken(request),
      jobs: rows
    })
  })

  app.get('/jobs/:id', async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send('Invalid id')
    }

    const { id } = parsed.data
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)
    if (!job) {
      return reply.status(404).send('Not found')
    }

    return reply.view('pages/job-detail.ejs', {
      title: '任务详情',
      error: null,
      csrfToken: getCsrfToken(request),
      job
    })
  })

  app.get('/api/jobs/:id', async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid id',
        code: 'INVALID_PARAMETER',
        details: parsed.error.format()
      })
    }

    const { id } = parsed.data
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)
    if (!job) {
      return reply.status(404).send({ error: 'Not found' })
    }
    return job
  })

  app.get('/api/jobs/:id/items', async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid id',
        code: 'INVALID_PARAMETER',
        details: parsedParams.error.format()
      })
    }

    const querySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      pageSize: z.coerce.number().min(1).max(100).default(20)
    })
    const parsedQuery = querySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        code: 'INVALID_PARAMETER',
        details: parsedQuery.error.format()
      })
    }

    const { id } = parsedParams.data
    const { page, pageSize } = parsedQuery.data
    const limit = pageSize
    const offset = (page - 1) * limit
    const items = db
      .prepare('SELECT * FROM job_items WHERE job_id = ? ORDER BY id LIMIT ? OFFSET ?')
      .all(id, limit, offset) as JobItemRow[]

    return { data: items }
  })

  app.post('/jobs/:id/cancel', async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send('Invalid id')
    }

    const { id } = parsed.data
    const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(id) as
      | { status: string }
      | undefined
    if (!job || (job.status !== 'pending' && job.status !== 'running')) {
      return reply.status(400).send('Can only cancel pending or running jobs')
    }

    if (job.status === 'running') {
      cancelCurrentJob()
    }

    const cancelJob = db.transaction((jobId: number) => {
      db.prepare(
        "UPDATE job_items SET status = 'cancelled' WHERE job_id = ? AND status IN ('pending', 'processing')"
      ).run(jobId)
      db.prepare(
        "UPDATE jobs SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('pending', 'running')"
      ).run(jobId)
    })
    cancelJob(id)
    return reply.redirect('/admin/jobs')
  })
}
