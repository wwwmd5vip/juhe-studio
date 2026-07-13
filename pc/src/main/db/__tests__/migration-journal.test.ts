import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

interface JournalEntry {
  idx: number
  tag: string
  when: number
}

interface Journal {
  version: string
  dialect: string
  entries: JournalEntry[]
}

describe('migration journal', () => {
  it('has strictly increasing timestamps so drizzle migrator does not skip migrations', () => {
    const journalPath = join(__dirname, '../../db/migrations/meta/_journal.json')
    const journal: Journal = JSON.parse(readFileSync(journalPath, 'utf-8'))

    for (let i = 1; i < journal.entries.length; i++) {
      const previous = journal.entries[i - 1]
      const current = journal.entries[i]
      expect(
        current.when,
        `Migration ${current.tag} (idx ${current.idx}) must have a timestamp greater than ${previous.tag} (idx ${previous.idx})`
      ).toBeGreaterThan(previous.when)
    }
  })
})
