import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { z } from 'zod'
import { validateUser, createUser, hasUsers } from '../../services/user-service.js'

declare module '@fastify/secure-session' {
  interface SessionData {
    user: string
  }
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

export async function authRoutes(app: FastifyInstance) {
  app.get('/login', async (request, reply) => {
    return reply.view('pages/login.ejs', { error: null })
  })

  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.view('pages/login.ejs', { error: '用户名和密码不能为空' })
    }

    const { username, password } = parsed.data

    try {
      const ok = await validateUser(username, password)
      if (!ok) return reply.view('pages/login.ejs', { error: '用户名或密码错误' })
      request.session.set('user', username)
      return reply.redirect('/admin/dashboard')
    } catch (err) {
      request.log.error(err, 'validateUser failed')
      return reply.view('pages/login.ejs', { error: '登录失败，请稍后重试' })
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
