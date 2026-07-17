import type { FastifyInstance } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { db } from '../../db/connection.js'
import { requireAuth, getCsrfToken } from './auth.js'

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  app.get('/dashboard', async (request, reply) => {
    const total = Number(
      (db.prepare('SELECT COUNT(*) as c FROM prompts').get() as { c: number | bigint }).c
    )
    const withImage = Number(
      (
        db
          .prepare('SELECT COUNT(*) as c FROM prompts WHERE example_image_path IS NOT NULL')
          .get() as { c: number | bigint }
      ).c
    )
    const jobs = Number(
      (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number | bigint }).c
    )

    return reply.view('pages/dashboard.ejs', {
      title: '控制台',
      error: null,
      csrfToken: getCsrfToken(request),
      total,
      withImage,
      jobs
    })
  })
}
