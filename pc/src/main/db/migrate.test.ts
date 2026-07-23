/**
 * runMigrations 失败传播测试
 *
 * 背景：
 *   历史上迁移失败仅 console.error + 写 flag 文件后“继续运行”（降级模式），
 *   但 migration-guard 的 isCreatorOSEnabled() 无任何调用方，导致应用带残缺
 *   schema 无声运行，错误推迟到运行期零散爆发；index.ts 的“弹窗 + 退出”分支
 *   永远不会触发。
 *
 * 现在：迁移失败（或找不到迁移目录）必须 rethrow，由 index.ts 弹窗并退出。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────

const mockMigrate = vi.hoisted(() => vi.fn())
const mockExistsSync = vi.hoisted(() => vi.fn())
const mockCopyFileSync = vi.hoisted(() => vi.fn())
const mockDbRun = vi.hoisted(() => vi.fn())
const mockDbAll = vi.hoisted(() => vi.fn())
const mockMigrateProviderKeys = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    copyFileSync: mockCopyFileSync
  },
  existsSync: mockExistsSync,
  copyFileSync: mockCopyFileSync
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/tmp/juhe-test-userdata' : '/tmp')),
    getAppPath: vi.fn(() => '/tmp/juhe-test-app')
  }
}))

vi.mock('drizzle-orm/libsql/migrator', () => ({
  migrate: mockMigrate
}))

vi.mock('./index', () => ({
  db: {
    run: mockDbRun,
    all: mockDbAll
  }
}))

vi.mock('./migrate-provider-keys', () => ({
  migrateProviderKeysToPlaintext: mockMigrateProviderKeys
}))

import { runMigrations } from './migrate'

describe('runMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认：找到迁移目录，DB 文件存在（触发备份），安全补列全部跳过
    mockExistsSync.mockReturnValue(true)
    mockDbRun.mockResolvedValue(undefined)
    mockDbAll.mockResolvedValue([{ name: 'placeholder' }])
    mockMigrateProviderKeys.mockResolvedValue(undefined)
  })

  it('迁移成功时正常返回，并执行备份与后续步骤', async () => {
    mockMigrate.mockResolvedValue(undefined)

    await expect(runMigrations()).resolves.toBeUndefined()

    expect(mockCopyFileSync).toHaveBeenCalledOnce()
    const backupTarget = mockCopyFileSync.mock.calls[0][1] as string
    expect(backupTarget).toMatch(/app\.db\.pre-migration-\d+\.bak$/)
    expect(mockMigrateProviderKeys).toHaveBeenCalledOnce()
  })

  it('迁移 SQL 失败时 rethrow（不静默降级）', async () => {
    mockMigrate.mockRejectedValue(new Error('near "BROKEN": syntax error'))

    await expect(runMigrations()).rejects.toThrow(/数据库迁移失败.*BROKEN/)
    // 失败前仍应已创建预迁移备份
    expect(mockCopyFileSync).toHaveBeenCalledOnce()
    // 失败后不应继续执行后续迁移步骤
    expect(mockMigrateProviderKeys).not.toHaveBeenCalled()
  })

  it('找不到迁移目录时 throw（安装损坏，不得继续运行）', async () => {
    mockExistsSync.mockReturnValue(false)

    await expect(runMigrations()).rejects.toThrow(/migration folder/)
    expect(mockMigrate).not.toHaveBeenCalled()
  })
})
