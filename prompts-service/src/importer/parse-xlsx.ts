import * as XLSX from '@e965/xlsx'
import type { PromptRow } from './parse-md.js'

type HeaderKey =
  | 'source_id'
  | 'content'
  | 'product_category'
  | 'image_type'
  | 'platform_source'
  | 'remark'
  | 'category'
  | 'source_url'
  | 'style'
  | 'original_style'
  | 'scene'

const headerAliases: Record<HeaderKey, string[]> = {
  source_id: ['source_id', 'id', '序号'],
  content: ['content', '提示词', 'prompt'],
  product_category: ['product_category', '产品品类', '商品类别'],
  image_type: ['image_type', '图片类型'],
  platform_source: ['platform_source', '平台来源'],
  remark: ['remark', '备注'],
  category: ['category', '分类', '风格大类', '原始风格', '场景描述'],
  source_url: ['source_url', '来源链接', '原图url', '原图URL'],
  style: ['style', '风格'],
  original_style: ['original_style', '原始风格'],
  scene: ['scene', '场景']
}

function buildHeaderMap(rawHeaders: string[]): Partial<Record<HeaderKey, string>> {
  const map: Partial<Record<HeaderKey, string>> = {}
  const normalizedToKey = new Map<string, HeaderKey>()

  for (const key of Object.keys(headerAliases) as HeaderKey[]) {
    for (const alias of headerAliases[key]) {
      normalizedToKey.set(alias.toLowerCase().trim(), key)
    }
  }

  for (const header of rawHeaders) {
    const normalized = String(header).toLowerCase().trim()
    const key = normalizedToKey.get(normalized)
    if (key && !map[key]) map[key] = String(header).trim()
  }
  return map
}

function getCell(
  row: Record<string, string>,
  headerMap: Partial<Record<HeaderKey, string>>,
  key: HeaderKey
): string {
  const header = headerMap[key]
  return header ? String(row[header] ?? '').trim() : ''
}

export function parseXlsx(sourceFile: string, buffer: Buffer): PromptRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const rows: PromptRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
    if (json.length === 0) continue

    const rawHeaders = Object.keys(json[0])
    const headerMap = buildHeaderMap(rawHeaders)

    for (let i = 0; i < json.length; i++) {
      const row = json[i]
      const content = getCell(row, headerMap, 'content')
      if (!content) continue

      const productCategory = getCell(row, headerMap, 'product_category')
      let category = getCell(row, headerMap, 'category')
      if (!category) {
        category = productCategory && productCategory !== '通用模板' ? productCategory : '通用模板'
      }

      const sourceId = getCell(row, headerMap, 'source_id') || `${sheetName}#${i + 2}`

      rows.push({
        source_file: sourceFile,
        source_id: sourceId,
        content,
        category,
        image_type: getCell(row, headerMap, 'image_type') || undefined,
        product_category: productCategory || undefined,
        platform_source: getCell(row, headerMap, 'platform_source') || undefined,
        remark: getCell(row, headerMap, 'remark') || undefined,
        source_url: getCell(row, headerMap, 'source_url') || undefined,
        style: getCell(row, headerMap, 'style') || undefined,
        original_style: getCell(row, headerMap, 'original_style') || undefined,
        scene: getCell(row, headerMap, 'scene') || undefined
      })
    }
  }

  return rows
}
