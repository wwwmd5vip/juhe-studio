import type { FastifyInstance } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { z } from 'zod'
import { db } from '../../db/connection.js'
import { startConsumer } from '../../services/batch-generator.js'
import { requireAuth, getCsrfToken, verifyCsrfToken } from './auth.js'

const flatJobSchema = z.object({
  prompt_ids: z.string().min(1),
  name: z.string().optional(),
  provider_config_base_url: z.string().url(),
  provider_config_api_key: z.string().min(1),
  provider_config_model: z.string().min(1),
  provider_config_size: z.string().regex(/^\d+x\d+$/),
  provider_config_response_format: z.enum(['url', 'b64_json']).default('url'),
  placeholder_value: z.string().optional(),
  concurrency: z.coerce.number().min(1).max(10).optional()
})

function getSetting(key: string, defaultValue: unknown): unknown {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value?: string }
    | undefined
  if (!row?.value) return defaultValue
  try {
    return JSON.parse(row.value)
  } catch {
    return row.value
  }
}

export async function generateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST') {
      await verifyCsrfToken(request, reply)
    }
  })

  app.get('/generate', async (request, reply) => {
    const rows = db
      .prepare('SELECT id, title, content, category FROM prompts WHERE is_enabled = 1 ORDER BY id DESC LIMIT 100')
      .all() as { id: number; title?: string; content: string; category?: string }[]

    return reply.view('pages/generate.ejs', {
      title: '批量生成',
      error: null,
      csrfToken: getCsrfToken(request),
      prompts: rows
    })
  })

  app.post('/jobs', async (request, reply) => {
    const parsed = flatJobSchema.safeParse(request.body)
    if (!parsed.success) {
      const rows = db
        .prepare('SELECT id, title, content, category FROM prompts WHERE is_enabled = 1 ORDER BY id DESC LIMIT 100')
        .all() as { id: number; title?: string; content: string; category?: string }[]
      return reply.view('pages/generate.ejs', {
        title: '批量生成',
        error: parsed.error.message,
        csrfToken: getCsrfToken(request),
        prompts: rows
      })
    }

    const body = parsed.data
    const promptIds = body.prompt_ids
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0)

    if (promptIds.length === 0 || promptIds.length > 2000) {
      const rows = db
        .prepare('SELECT id, title, content, category FROM prompts WHERE is_enabled = 1 ORDER BY id DESC LIMIT 100')
        .all() as { id: number; title?: string; content: string; category?: string }[]
      return reply.view('pages/generate.ejs', {
        title: '批量生成',
        error: 'Invalid prompt selection',
        csrfToken: getCsrfToken(request),
        prompts: rows
      })
    }

    const maxSize = getSetting('max_job_size', 500) as number
    if (promptIds.length > maxSize) {
      const rows = db
        .prepare('SELECT id, title, content, category FROM prompts WHERE is_enabled = 1 ORDER BY id DESC LIMIT 100')
        .all() as { id: number; title?: string; content: string; category?: string }[]
      return reply.view('pages/generate.ejs', {
        title: '批量生成',
        error: `Exceeds max job size (${maxSize})`,
        csrfToken: getCsrfToken(request),
        prompts: rows
      })
    }

    // Validate all prompt IDs exist and are enabled
    const placeholders = promptIds.map(() => '?').join(',')
    const validationRows = db
      .prepare(`SELECT id, is_enabled FROM prompts WHERE id IN (${placeholders})`)
      .all(...promptIds) as { id: number; is_enabled: number }[]
    const foundIds = new Set(validationRows.map((r) => r.id))
    const missing = promptIds.filter((id) => !foundIds.has(id))
    if (missing.length > 0) {
      const rows = db
        .prepare('SELECT id, title, content, category FROM prompts WHERE is_enabled = 1 ORDER BY id DESC LIMIT 100')
        .all() as { id: number; title?: string; content: string; category?: string }[]
      return reply.view('pages/generate.ejs', {
        title: '批量生成',
        error: `Prompt IDs not found: ${missing.join(', ')}`,
        csrfToken: getCsrfToken(request),
        prompts: rows
      })
    }
    const disabled = validationRows.filter((r) => !r.is_enabled).map((r) => r.id)
    if (disabled.length > 0) {
      const rows = db
        .prepare('SELECT id, title, content, category FROM prompts WHERE is_enabled = 1 ORDER BY id DESC LIMIT 100')
        .all() as { id: number; title?: string; content: string; category?: string }[]
      return reply.view('pages/generate.ejs', {
        title: '批量生成',
        error: `Prompt IDs disabled: ${disabled.join(', ')}`,
        csrfToken: getCsrfToken(request),
        prompts: rows
      })
    }

    const defaultConfig = (getSetting('default_provider_config', {}) as Record<string, unknown>) || {}
    const mergedConfig = {
      ...defaultConfig,
      base_url: body.provider_config_base_url,
      api_key: body.provider_config_api_key,
      model: body.provider_config_model,
      size: body.provider_config_size,
      response_format: body.provider_config_response_format
    }

    const placeholder = body.placeholder_value ?? (getSetting('default_placeholder', '') as string)
    const concurrency = body.concurrency ?? (getSetting('default_concurrency', 2) as number)

    const categoryRow = db.prepare('SELECT category FROM prompts WHERE id = ?').get(promptIds[0]) as
      | { category?: string }
      | undefined
    const name =
      body.name ||
      `${categoryRow?.category || '批量生成'}-${promptIds.length}条-${new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 12)}`

    const createJob = db.transaction(
      (jobName: string, config: string, placeholderValue: string | undefined, count: number, jobConcurrency: number, ids: number[]) => {
        const jobInfo = db
          .prepare(
            'INSERT INTO jobs (name, provider_config, placeholder_value, total_count, concurrency) VALUES (?, ?, ?, ?, ?)'
          )
          .run(jobName, config, placeholderValue ?? null, count, jobConcurrency)
        const jobId = Number(jobInfo.lastInsertRowid)

        const insertItem = db.prepare('INSERT INTO job_items (job_id, prompt_id) VALUES (?, ?)')
        const updatePrompt = db.prepare("UPDATE prompts SET generation_status = 'pending' WHERE id = ?")
        for (const pid of ids) {
          insertItem.run(jobId, pid)
          updatePrompt.run(pid)
        }
        return jobId
      }
    )

    const jobId = createJob(name, JSON.stringify(mergedConfig), placeholder, promptIds.length, concurrency, promptIds)

    startConsumer().catch(console.error)
    return reply.redirect(`/admin/jobs/${jobId}`)
  })
}
