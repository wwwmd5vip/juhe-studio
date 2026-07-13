import type { PlanResult, SellingPointsResult } from '@shared/ecommerce-workflow/showcase-types'
import { PlanModuleSchema } from '@shared/ecommerce-workflow/showcase-types'
import { z } from 'zod'

export function parseSellingPoints(raw: string): SellingPointsResult {
  const json = extractJson(raw)
  const parsed = z.object({ selling_points: z.array(z.string()).min(1) }).parse(json)
  return { sellingPoints: parsed.selling_points }
}

export function parsePlan(raw: string): PlanResult {
  const json = extractJson(raw)
  const parsed = z.object({ modules: z.array(PlanModuleSchema).min(1) }).parse(json)
  return { modules: parsed.modules }
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in response')
  return JSON.parse(match[0])
}
