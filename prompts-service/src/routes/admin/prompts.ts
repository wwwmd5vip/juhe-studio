import type { FastifyInstance } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { z } from 'zod'
import { db } from '../../db/connection.js'
import { requireAuth, getCsrfToken, verifyCsrfToken } from './auth.js'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

const editSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(4000),
  negative_prompt: z.string().max(2000).optional(),
  category: z.string().optional(),
  style: z.string().optional(),
  original_style: z.string().optional(),
  scene: z.string().optional(),
  image_type: z.string().optional(),
  product_category: z.string().optional(),
  platform_source: z.string().optional(),
  source_url: z.string().optional(),
  remark: z.string().optional(),
  tags: z.string().optional(),
  is_enabled: z.enum(['0', '1'])
})

type PromptListRow = {
  id: number
  title?: string
  content: string
  category?: string
  is_enabled: number
}

export async function adminPromptsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST') {
      await verifyCsrfToken(request, reply)
    }
  })

  app.get('/prompts', async (request, reply) => {
    const rows = db
      .prepare('SELECT id, title, content, category, is_enabled FROM prompts ORDER BY id DESC LIMIT 100')
      .all() as PromptListRow[]

    return reply.view('pages/prompts.ejs', {
      title: '提示词管理',
      error: null,
      csrfToken: getCsrfToken(request),
      prompts: rows
    })
  })

  app.get('/prompts/:id/edit', async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send('Invalid id')
    }

    const { id } = parsed.data
    const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id)
    if (!prompt) {
      return reply.status(404).send('Not found')
    }

    return reply.view('pages/prompt-edit.ejs', {
      title: '编辑提示词',
      error: null,
      csrfToken: getCsrfToken(request),
      prompt
    })
  })

  app.post('/prompts/:id/edit', async (request, reply) => {
    const parsedParams = paramsSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send('Invalid id')
    }
    const { id } = parsedParams.data

    const parsedBody = editSchema.safeParse(request.body)
    if (!parsedBody.success) {
      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id)
      if (!prompt) {
        return reply.status(404).send('Not found')
      }
      return reply.view('pages/prompt-edit.ejs', {
        title: '编辑提示词',
        error: parsedBody.error.message,
        csrfToken: getCsrfToken(request),
        prompt
      })
    }

    const body = parsedBody.data
    db.prepare(
      `UPDATE prompts SET
        title = ?, content = ?, negative_prompt = ?, category = ?, style = ?, original_style = ?,
        scene = ?, image_type = ?, product_category = ?, platform_source = ?, source_url = ?,
        remark = ?, tags = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    ).run(
      body.title ?? null,
      body.content,
      body.negative_prompt ?? null,
      body.category ?? null,
      body.style ?? null,
      body.original_style ?? null,
      body.scene ?? null,
      body.image_type ?? null,
      body.product_category ?? null,
      body.platform_source ?? null,
      body.source_url ?? null,
      body.remark ?? null,
      body.tags ?? null,
      body.is_enabled === '1' ? 1 : 0,
      id
    )

    return reply.redirect('/admin/prompts')
  })

  app.post('/prompts/:id/toggle', async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send('Invalid id')
    }

    const { id } = parsed.data
    const row = db.prepare('SELECT is_enabled FROM prompts WHERE id = ?').get(id) as
      | { is_enabled: number }
      | undefined
    if (!row) {
      return reply.status(404).send('Not found')
    }

    db.prepare('UPDATE prompts SET is_enabled = ? WHERE id = ?').run(row.is_enabled ? 0 : 1, id)
    return reply.redirect('/admin/prompts')
  })
}
