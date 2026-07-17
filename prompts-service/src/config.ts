import 'dotenv/config'
import { z } from 'zod'
import path from 'node:path'

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().finite().default(3000),
    DATA_DIR: z.string().default('./data'),
    UPLOAD_DIR: z.string().default('./uploads'),
    PROMPTS_SOURCE_DIR: z.string().default('/app/prompts-source'),
    SESSION_SECRET: z.string().min(32),
    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    DEFAULT_GENERATION_CONCURRENCY: z.coerce.number().min(1).max(10).finite().default(2),
    // `*` is for local development; set a concrete origin in production.
    CORS_ORIGIN: z.string().default('*')
  })
  .refine(
    (data) =>
      !(
        (data.ADMIN_USERNAME && !data.ADMIN_PASSWORD) ||
        (!data.ADMIN_USERNAME && data.ADMIN_PASSWORD)
      ),
    {
      message: 'ADMIN_USERNAME and ADMIN_PASSWORD must be provided together or omitted together',
      path: ['ADMIN_PASSWORD']
    }
  )

const parsed = configSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid configuration:', parsed.error.format())
  process.exit(1)
}

export const env = {
  ...parsed.data,
  DATA_DIR: path.resolve(parsed.data.DATA_DIR),
  UPLOAD_DIR: path.resolve(parsed.data.UPLOAD_DIR),
  PROMPTS_SOURCE_DIR: path.resolve(parsed.data.PROMPTS_SOURCE_DIR)
}
