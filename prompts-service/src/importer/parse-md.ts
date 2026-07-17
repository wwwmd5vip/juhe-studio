export interface PromptRow {
  source_file: string
  source_id: string
  title?: string
  content: string
  negative_prompt?: string
  category?: string
  style?: string
  original_style?: string
  scene?: string
  image_type?: string
  product_category?: string
  platform_source?: string
  source_url?: string
  remark?: string
  tags?: string
}

export function parseMarkdown(sourceFile: string, md: string): PromptRow[] {
  const rows: PromptRow[] = []
  const blocks = md.split(/^---+$/m)
  let currentCategory = ''
  let lineIndex = 0

  for (const block of blocks) {
    const categoryMatch = block.match(/^##+\s+(.+)$/m)
    if (categoryMatch) currentCategory = categoryMatch[1].trim()

    const idMatch = block.match(/\*\*编号\*\*[：:]\s*(.+)/)
    const contentMatch = block.match(/\*\*提示词\*\*[：:]?\s*\n```\n([\s\S]+?)\n```/)
    if (!contentMatch) continue

    const toolMatch = block.match(/\*\*适用工具\*\*[：:]\s*(.+)/)
    const sourceMatch = block.match(/\*\*来源\*\*[：:]\s*\[.*?\]\((.+?)\)/)

    rows.push({
      source_file: sourceFile,
      source_id: idMatch ? idMatch[1].trim() : `${currentCategory}#${lineIndex++}`,
      content: contentMatch[1].trim(),
      category: currentCategory || undefined,
      platform_source: toolMatch ? toolMatch[1].trim() : undefined,
      source_url: sourceMatch ? sourceMatch[1].trim() : undefined
    })
  }

  return rows
}
