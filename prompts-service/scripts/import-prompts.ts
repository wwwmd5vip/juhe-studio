import { env } from '../src/config.js'
import { db } from '../src/db/connection.js'
import { migrate } from '../src/db/migrate.js'
import { importPrompts } from '../src/importer/index.js'

try {
  migrate()
  const failed = importPrompts(env.PROMPTS_SOURCE_DIR)
  if (failed.length > 0) {
    console.warn('[import] failed files:', failed)
    process.exitCode = 1
  }
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  db.close()
}
