import { MODULE_TYPES, type ModuleTypeDefinition, normalizeModuleId } from '@shared/ecommerce-workflow/module-types'

export function parseRecommendedModules(raw: string, pool: ModuleTypeDefinition[] = MODULE_TYPES): string[] {
  if (!raw || !raw.trim()) return []

  const cleaned = raw
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return []
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []

  const recommended = (parsed as Record<string, unknown>).recommendedModules
  if (!Array.isArray(recommended)) return []

  const poolIds = new Set(pool.map((m) => normalizeModuleId(m.id)))
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of recommended) {
    if (typeof item !== 'string') continue
    const normalized = normalizeModuleId(item)
    if (!poolIds.has(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}
