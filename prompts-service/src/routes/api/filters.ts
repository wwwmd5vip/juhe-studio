import type { FastifyInstance } from 'fastify'
import { db } from '../../db/connection.js'

function distinct(col: string) {
  return (
    db
      .prepare(`SELECT DISTINCT ${col} FROM prompts WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`)
      .all() as Record<string, string>[]
  ).map((r) => r[col])
}

export async function filtersRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    categories: distinct('category'),
    styles: distinct('style'),
    scenes: distinct('scene'),
    image_types: distinct('image_type'),
    product_categories: distinct('product_category'),
    platform_sources: distinct('platform_source')
  }))
}
