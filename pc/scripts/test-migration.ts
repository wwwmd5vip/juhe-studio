import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'path'

async function main() {
  const client = createClient({ url: 'file:./test_migrate.db' })
  const db = drizzle(client)

  const journal = [
    { idx: 0, tag: '0000_lowly_silver_samurai' },
    { idx: 1, tag: '0001_new_terrax' },
    { idx: 2, tag: '0002_add_provider_preset_id' },
    { idx: 3, tag: '0003_add_chat_message_blocks' },
    { idx: 4, tag: '0004_add_quick_phrases' },
    { idx: 5, tag: '0005_add_web_search_providers' },
    { idx: 6, tag: '0006_add_skills' },
    { idx: 7, tag: '0008_add_provider_ak_sk' },
    { idx: 8, tag: '0009_add_generation_task_fields' },
    { idx: 9, tag: '0009_blue_revanche' },
    { idx: 10, tag: '0010_lame_firebird' }
  ]

  await client.execute(
    'CREATE TABLE IF NOT EXISTS __drizzle_migrations__ (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL UNIQUE, created_at INTEGER)'
  )
  for (const j of journal) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO __drizzle_migrations__ (hash, created_at) VALUES (?, ?)',
      args: [j.tag + '.sql', Date.now()]
    })
  }

  await migrate(db, { migrationsFolder: join(process.cwd(), 'src/main/db/migrations') })
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='ecommerce_workflows'"
  )
  console.log('ecommerce_workflows exists:', res.rows.length > 0)
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
