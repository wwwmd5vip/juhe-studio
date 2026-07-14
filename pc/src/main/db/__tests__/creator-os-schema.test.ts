import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Creator OS migration 0014', () => {
  const sqlPath = join(__dirname, '..', 'migrations', '0014_creator_os_projects.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  const journalPath = join(__dirname, '..', 'migrations', 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))

  it('creates projects table with correct columns', () => {
    expect(sql).toContain('CREATE TABLE `projects`')
    expect(sql).toContain('`id` text PRIMARY KEY')
    expect(sql).toContain('`name` text NOT NULL')
    expect(sql).toContain('`category` text NOT NULL')
    expect(sql).toContain('`batch_status` text')
    expect(sql).toContain('`batch_error` text')
  })

  it('creates assets table with FK to projects', () => {
    expect(sql).toContain('CREATE TABLE `assets`')
    expect(sql).toContain('`project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE')
    expect(sql).toContain('`file_path` text NOT NULL')
    expect(sql).toContain('`kind` text NOT NULL')
  })

  it('creates creator_tasks table with double status columns', () => {
    expect(sql).toContain('CREATE TABLE `creator_tasks`')
    expect(sql).toContain('`status` text NOT NULL')
    expect(sql).toContain('`runtime_status` text NOT NULL')
    expect(sql).toContain('`runtime_task_id` text NOT NULL')
    expect(sql).toContain('`template_slot_id` text NOT NULL')
    expect(sql).toContain('`slot_index` integer NOT NULL')
  })

  it('creates versions table with FK to creator_tasks', () => {
    expect(sql).toContain('CREATE TABLE `versions`')
    expect(sql).toContain('`task_id` text NOT NULL REFERENCES `creator_tasks`(`id`) ON DELETE CASCADE')
    expect(sql).toContain('`version_number` integer NOT NULL')
    expect(sql).toContain('`is_selected` integer NOT NULL')
  })

  it('creates deliverables table with FKs', () => {
    expect(sql).toContain('CREATE TABLE `deliverables`')
    expect(sql).toContain('`project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE')
    expect(sql).toContain('`task_id` text NOT NULL REFERENCES `creator_tasks`(`id`) ON DELETE CASCADE')
    expect(sql).toContain('`version_id` text REFERENCES `versions`(`id`) ON DELETE SET NULL')
  })

  it('adds project_id to generations as nullable', () => {
    expect(sql).toContain('ALTER TABLE `generations` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL')
  })

  it('adds project_id to ecommerce_workflows as nullable', () => {
    expect(sql).toContain('ALTER TABLE `ecommerce_workflows` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL')
  })

  it('adds project_id to showcase_tasks as nullable', () => {
    expect(sql).toContain('ALTER TABLE `showcase_tasks` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE SET NULL')
  })

  it('has journal entry with correct idx', () => {
    const entry = journal.entries.find((e: { tag: string }) => e.tag === '0014_creator_os_projects')
    expect(entry).toBeDefined()
    expect(entry.idx).toBe(14)
  })
})
