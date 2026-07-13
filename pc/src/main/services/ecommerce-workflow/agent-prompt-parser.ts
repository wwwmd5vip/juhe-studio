export function parsePosterPrompts(raw: string): string[] {
  const text = raw.trim()
  if (!text) return []

  const headingRegex = /^##\s*海报\s*\d+\s*[｜|:：]\s*(?:.+?)\s*$/gm
  const matches: { index: number; length: number }[] = []
  let match = headingRegex.exec(text)
  while (match !== null) {
    matches.push({ index: match.index, length: match[0].length })
    match = headingRegex.exec(text)
  }

  if (matches.length === 0) {
    // 兜底 1：按双换行切分
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    if (paragraphs.length > 0) return paragraphs
    // 兜底 2：整段文本
    return text ? [text] : []
  }

  const prompts: string[] = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const body = text
      .slice(start, end)
      .trim()
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\s+$/gm, '')
      .trim()
    if (body) prompts.push(body)
  }

  return prompts.length > 0 ? prompts : []
}
