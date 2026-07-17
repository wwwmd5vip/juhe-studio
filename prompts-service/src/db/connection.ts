import Database from 'better-sqlite3'
import path from 'node:path'
import { env } from '../config.js'

const dbPath = path.join(env.DATA_DIR, 'app.db')

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
