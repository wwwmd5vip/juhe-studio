import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scryptSync } from 'node:crypto'
import Fastify from 'fastify'
import fastifyView from '@fastify/view'
import fastifyStatic from '@fastify/static'
import cors from '@fastify/cors'
import secureSession from '@fastify/secure-session'
import formbody from '@fastify/formbody'
import { env } from './config.js'
import { db } from './db/connection.js'
import { migrate } from './db/migrate.js'
import { startupRecovery, startConsumer, shutdown, getConsumerPromise } from './services/batch-generator.js'
import { seedAdminIfNeeded, authRoutes, requireAuth } from './routes/admin/auth.js'
import { dashboardRoutes } from './routes/admin/dashboard.js'
import { adminPromptsRoutes } from './routes/admin/prompts.js'
import { generateRoutes } from './routes/admin/generate.js'
import { jobsRoutes } from './routes/admin/jobs.js'
import { settingsRoutes } from './routes/admin/settings.js'
import { healthRoutes } from './routes/api/health.js'
import { promptsRoutes } from './routes/api/prompts.js'
import { filtersRoutes } from './routes/api/filters.js'
import { statsRoutes } from './routes/api/stats.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function buildApp() {
  const app = Fastify({ logger: true })

  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN === '*') {
    console.error('[config] CORS_ORIGIN cannot be * in production')
    process.exit(1)
  }

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE']
  })

  const sessionKey = scryptSync(env.SESSION_SECRET, 'prompts-service-session-salt', 32)
  await app.register(secureSession, {
    key: sessionKey,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60
    }
  })

  await app.register(formbody)

  await app.register(fastifyView, {
    engine: { ejs: await import('ejs') },
    root: path.join(__dirname, 'views'),
    layout: 'layouts/main.ejs'
  })

  await app.register(fastifyStatic, {
    root: env.UPLOAD_DIR,
    prefix: '/images/',
    wildcard: true
  })

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error)
    const err = error instanceof Error ? error : new Error(String(error))
    const statusCode = (error as any).statusCode || 500
    if (request.url.startsWith('/api/v1') || request.url === '/health') {
      return reply.status(statusCode).send({
        error: err.message || 'Internal server error',
        code: (error as any).code || 'INTERNAL_ERROR'
      })
    }
    return reply.status(statusCode).view('pages/error.ejs', {
      error: err.message || 'Internal server error'
    })
  })

  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(promptsRoutes, { prefix: '/api/v1/prompts' })
  await app.register(filtersRoutes, { prefix: '/api/v1/filters' })
  await app.register(statsRoutes, { prefix: '/api/v1/stats' })

  await app.register(authRoutes, { prefix: '/admin' })
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/admin') && !request.url.startsWith('/admin/login')) {
      await requireAuth(request, reply)
    }
  })
  await app.register(dashboardRoutes, { prefix: '/admin' })
  await app.register(adminPromptsRoutes, { prefix: '/admin' })
  await app.register(generateRoutes, { prefix: '/admin' })
  await app.register(jobsRoutes, { prefix: '/admin' })
  await app.register(settingsRoutes, { prefix: '/admin' })

  return app
}

async function main() {
  migrate()
  startupRecovery()
  await seedAdminIfNeeded(env.ADMIN_USERNAME, env.ADMIN_PASSWORD)
  const app = await buildApp()

  const close = async () => {
    try {
      shutdown()
      const consumer = getConsumerPromise()
      if (consumer) {
        await Promise.race([consumer, new Promise<void>((resolve) => setTimeout(resolve, 30000))])
      }
      await app.close()
      db.close()
      process.exit(0)
    } catch (err) {
      app.log.error(err)
      process.exit(1)
    }
  }
  process.on('SIGTERM', close)
  process.on('SIGINT', close)

  await app.listen({ port: env.PORT, host: '0.0.0.0' })

  // Start the background consumer to process any pending jobs from previous runs
  startConsumer().catch((err) => {
    app.log.error(err)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
