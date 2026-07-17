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
    const body = loginSchema.parse(request.body)
    const ok = await validateUser(body.username, body.password)
    if (!ok) return reply.view('pages/login.ejs', { error: '用户名或密码错误' })
    request.session.set('user', body.username)
    return reply.redirect('/admin/dashboard')
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

export async function seedAdminIfNeeded(username?: string, password?: string) {
  if (username && password && !hasUsers()) {
    await createUser(username, password)
  }
}
