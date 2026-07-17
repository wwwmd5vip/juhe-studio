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
  let specialCharId: number | bigint = 0
  let noImageId: number | bigint = 0

  beforeAll(async () => {
    migrate(db)
    db.exec('DELETE FROM prompts')
    const insert = db.prepare(
      `INSERT INTO prompts (
        source_file, source_id, title, content, category, style, original_style,
        scene, image_type, product_category, platform_source, source_url, remark,
        tags, example_image_path, generation_status, usage_count, is_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )

    const result1 = insert.run(
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
    insertedId = result1.lastInsertRowid

    const result2 = insert.run(
      'test.xlsx',
      '2',
      '50% discount',
      'save_now deal',
      '促销',
      '写实',
      'photorealistic',
      '场景图',
      '场景图',
      '护肤',
      'Midjourney',
      'https://example.com',
      'special chars',
      'percent,underscore',
      'uploads/special chars_50%.png',
      'completed',
      3,
      1
    )
    specialCharId = result2.lastInsertRowid

    const result3 = insert.run(
      'test.xlsx',
      '3',
      'no image prompt',
      'no image content',
      '美妆护肤',
      '写实',
      'photorealistic',
      '场景图',
      '场景图',
      '护肤',
      'Midjourney',
      'https://example.com',
      'no image',
      'noimage',
      null,
      'completed',
      0,
      1
    )
    noImageId = result3.lastInsertRowid

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
    expect(body.data).toHaveLength(3)
    expect(body.data[0].content).toBe('a bottle')
    expect(body.data[0].example_image_url).toBe('/images/uploads/test.png')
    expect(body.data[0].is_enabled).toBe(true)
  })

  it('lists prompts with pagination', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?page=1&pageSize=10' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(3)
    expect(body.pagination).toEqual({ page: 1, pageSize: 10, total: 3, totalPages: 1 })
  })

  it('filters prompts by category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?category=美妆护肤' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).data).toHaveLength(2)
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
    expect(body.total_prompts).toBe(3)
    expect(body.prompts_with_image).toBe(2)
    expect(body.enabled_prompts).toBe(3)
    expect(body.category_counts).toEqual({ '美妆护肤': 2, '促销': 1 })
  })

  it('returns health status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })

  it('returns 400 for invalid query parameters', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?page=not-a-number' })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error).toBe('Invalid query parameters')
    expect(body.code).toBe('INVALID_PARAMETER')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for invalid id parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts/not-an-id' })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error).toBe('Invalid route parameters')
    expect(body.code).toBe('INVALID_PARAMETER')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for invalid id in image route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts/0/image' })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error).toBe('Invalid route parameters')
    expect(body.code).toBe('INVALID_PARAMETER')
    expect(body.details).toBeDefined()
  })

  it('search escapes special characters', async () => {
    const percentRes = await app.inject({ method: 'GET', url: '/api/v1/prompts?search=50%25' })
    expect(percentRes.statusCode).toBe(200)
    const percentBody = JSON.parse(percentRes.payload)
    expect(percentBody.data).toHaveLength(1)
    expect(percentBody.data[0].id).toBe(Number(specialCharId))

    const underscoreRes = await app.inject({ method: 'GET', url: '/api/v1/prompts?search=save_' })
    expect(underscoreRes.statusCode).toBe(200)
    const underscoreBody = JSON.parse(underscoreRes.payload)
    expect(underscoreBody.data).toHaveLength(1)
    expect(underscoreBody.data[0].id).toBe(Number(specialCharId))
  })

  it('filters prompts with has_image', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?has_image=true' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(2)
    expect(body.data.every((p: { example_image_url: string | null }) => p.example_image_url !== null)).toBe(true)
  })

  it('does not treat empty search as wildcard', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/prompts?search=%20%20%20' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data).toHaveLength(3)
  })

  it('url-encodes image path segments', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/prompts/${specialCharId}` })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.example_image_url).toBe('/images/uploads/special%20chars_50%25.png')

    const redirectRes = await app.inject({ method: 'GET', url: `/api/v1/prompts/${specialCharId}/image` })
    expect(redirectRes.statusCode).toBe(302)
    expect(redirectRes.headers.location).toBe('/images/uploads/special%20chars_50%25.png')
  })
})
