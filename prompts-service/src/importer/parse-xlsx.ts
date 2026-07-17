import * as XLSX from '@e965/xlsx'
import type { PromptRow } from './parse-md.js'

export function parseXlsx(sourceFile: string, buffer: Buffer): PromptRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })
  const rows: PromptRow[] = []

  for (let i = 0; i < json.length; i++) {
    const row = json[i]
    const sourceId = row['序号'] ? String(row['序号']).trim() : `${sheetName}#${i + 2}`
    const productCategory = row['产品品类'] ? String(row['产品品类']).trim() : ''
    const category = productCategory && productCategory !== '通用模板' ? productCategory : '通用模板'

    rows.push({
      source_file: sourceFile,
      source_id: sourceId,
      content: String(row['提示词'] || '').trim(),
      category,
      image_type: row['图片类型'] ? String(row['图片类型']).trim() : undefined,
      product_category: productCategory || undefined,
      platform_source: row['平台来源'] ? String(row['平台来源']).trim() : undefined,
      remark: row['备注'] ? String(row['备注']).trim() : undefined
    })
  }

  return rows
}
