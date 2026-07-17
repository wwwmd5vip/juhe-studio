import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/connection.js'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  style: z.string().optional(),
  scene: z.string().optional(),
  image_type: z.string().optional(),
  product_category: z.string().optional(),
  platform_source: z.string().optional(),
  has_image: z.enum(['true', 'false']).optional(),
  is_enabled: z.enum(['true', 'false']).default('true')
})

export async function promptsRoutes(app: FastifyInstance) {
  app.get('/', async (request, _reply) => {
    const q = querySchema.parse(request.query)
    const conditions: string[] = ['is_enabled = ?']
    const params: (string | number)[] = [q.is_enabled === 'true' ? 1 : 0]

    const addFilter = (field: string, value?: string) => {
      if (!value) return
      conditions.push(`${field} = ?`)
      params.push(value)
    }

    addFilter('category', q.category)
    addFilter('style', q.style)
    addFilter('scene', q.scene)
    addFilter('image_type', q.image_type)
    addFilter('product_category', q.product_category)
    addFilter('platform_source', q.platform_source)

    if (q.has_image === 'true') conditions.push('example_image_path IS NOT NULL')
    if (q.has_image === 'false') conditions.push('example_image_path IS NULL')

    if (q.search) {
      const terms = q.search.trim().split(/\s+/)
      for (const term of terms) {
        conditions.push(`(title LIKE ? OR content LIKE ? OR tags LIKE ?)`)
        const t = `%${term.replace(/[%_]/g, '\\$&')}%`
        params.push(t, t, t)
      }
    }

    const where = conditions.join(' AND ')
    const total = (db.prepare(`SELECT COUNT(*) as c FROM prompts WHERE ${where}`).get(...params) as { c: number }).c
    const offset = (q.page - 1) * q.pageSize
    const rows = db
      .prepare(
        `SELECT id, source_file, source_id, title, content, category, style, original_style, scene, image_type,
                product_category, platform_source, source_url, remark, tags,
                example_image_path, generation_status, usage_count, is_enabled,
                created_at, updated_at
         FROM prompts WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`
      )
      .all(...params, q.pageSize, offset) as any[]

    const data = rows.map((r) => ({
      ...r,
      example_image_url: r.example_image_path ? `/images/${r.example_image_path}` : null,
      is_enabled: Boolean(r.is_enabled)
    }))

    return {
      data,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize)
      }
    }
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = db
      .prepare(
        `SELECT id, source_file, source_id, title, content, category, style, original_style, scene, image_type,
                product_category, platform_source, source_url, remark, tags,
                example_image_path, generation_status, usage_count, is_enabled,
                created_at, updated_at
         FROM prompts WHERE id = ?`
      )
      .get(id) as any
    if (!row) return reply.status(404).send({ error: 'Not found', code: 'PROMPT_NOT_FOUND' })
    return {
      ...row,
      example_image_url: row.example_image_path ? `/images/${row.example_image_path}` : null,
      is_enabled: Boolean(row.is_enabled)
    }
  })

  app.get('/:id/image', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = db.prepare('SELECT example_image_path FROM prompts WHERE id = ?').get(id) as
      | { example_image_path?: string }
      | undefined
    if (!row?.example_image_path) {
      return reply.status(404).send({ error: 'Not found', code: 'PROMPT_NOT_FOUND' })
    }
    return reply.redirect(`/images/${row.example_image_path}`)
  })
}
