/**
 * Asset service tests — pure unit tests without Electron runtime.
 * Mocks electron, db, and db/schema so the functions under test
 * only rely on node:fs (real filesystem).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: () => '/mock/userData'
  }
}))

// Mock db
const mockDb = {
  insert: vi.fn().mockReturnValue({ values: vi.fn() }),
  select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn() }) }) }),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn() }) }),
  transaction: vi.fn()
}
vi.mock('@main/db', () => ({ db: mockDb }))

// Mock db/schema — provide minimal table objects that db.insert etc. accept
const mockTable = (name: string) => ({ $$name: name })
vi.mock('@main/db/schema', () => ({
  assets: mockTable('assets'),
  projects: mockTable('projects'),
  creatorTasks: mockTable('creatorTasks'),
  versions: mockTable('versions'),
  deliverables: mockTable('deliverables'),
  generations: mockTable('generations')
}))

describe('asset service', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `creator-os-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    try { rmSync(testDir, { recursive: true, force: true }) } catch { /* ok */ }
  })

  it('ensureAssetDir creates directory for a project', async () => {
    const { ensureAssetDir } = await import('../creator-os/assets')
    const destDir = ensureAssetDir('proj-1', join(testDir, 'assets'))
    expect(existsSync(destDir)).toBe(true)
    expect(destDir).toContain('proj-1')
  })

  it('isPathAllowed rejects paths outside allowed root', async () => {
    const { isPathAllowed } = await import('../creator-os/assets')
    expect(isPathAllowed('/etc/passwd', '/app/userData')).toBe(false)
    expect(isPathAllowed('/app/userData/assets/proj-1/img.png', '/app/userData')).toBe(true)
  })

  it('isPathAllowed handles paths with .. traversal', async () => {
    const { isPathAllowed } = await import('../creator-os/assets')
    expect(isPathAllowed('/app/userData/../etc/passwd', '/app/userData')).toBe(false)
  })

  it('detectMimeType returns correct MIME types', async () => {
    const { detectMimeType } = await import('../creator-os/assets')
    expect(detectMimeType('.png')).toBe('image/png')
    expect(detectMimeType('.jpg')).toBe('image/jpeg')
    expect(detectMimeType('.jpeg')).toBe('image/jpeg')
    expect(detectMimeType('.webp')).toBe('image/webp')
    expect(detectMimeType('.gif')).toBe('image/gif')
  })

  it('importAsset copies file and calls db.insert', async () => {
    const srcDir = join(testDir, 'src')
    mkdirSync(srcDir)
    const srcPath = join(srcDir, 'test.png')
    writeFileSync(srcPath, Buffer.alloc(100))

    const assetsRoot = join(testDir, 'assets')
    const { importAsset } = await import('../creator-os/assets')

    const result = await importAsset('proj-1', srcPath, assetsRoot)
    expect(result.id).toBeTruthy()
    expect(result.projectId).toBe('proj-1')
    expect(result.kind).toBe('source')
    expect(result.mimeType).toBe('image/png')
    expect(existsSync(result.filePath)).toBe(true)

    // Verify db.insert was called
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('importAsset throws when source file does not exist', async () => {
    const { importAsset } = await import('../creator-os/assets')
    // 路径位于允许根（tmpdir）内但文件不存在 → Source file not found
    await expect(
      importAsset('proj-1', join(testDir, 'nonexistent-file.png'), join(testDir, 'assets'))
    ).rejects.toThrow('Source file not found')
  })

  it('importAsset rejects paths outside allowed roots', async () => {
    const { importAsset } = await import('../creator-os/assets')
    // 系统文件
    await expect(
      importAsset('proj-1', '/etc/passwd', join(testDir, 'assets'))
    ).rejects.toThrow('Access denied')
    // home 下敏感目录（home 本身不在允许根内）
    const sshKey = join(homedir(), '.ssh', 'id_rsa')
    await expect(
      importAsset('proj-1', sshKey, join(testDir, 'assets'))
    ).rejects.toThrow('Access denied')
    // 路径遍历：从 tmpdir 逃到 /etc
    await expect(
      importAsset('proj-1', join(testDir, '..', '..', 'etc', 'passwd'), join(testDir, 'assets'))
    ).rejects.toThrow('Access denied')
  })
})
