import type { FastifyInstance } from 'fastify'
import { db } from '../../db/connection.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    try {
      db.prepare('SELECT 1').get()
      return { status: 'ok', db: 'ok', timestamp: new Date().toISOString() }
    } catch (err) {
      console.error('[health] db check failed', err)
      return reply.status(503).send({ status: 'degraded', db: 'error', timestamp: new Date().toISOString() })
    }
  })
}
