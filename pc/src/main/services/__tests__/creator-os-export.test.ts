/**
 * Export service tests — path validation for deliverable:export.
 * Mocks electron, db, and db/schema so the function under test
 * only exercises the path whitelist logic.
 */
import { describe, it, expect, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: () => '/mock/userData'
  }
}))

// Mock db — select chain returns empty list (no deliverables)
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([])
      })
    })
  })
}
vi.mock('@main/db', () => ({ db: mockDb }))

// Mock db/schema
const mockTable = (name: string) => ({ $$name: name })
vi.mock('@main/db/schema', () => ({
  versions: mockTable('versions'),
  deliverables: mockTable('deliverables')
}))

describe('export service path validation', () => {
  it('exportAssets rejects system directories', async () => {
    const { exportAssets } = await import('../creator-os/export')
    for (const dir of ['/System/Library/ExportTest', '/usr/local/ExportTest', '/etc/ExportTest']) {
      const result = await exportAssets('proj-1', dir)
      expect(result.ok).toBe(false)
      expect(result.errors[0]).toContain('Access denied')
    }
  })

  it('exportAssets rejects sensitive home paths (home itself is not an allowed root)', async () => {
    const { exportAssets } = await import('../creator-os/export')
    const result = await exportAssets('proj-1', '/root/ExportTest')
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('Access denied')
  })

  it('exportAssets allows userData and tmpdir paths', async () => {
    const { exportAssets } = await import('../creator-os/export')
    // userData 下：通过路径校验（无选中交付物 → 业务错误而非 Access denied）
    const r1 = await exportAssets('proj-1', '/mock/userData/exports/proj-1')
    expect(r1.errors[0] ?? '').not.toContain('Access denied')
    // tmpdir 下：通过路径校验
    const r2 = await exportAssets('proj-1', join(tmpdir(), 'export-test-allowed'))
    expect(r2.errors[0] ?? '').not.toContain('Access denied')
  })
})
