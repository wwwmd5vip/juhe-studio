import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as XLSX from '@e965/xlsx'
import Database from 'better-sqlite3'
import { parseMarkdown } from '../src/importer/parse-md.js'
import { parseXlsx } from '../src/importer/parse-xlsx.js'
import { importPrompts } from '../src/importer/index.js'
import { migrate } from '../src/db/migrate.js'

describe('parseMarkdown', () => {
  it('parses a prompt block', () => {
    const md = `
## 女装

#### 连衣裙场景图

**编号**：C-001
**提示词**：
\`\`\`
an amazing model
\`\`\`
**适用工具**：Midjourney V4
**来源**：[^364^](https://example.com)
`
    const rows = parseMarkdown('test.md', md)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toBe('C-001')
    expect(rows[0].content).toBe('an amazing model')
    expect(rows[0].category).toBe('女装')
    expect(rows[0].platform_source).toBe('Midjourney V4')
    expect(rows[0].source_url).toBe('https://example.com')
  })

  it('parses markdown with code fence language tag', () => {
    const md = `
## 女装
#### 连衣裙场景图
**编号**：C-002
**提示词**：
\`\`\`prompt
a beautiful dress
\`\`\`
`
    const rows = parseMarkdown('test.md', md)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toBe('C-002')
    expect(rows[0].content).toBe('a beautiful dress')
  })

  it('uses category fallback when id is missing', () => {
    const md = `
## 男装

#### 西装场景图

**提示词**：
\`\`\`
a handsome suit
\`\`\`
`
    const rows = parseMarkdown('test.md', md)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toMatch(/^男装#/)
    expect(rows[0].category).toBe('男装')
    expect(rows[0].content).toBe('a handsome suit')
  })

  it('skips empty content blocks', () => {
    const md = `
## 女装

#### 连衣裙场景图

**编号**：C-001
**提示词**：
\`\`\`

\`\`\`

---

**编号**：C-002
**提示词**：
\`\`\`
real content
\`\`\`
`
    const rows = parseMarkdown('test.md', md)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toBe('C-002')
    expect(rows[0].content).toBe('real content')
  })
})

describe('parseXlsx', () => {
  it('parses Excel with Chinese headers', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['序号', '提示词', '产品品类', '图片类型', '平台来源', '备注'],
      ['X-001', 'chinese prompt', '女装', '场景图', 'Midjourney', 'note']
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const rows = parseXlsx('test.xlsx', buffer)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toBe('X-001')
    expect(rows[0].content).toBe('chinese prompt')
    expect(rows[0].category).toBe('女装')
    expect(rows[0].image_type).toBe('场景图')
    expect(rows[0].platform_source).toBe('Midjourney')
    expect(rows[0].remark).toBe('note')
  })

  it('parses Excel with multiple sheets', () => {
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['序号', '提示词', '产品品类'],
      ['S1-001', 'sheet1 prompt', '通用模板']
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['序号', '提示词', '产品品类'],
      ['S2-001', 'sheet2 prompt', '男装']
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1')
    XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const rows = parseXlsx('test.xlsx', buffer)
    expect(rows).toHaveLength(2)
    expect(rows[0].source_id).toBe('S1-001')
    expect(rows[0].category).toBe('通用模板')
    expect(rows[1].source_id).toBe('S2-001')
    expect(rows[1].category).toBe('男装')
  })

  it('skips rows with empty content', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['序号', '提示词', '产品品类'],
      ['X-001', '', '女装'],
      ['', 'valid prompt', '男装']
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const rows = parseXlsx('test.xlsx', buffer)
    expect(rows).toHaveLength(1)
    expect(rows[0].source_id).toBe('Sheet1#3')
    expect(rows[0].content).toBe('valid prompt')
  })
})

describe('importPrompts integration', () => {
  it('imports prompts into a real SQLite database and tracks counters', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-import-'))
    const dbPath = path.join(tmpDir, 'test.db')
    const sourceDir = path.join(tmpDir, 'source')
    fs.mkdirSync(sourceDir)

    const database = new Database(dbPath)
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
    migrate(database)

    fs.writeFileSync(
      path.join(sourceDir, 'test.md'),
      `
## 女装

#### 连衣裙场景图

**编号**：C-001
**提示词**：
\`\`\`
md prompt one
\`\`\`

---

**编号**：C-002
**提示词**：
\`\`\`text
md prompt two
\`\`\`

---

**编号**：C-003
**提示词**：
\`\`\`

\`\`\`
`
    )

    const ws = XLSX.utils.aoa_to_sheet([
      ['序号', '提示词', '产品品类'],
      ['X-001', 'xlsx prompt one', '男装'],
      ['X-002', '', '男装']
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Prompts')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    fs.writeFileSync(path.join(sourceDir, 'test.xlsx'), buffer)

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    importPrompts(sourceDir, database)
    expect(logSpy).toHaveBeenCalledWith('[import] total=3 inserted=3 updated=0')

    const rows = database.prepare('SELECT * FROM prompts ORDER BY id').all() as Record<string, unknown>[]
    expect(rows).toHaveLength(3)
    expect(rows[0].source_id).toBe('C-001')
    expect(rows[1].source_id).toBe('C-002')
    expect(rows[2].source_id).toBe('X-001')

    importPrompts(sourceDir, database)
    expect(logSpy).toHaveBeenCalledWith('[import] total=3 inserted=0 updated=3')

    const rows2 = database.prepare('SELECT * FROM prompts ORDER BY id').all() as Record<string, unknown>[]
    expect(rows2).toHaveLength(3)

    logSpy.mockRestore()
    database.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
