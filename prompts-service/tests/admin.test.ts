import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import formbody from '@fastify/formbody'
import secureSession from '@fastify/secure-session'
import view from '@fastify/view'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { authRoutes } from '../src/routes/admin/auth.js'
import { dashboardRoutes } from '../src/routes/admin/dashboard.js'
import { adminPromptsRoutes } from '../src/routes/admin/prompts.js'
import { generateRoutes } from '../src/routes/admin/generate.js'
import { jobsRoutes } from '../src/routes/admin/jobs.js'
import { settingsRoutes } from '../src/routes/admin/settings.js'
import { db } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { createUser } from '../src/services/user-service.js'
import * as imageClient from '../src/services/openai-image-client.js'
import { cancelCurrentJob } from '../src/services/batch-generator.js'

const smallPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const viewsDir = path.resolve(__dirname, '../src/views')

async function buildAdminApp() {
  const app = Fastify()
  await app.register(formbody)
  await app.register(secureSession, {
    secret: 'a'.repeat(32),
    salt: 'b'.repeat(16),
    cookie: { path: '/' }
  })
  await app.register(view, {
    engine: { ejs: await import('ejs') },
    root: viewsDir,
    layout: 'layouts/main.ejs'
  })
  await app.register(authRoutes, { prefix: '/admin' })
  await app.register(dashboardRoutes, { prefix: '/admin' })
  await app.register(adminPromptsRoutes, { prefix: '/admin' })
  await app.register(generateRoutes, { prefix: '/admin' })
  await app.register(jobsRoutes, { prefix: '/admin' })
  await app.register(settingsRoutes, { prefix: '/admin' })
  return app
}

function extractCookies(res: { cookies: { name: string; value: string }[] }): Record<string, string> {
  return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]))
}

async function getCsrfFromLogin(app: Fastify.FastifyInstance) {
  const res = await app.inject({ method: 'GET', url: '/admin/login' })
  expect(res.statusCode).toBe(200)
  const match = res.payload.match(/name="_csrf" value="([^"]+)"/)
  expect(match).toBeTruthy()
  const csrfToken = match![1]
  return { csrfToken, cookies: extractCookies(res) }
}

async function login(app: Fastify.FastifyInstance) {
  const { csrfToken, cookies } = await getCsrfFromLogin(app)
  const res = await app.inject({
    method: 'POST',
    url: '/admin/login',
    payload: { username: 'adminuser', password: 'password123', _csrf: csrfToken },
    cookies
  })
  expect(res.statusCode).toBe(302)
  expect(res.headers.location).toBe('/admin/dashboard')
  return { cookies: extractCookies(res) }
}

