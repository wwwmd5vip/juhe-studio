import crypto from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { z } from 'zod'
import { validateUser, createUser, hasUsers } from '../../services/user-service.js'

declare module '@fastify/secure-session' {
  interface SessionData {
    user: string
    csrfToken: string
  }
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  _csrf: z.string().optional()
})

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function getCsrfToken(request: FastifyRequest): string {
  let token = request.session.get('csrfToken')
  if (!token) {
    token = crypto.randomBytes(32).toString('hex')
    request.session.set('csrfToken', token)
  }
  return token
}

export async function verifyCsrfToken(request: FastifyRequest, reply: FastifyReply) {
  const token = request.session.get('csrfToken')
  if (!token) {
    return reply.status(403).send('CSRF token missing')
  }
  const body = request.body as Record<string, unknown> | undefined
  const submitted = String(body?._csrf ?? '') || String(request.headers['x-csrf-token'] ?? '')
  if (!submitted || !timingSafeEqual(token, submitted)) {
    return reply.status(403).send('CSRF token invalid')
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST') {
      await verifyCsrfToken(request, reply)
    }
  })

  app.get('/login', async (request, reply) => {
    return reply.view('pages/login.ejs', {
      title: '登录',
      error: null,
      csrfToken: getCsrfToken(request)
    })
  })

  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.view('pages/login.ejs', {
        title: '登录',
        error: '用户名和密码不能为空',
        csrfToken: getCsrfToken(request)
      })
    }

    const { username, password } = parsed.data

    try {
      const ok = await validateUser(username, password)
      if (!ok) {
        return reply.view('pages/login.ejs', {
          title: '登录',
          error: '用户名或密码错误',
          csrfToken: getCsrfToken(request)
        })
      }
      request.session.set('user', username)
      // Regenerate CSRF token after successful login
      request.session.set('csrfToken', crypto.randomBytes(32).toString('hex'))
      return reply.redirect('/admin/dashboard')
    } catch (err) {
      request.log.error(err, 'validateUser failed')
      return reply.view('pages/login.ejs', {
        title: '登录',
        error: '登录失败，请稍后重试',
        csrfToken: getCsrfToken(request)
      })
    }
  })

  app.post('/logout', async (request, reply) => {
    request.session.delete()
    return reply.redirect('/admin/login')
  })
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session.get('user')) {
    return reply.redirect('/admin/login')
  }
}

export async function seedAdminIfNeeded(username?: string, password?: string): Promise<void> {
  if (!username || !password) return
  if (hasUsers()) return

  try {
    await createUser(username, password)
  } catch (err) {
    console.error('seedAdminIfNeeded failed:', err)
  }
}
