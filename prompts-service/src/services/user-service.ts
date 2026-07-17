import bcrypt from 'bcryptjs'
import { db } from '../db/connection.js'

const MIN_PASSWORD_LENGTH = 8

export async function createUser(username: string, password: string): Promise<void> {
  if (!username || username.trim().length === 0) {
    throw new Error('Username is required')
  }
  if (!password || password.length === 0) {
    throw new Error('Password is required')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)
  if (existing) {
    throw new Error(`Username "${username}" already exists`)
  }

  const hash = await bcrypt.hash(password, 10)
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash)
}

export async function validateUser(username: string, password: string): Promise<boolean> {
  const row = db.prepare('SELECT password_hash FROM users WHERE username = ?').get(username) as
    | { password_hash: string }
    | undefined
  if (!row) return false
  return bcrypt.compare(password, row.password_hash)
}

export function hasUsers(): boolean {
  const row = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  return row.c > 0
}