describe.sequential('admin routes', () => {
  let app: Fastify.FastifyInstance

  beforeAll(async () => {
    migrate(db)
    app = await buildAdminApp()
  })

  beforeEach(async () => {
    vi.spyOn(imageClient, 'generateImage').mockResolvedValue(smallPngBuffer)

    // Abort any in-flight generation from a previous test and wait for the
    // consumer to release the job before wiping rows.
    cancelCurrentJob()
    await vi.waitFor(
      () => {
        const running = db
          .prepare("SELECT COUNT(*) FROM jobs WHERE status = 'running'")
          .pluck()
          .get() as number
        expect(running).toBe(0)
      },
      { timeout: 2000 }
    )
    db.exec('DELETE FROM job_items')
    db.exec('DELETE FROM jobs')
    db.exec('DELETE FROM prompts')
    db.exec('DELETE FROM users')
    db.exec('DELETE FROM settings')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(() => db.close())

  describe('auth', () => {
    it('login page includes csrf token', async () => {
      const { csrfToken } = await getCsrfFromLogin(app)
      expect(csrfToken.length).toBeGreaterThan(0)
    })

    it('rejects login without csrf token', async () => {
      await createUser('adminuser', 'password123')
      const res = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'adminuser', password: 'password123' }
      })
      expect(res.statusCode).toBe(403)
      expect(res.payload).toContain('CSRF token')
    })

    it('rejects login with invalid csrf token', async () => {
      await createUser('adminuser', 'password123')
      const { cookies } = await getCsrfFromLogin(app)
      const res = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'adminuser', password: 'password123', _csrf: 'invalid' },
        cookies
      })
      expect(res.statusCode).toBe(403)
    })

    it('logs in with valid credentials and csrf token', async () => {
      await createUser('adminuser', 'password123')
      const { csrfToken, cookies } = await getCsrfFromLogin(app)
      const res = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'adminuser', password: 'password123', _csrf: csrfToken },
        cookies
      })
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('/admin/dashboard')
    })

    it('rejects login with invalid credentials', async () => {
      await createUser('adminuser', 'password123')
      const { csrfToken, cookies } = await getCsrfFromLogin(app)
      const res = await app.inject({
        method: 'POST',
        url: '/admin/login',
        payload: { username: 'adminuser', password: 'wrongpassword', _csrf: csrfToken },
        cookies
      })
      expect(res.statusCode).toBe(200)
      expect(res.payload).toContain('用户名或密码错误')
    })

    it('redirects unauthenticated users from admin routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/dashboard' })
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe('/admin/login')
    })

    it('allows authenticated users to access admin routes', async () => {
      await createUser('adminuser', 'password123')
      const { cookies } = await login(app)
      const res = await app.inject({ method: 'GET', url: '/admin/dashboard', cookies })
      expect(res.statusCode).toBe(200)
      expect(res.payload).toContain('控制台')
    })
  })

  describe('settings', () => {
    it('stores empty provider config values', async () => {
      await createUser('adminuser', 'password123')
      const { cookies } = await login(app)
      const settingsRes = await app.inject({ method: 'GET', url: '/admin/settings', cookies })
      const csrfMatch = settingsRes.payload.match(/name="_csrf" value="([^"]+)"/)
      expect(csrfMatch).toBeTruthy()
      const csrfToken = csrfMatch![1]

      const res = await app.inject({
        method: 'POST',
        url: '/admin/settings',
        cookies,
        payload: {
          _csrf: csrfToken,
          default_placeholder: 'placeholder',
          default_provider_config_base_url: '',
          default_provider_config_api_key: '',
          default_provider_config_model: '',
          default_provider_config_size: '',
          default_provider_config_response_format: '',
          default_concurrency: '3',
          max_job_size: '100'
        }
      })
      expect(res.statusCode).toBe(302)

      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_provider_config') as
        | { value: string }
        | undefined
      expect(row).toBeDefined()
      const config = JSON.parse(row!.value) as Record<string, string>
      expect(config.base_url).toBe('')
      expect(config.api_key).toBe('')
      expect(config.model).toBe('')
      expect(config.size).toBe('')
      expect(config.response_format).toBeUndefined()
    })
  })

  describe('generate', () => {
    it('returns error for missing prompt ids', async () => {
      await createUser('adminuser', 'password123')
      const { cookies } = await login(app)
      const generateRes = await app.inject({ method: 'GET', url: '/admin/generate', cookies })
      const csrfMatch = generateRes.payload.match(/name="_csrf" value="([^"]+)"/)
      expect(csrfMatch).toBeTruthy()
      const csrfToken = csrfMatch![1]

      const res = await app.inject({
        method: 'POST',
        url: '/admin/jobs',
        cookies,
        payload: {
          _csrf: csrfToken,
          prompt_ids: '99999',
          provider_config_base_url: 'https://example.com',
          provider_config_api_key: 'key',
          provider_config_model: 'model',
          provider_config_size: '1024x1024'
        }
      })
      expect(res.statusCode).toBe(200)
      expect(res.payload).toContain('not found')
    })

    it('returns error for disabled prompt ids', async () => {
      await createUser('adminuser', 'password123')
      const insert = db.prepare(
        `INSERT INTO prompts (
          source_file, source_id, title, content, category, is_enabled
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      const result = insert.run('test.xlsx', '1', 'title', 'content', 'category', 0)
      const promptId = Number(result.lastInsertRowid)

      const { cookies } = await login(app)
      const generateRes = await app.inject({ method: 'GET', url: '/admin/generate', cookies })
      const csrfMatch = generateRes.payload.match(/name="_csrf" value="([^"]+)"/)
      expect(csrfMatch).toBeTruthy()
      const csrfToken = csrfMatch![1]

      const res = await app.inject({
        method: 'POST',
        url: '/admin/jobs',
        cookies,
        payload: {
          _csrf: csrfToken,
          prompt_ids: String(promptId),
          provider_config_base_url: 'https://example.com',
          provider_config_api_key: 'key',
          provider_config_model: 'model',
          provider_config_size: '1024x1024'
        }
      })
      expect(res.statusCode).toBe(200)
      expect(res.payload).toContain('disabled')
    })

    it('creates a job with valid prompt ids', async () => {
      await createUser('adminuser', 'password123')
      const insert = db.prepare(
        `INSERT INTO prompts (
          source_file, source_id, title, content, category, is_enabled
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      const result = insert.run('test.xlsx', '1', 'title', 'content', 'category', 1)
      const promptId = Number(result.lastInsertRowid)

      const { cookies } = await login(app)
      const generateRes = await app.inject({ method: 'GET', url: '/admin/generate', cookies })
      const csrfMatch = generateRes.payload.match(/name="_csrf" value="([^"]+)"/)
      expect(csrfMatch).toBeTruthy()
      const csrfToken = csrfMatch![1]

      const res = await app.inject({
        method: 'POST',
        url: '/admin/jobs',
        cookies,
        payload: {
          _csrf: csrfToken,
          prompt_ids: String(promptId),
          provider_config_base_url: 'https://example.com',
          provider_config_api_key: 'key',
          provider_config_model: 'model',
          provider_config_size: '1024x1024'
        }
      })
      expect(res.statusCode).toBe(302)

      const job = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 1').get() as {
        total_count: number
        status: string
      }
      expect(job.total_count).toBe(1)
      expect(['pending', 'running']).toContain(job.status)
    })
  })

  describe('jobs', () => {
    it('cancels a pending job', async () => {
      await createUser('adminuser', 'password123')
      const { cookies } = await login(app)

      const insertPrompt = db.prepare(
        `INSERT INTO prompts (source_file, source_id, title, content, category, is_enabled) VALUES (?, ?, ?, ?, ?, ?)`
      )
      const promptResult = insertPrompt.run('test.xlsx', '1', 'title', 'content', 'category', 1)
      const promptId = Number(promptResult.lastInsertRowid)

      const jobResult = db
        .prepare('INSERT INTO jobs (name, provider_config, total_count, status) VALUES (?, ?, ?, ?)')
        .run('test', '{}', 5, 'pending')
      const jobId = Number(jobResult.lastInsertRowid)
      db.prepare('INSERT INTO job_items (job_id, prompt_id) VALUES (?, ?)').run(jobId, promptId)

      const jobsRes = await app.inject({ method: 'GET', url: '/admin/jobs', cookies })
      const csrfMatch = jobsRes.payload.match(/name="_csrf" value="([^"]+)"/)
      expect(csrfMatch).toBeTruthy()
      const csrfToken = csrfMatch![1]

      const res = await app.inject({
        method: 'POST',
        url: `/admin/jobs/${jobId}/cancel`,
        cookies,
        payload: { _csrf: csrfToken }
      })
      expect(res.statusCode).toBe(302)
      const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId) as { status: string }
      expect(job.status).toBe('cancelled')
    })

    it('cancels a running job and leaves the consumer able to process new jobs', async () => {
      await createUser('adminuser', 'password123')
      const { cookies } = await login(app)

      const insertPrompt = db.prepare(
        `INSERT INTO prompts (source_file, source_id, title, content, category, is_enabled) VALUES (?, ?, ?, ?, ?, ?)`
      )
      const promptResult = insertPrompt.run('test.xlsx', '1', 'title', 'content', 'category', 1)
      const promptId = Number(promptResult.lastInsertRowid)

      // First job hangs until aborted; subsequent jobs resolve a tiny valid PNG.
      let isFirstCall = true
      const generateImageSpy = vi.spyOn(imageClient, 'generateImage').mockImplementation((_config, _prompt, signal) => {
        if (isFirstCall) {
          return new Promise<Buffer>((_, reject) => {
            const onAbort = () => reject(signal?.reason ?? new Error('AbortError'))
            if (signal?.aborted) {
              onAbort()
              return
            }
            signal?.addEventListener('abort', onAbort, { once: true })
          })
        }
        return Promise.resolve(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
          )
        )
      })

      const createJob = async () => {
        const generateRes = await app.inject({ method: 'GET', url: '/admin/generate', cookies })
        const match = generateRes.payload.match(/name="_csrf" value="([^"]+)"/)
        expect(match).toBeTruthy()
        const csrf = match![1]
        const res = await app.inject({
          method: 'POST',
          url: '/admin/jobs',
          cookies,
          payload: {
            _csrf: csrf,
            prompt_ids: String(promptId),
            provider_config_base_url: 'https://example.com',
            provider_config_api_key: 'key',
            provider_config_model: 'model',
            provider_config_size: '1024x1024'
          }
        })
        expect(res.statusCode).toBe(302)
      }

      await createJob()

      const getLatestJob = () =>
        db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 1').get() as {
          id: number
          status: string
        }

      await vi.waitFor(() => {
        expect(getLatestJob().status).toBe('running')
      })

      isFirstCall = false

      const jobsRes = await app.inject({ method: 'GET', url: '/admin/jobs', cookies })
      const csrfMatch = jobsRes.payload.match(/name="_csrf" value="([^"]+)"/)
      expect(csrfMatch).toBeTruthy()
      const csrfToken = csrfMatch![1]

      const jobId = getLatestJob().id
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/admin/jobs/${jobId}/cancel`,
        cookies,
        payload: { _csrf: csrfToken }
      })
      expect(cancelRes.statusCode).toBe(302)

      await vi.waitFor(() => {
        expect(getLatestJob().status).toBe('cancelled')
      })

      await createJob()

      await vi.waitFor(
        () => {
          const job = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 1').get() as {
            status: string
            completed_count: number
            total_count: number
          }
          expect(job.status).toBe('completed')
          expect(job.completed_count).toBe(job.total_count)
        },
        { timeout: 5000 }
      )

      generateImageSpy.mockRestore()
    })
  })
})
