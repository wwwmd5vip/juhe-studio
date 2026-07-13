import { parsePosterPrompts } from '@main/services/ecommerce-workflow/agent-prompt-parser'

describe('parsePosterPrompts', () => {
  it('parses standard headings', () => {
    const raw = `## 海报 1｜科技风\n第一段提示词。\n\n## 海报 2 | 自然风\n第二段提示词。`
    const result = parsePosterPrompts(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('第一段提示词')
    expect(result[1]).toContain('第二段提示词')
  })

  it('falls back to paragraphs when no headings', () => {
    const raw = `第一段。\n\n第二段。`
    expect(parsePosterPrompts(raw)).toEqual(['第一段。', '第二段。'])
  })

  it('falls back to whole text when single paragraph', () => {
    const raw = `只有一段提示词。`
    expect(parsePosterPrompts(raw)).toEqual(['只有一段提示词。'])
  })

  it('trims markdown markers and whitespace', () => {
    const raw = `## 海报 1｜标题\n\n  ## 子标题  \n正文。  \n`
    expect(parsePosterPrompts(raw)[0]).toBe('子标题\n正文。')
  })

  it('returns empty array for empty input', () => {
    expect(parsePosterPrompts('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(parsePosterPrompts('   \n\n  ')).toEqual([])
  })

  it('returns empty array when headings have empty bodies', () => {
    const raw = `## 海报 1｜科技风\n## 海报 2｜自然风`
    expect(parsePosterPrompts(raw)).toEqual([])
  })
})
