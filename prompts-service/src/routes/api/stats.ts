import type { FastifyInstance } from 'fastify'
import { db } from '../../db/connection.js'

export async function statsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM prompts').get() as { c: number }).c
    const withImage = (db.prepare('SELECT COUNT(*) as c FROM prompts WHERE example_image_path IS NOT NULL').get() as {
      c: number
    }).c
    const enabled = (db.prepare('SELECT COUNT(*) as c FROM prompts WHERE is_enabled = 1').get() as { c: number }).c
    const categoryRows = db
      .prepare('SELECT category, COUNT(*) as c FROM prompts WHERE category IS NOT NULL GROUP BY category')
      .all() as { category: string; c: number }[]
    const category_counts = Object.fromEntries(categoryRows.map((r) => [r.category, r.c]))
    return { total_prompts: total, prompts_with_image: withImage, enabled_prompts: enabled, category_counts }
  })
}
