import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { promptsRoutes } from '../src/routes/api/prompts.js'
import { filtersRoutes } from '../src/routes/api/filters.js'
import { statsRoutes } from '../src/routes/api/stats.js'
import { healthRoutes } from '../src/routes/api/health.js'
import { db } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'

describe('prompts api', () => {
  const app = Fastify()
  let insertedId: number | bigint = 0

  beforeAll(async () => {
    migrate(db)
    db.exec('DELETE FROM prompts')
    const result = db.prepare(
      `INSERT INTO prompts (
        source_file, source_id, title, content, category, style, original_style,
        scene, image_type, product_category, platform_source, source_url, remark,
        tags, example_image_path, generation_status, usage_count, is_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'test.xlsx',
      '1',
      'bottle prompt',
      'a bottle',
      '美妆护肤',
      '写实',
      'photorealistic',
      '场景图',
      '场景图',
      '护肤',
      'Midjourney',
      'https://example.com',
      'test remark',
      'bottle,beauty',
      'uploads/test.png',
      'completed',
      5,
      1
    )
    insertedId = result.lastInsertRowid

    await app.register(promptsRoutes, { prefix: '/api/v1/prompts' })
    await app.register(filtersRoutes, { prefix: '/api/v1/filters' })
    await app.register(statsRoutes, { prefix: '/api/v1/stats' })
    await app.register(healthRoutes, { prefix: '/health' })
  })

  afterAll(() => db.close())

  it('lists prompts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].content).toBe('a bottle')
    expect(body.data[0].example_image_url).toBe('/images/uploads/test.png')
    expect(body.data[0].is_enabled).toBe(true)
  })

  it('lists prompts with pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?page=1&pageSize=10' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 })
  })

  it('filters prompts by category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?category=美妆护肤' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).data).toHaveLength(1)
  })

  it('filters prompts by search term', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?search=bottle' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).data).toHaveLength(1)
  })

  it('returns prompt detail', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/prompts/${insertedId}` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.content).toBe('a bottle')
    expect(body.example_image_url).toBe('/images/uploads/test.png')
    expect(body.is_enabled).toBe(true)
  })

  it('returns 404 for missing prompt detail', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts/999999' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload).code).toBe('PROMPT_NOT_FOUND')
  })

  it('redirects to prompt image', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/prompts/${insertedId}/image` })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/images/uploads/test.png')
  })

  it('returns 404 for missing prompt image', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts/999999/image' })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload).code).toBe('PROMPT_NOT_FOUND')
  })

  it('returns filter options', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/filters' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.categories).toContain('美妆护肤')
    expect(body.styles).toContain('写实')
    expect(body.scenes).toContain('场景图')
    expect(body.image_types).toContain('场景图')
    expect(body.product_categories).toContain('护肤')
    expect(body.platform_sources).toContain('Midjourney')
  })

  it('returns stats', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/stats' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.total_prompts).toBe(1)
    expect(body.prompts_with_image).toBe(1)
    expect(body.enabled_prompts).toBe(1)
    expect(body.category_counts).toEqual({ '美妆护肤': 1 })
  })

  it('returns health status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})
