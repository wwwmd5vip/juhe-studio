import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../src/importer/parse-md.js'

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
})
