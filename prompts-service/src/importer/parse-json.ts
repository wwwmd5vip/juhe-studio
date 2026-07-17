import type { PromptRow } from './parse-md.js'

interface IndexJsonItem {
  id?: string | number
  slug?: string
  title?: string
  description?: string
  promptPreview?: string
  categories?: string[]
}

interface JsonlItem {
  id?: string | number
  name?: string
  prompt?: string
  promptEn?: string
  negativePrompt?: string
  categoryName?: string
  category?: string
  tags?: string[]
  tagNames?: string[]
  sourceSite?: string
  sourceUrl?: string
}

function joinTags(value: string[] | string | undefined): string | undefined {
  if (Array.isArray(value)) return value.join(',')
  if (typeof value === 'string' && value) return value
  return undefined
}

function isJsonlItem(item: Record<string, unknown>): boolean {
  return typeof item.prompt === 'string'
}

function isIndexJsonItem(item: Record<string, unknown>): boolean {
  return (typeof item.promptPreview === 'string' || typeof item.description === 'string') && typeof item.prompt !== 'string'
}

function parseJsonlItem(sourceFile: string, item: Record<string, unknown>, fallbackId: number): PromptRow | null {
  const typed = item as unknown as JsonlItem
  const promptContent = typed.prompt || typed.promptEn
  if (typeof promptContent !== 'string' || promptContent.length === 0) {
    console.warn(`[import] skipping ${sourceFile} JSONL item: missing prompt/promptEn`)
    return null
  }
  return {
    source_file: sourceFile,
    source_id: String(typed.id ?? fallbackId),
    title: typed.name,
    content: promptContent,
    negative_prompt: typed.negativePrompt,
    category: typed.categoryName || typed.category,
    platform_source: typed.sourceSite,
    source_url: typed.sourceUrl,
    tags: joinTags(typed.tagNames || typed.tags)
  }
}

function parseIndexJsonItem(sourceFile: string, item: Record<string, unknown>, fallbackId: number): PromptRow | null {
  const typed = item as unknown as IndexJsonItem
  const content = typed.promptPreview || typed.description
  if (typeof content !== 'string' || content.length === 0) {
    console.warn(`[import] skipping ${sourceFile} index item: missing promptPreview/description`)
    return null
  }
  return {
    source_file: sourceFile,
    source_id: String(typed.id ?? typed.slug ?? fallbackId),
    title: typed.title,
    content,
    tags: joinTags(typed.categories),
    category: typed.categories?.[0]
  }
}

function parseItem(sourceFile: string, item: unknown, fallbackId: number): PromptRow | null {
  if (!item || typeof item !== 'object') {
    console.warn(`[import] skipping ${sourceFile} item: not an object`)
    return null
  }
  const record = item as Record<string, unknown>
  if (isJsonlItem(record)) {
    return parseJsonlItem(sourceFile, record, fallbackId)
  }
  if (isIndexJsonItem(record)) {
    return parseIndexJsonItem(sourceFile, record, fallbackId)
  }
  console.warn(`[import] skipping ${sourceFile} item: unrecognized format`)
  return null
}

export function parseJson(sourceFile: string, content: string): PromptRow[] {
  const rows: PromptRow[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    console.warn(`[import] failed to parse ${sourceFile}:`, err)
    return rows
  }

  const rawItems: unknown = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown }).items

  if (!Array.isArray(rawItems)) {
    console.warn(`[import] skipping ${sourceFile}: expected top-level array or { items: [...] }`)
    return rows
  }

  const items = rawItems as unknown[]

  for (let i = 0; i < items.length; i++) {
    const row = parseItem(sourceFile, items[i], i + 1)
    if (row) rows.push(row)
  }

  return rows
}

export function parseJsonl(sourceFile: string, content: string): PromptRow[] {
  const rows: PromptRow[] = []
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch (err) {
      console.warn(`[import] malformed JSONL line ${i + 1} in ${sourceFile}:`, err)
      continue
    }
    const row = parseItem(sourceFile, parsed, i + 1)
    if (row) rows.push(row)
  }
  return rows
}
