import type { Project, Asset, ProductSetTemplate, ProductSetPreflightResult } from '@shared/types/creator-os'
import { db } from '../../db'
import { models } from '../../db/schema'
import { inArray } from 'drizzle-orm'

export async function validatePreflight(
  project: Project,
  sourceAssets: Asset[],
  template: ProductSetTemplate
): Promise<ProductSetPreflightResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Project must be in idle state
  if (project.batchStatus !== 'idle' && project.batchStatus !== null) {
    errors.push(`Project batch is already ${project.batchStatus || 'running'} — wait or cancel first`)
  }

  // 2. Template must have exactly 8 slots
  if (template.slots.length !== 8) {
    errors.push(`Template must have exactly 8 slots, got ${template.slots.length}`)
  }

  // 3. Verify all referenced models exist
  const modelIds = [...new Set(template.slots.map((s) => s.modelId).filter(Boolean))]
  if (modelIds.length > 0) {
    const found = await db
      .select({ id: models.id })
      .from(models)
      .where(inArray(models.id, modelIds as [string, ...string[]]))
    const foundIds = new Set(found.map((m) => m.id))
    for (const mid of modelIds) {
      if (!foundIds.has(mid)) {
        errors.push(`Model "${mid}" not found in local provider config`)
      }
    }
  }

  // 4. Warn if source assets are missing
  const sourceCount = sourceAssets.filter((a) => a.kind === 'source').length
  if (sourceCount === 0) {
    warnings.push('No source assets imported — image-to-image slots will fail')
  }

  return { ok: errors.length === 0, errors, warnings }
}
