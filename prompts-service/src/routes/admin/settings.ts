import type { FastifyInstance } from 'fastify'
import '@fastify/secure-session'
import '@fastify/view'
import { z } from 'zod'
import { db } from '../../db/connection.js'

const flatSettingsSchema = z.object({
  default_placeholder: z.string().max(200).optional(),
  default_provider_config_base_url: z.string().url().optional().or(z.literal('')),
  default_provider_config_api_key: z.string().max(500).optional().or(z.literal('')),
  default_provider_config_model: z.string().max(100).optional().or(z.literal('')),
  default_provider_config_size: z.string().regex(/^\d+x\d+$/).optional().or(z.literal('')),
  default_provider_config_response_format: z.enum(['url', 'b64_json']).optional(),
  default_concurrency: z.coerce.number().min(1).max(10).optional(),
  max_job_size: z.coerce.number().min(1).max(2000).optional()
})

type SettingsView = {
  default_placeholder: string
  default_provider_config: Record<string, string>
  default_concurrency: string
  max_job_size: string
}

function loadSettings(): SettingsView {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  let providerConfig: Record<string, string> = {}
  if (map.default_provider_config) {
    try {
      providerConfig = JSON.parse(map.default_provider_config) as Record<string, string>
    } catch {
      providerConfig = {}
    }
  }

  return {
    default_placeholder: map.default_placeholder ?? '',
    default_provider_config: providerConfig,
    default_concurrency: map.default_concurrency ?? '',
    max_job_size: map.max_job_size ?? ''
  }
}

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.session.get('user')) {
      return reply.redirect('/admin/login')
    }
  })

  app.get('/settings', async (request, reply) => {
    return reply.view('pages/settings.ejs', {
      title: '系统设置',
      error: null,
      settings: loadSettings()
    })
  })

  app.post('/settings', async (request, reply) => {
    const parsed = flatSettingsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.view('pages/settings.ejs', {
        title: '系统设置',
        error: parsed.error.message,
        settings: loadSettings()
      })
    }

    const body = parsed.data
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )

    if (body.default_placeholder !== undefined) {
      upsert.run('default_placeholder', body.default_placeholder)
    }

    const providerConfig: Record<string, string> = {}
    if (body.default_provider_config_base_url) {
      providerConfig.base_url = body.default_provider_config_base_url
    }
    if (body.default_provider_config_api_key) {
      providerConfig.api_key = body.default_provider_config_api_key
    }
    if (body.default_provider_config_model) {
      providerConfig.model = body.default_provider_config_model
    }
    if (body.default_provider_config_size) {
      providerConfig.size = body.default_provider_config_size
    }
    if (body.default_provider_config_response_format) {
      providerConfig.response_format = body.default_provider_config_response_format
    }
    if (Object.keys(providerConfig).length > 0) {
      upsert.run('default_provider_config', JSON.stringify(providerConfig))
    }

    if (body.default_concurrency !== undefined) {
      upsert.run('default_concurrency', String(body.default_concurrency))
    }
    if (body.max_job_size !== undefined) {
      upsert.run('max_job_size', String(body.max_job_size))
    }

    return reply.redirect('/admin/settings')
  })
}
