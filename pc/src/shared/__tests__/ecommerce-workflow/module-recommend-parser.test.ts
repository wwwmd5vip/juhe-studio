import { parseRecommendedModules } from '@main/services/ecommerce-workflow/module-recommend-parser'
import { MODULE_TYPES } from '@shared/ecommerce-workflow/module-types'

describe('parseRecommendedModules', () => {
  it('returns empty array for empty input', () => {
    expect(parseRecommendedModules('')).toEqual([])
    expect(parseRecommendedModules('   ')).toEqual([])
  })

  it('parses valid JSON', () => {
    const raw = JSON.stringify({ recommendedModules: ['main_visual', 'selling_point'] })
    expect(parseRecommendedModules(raw)).toEqual(['main_visual', 'selling_point'])
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"recommendedModules": ["main_visual"]}\n```'
    expect(parseRecommendedModules(raw)).toEqual(['main_visual'])
  })

  it('filters IDs not in pool', () => {
    const raw = JSON.stringify({ recommendedModules: ['main_visual', 'invalid_id'] })
    expect(parseRecommendedModules(raw)).toEqual(['main_visual'])
  })

  it('deduplicates and normalizes IDs', () => {
    const raw = JSON.stringify({ recommendedModules: ['Main-Visual', 'main_visual', 'MAIN_VISUAL'] })
    expect(parseRecommendedModules(raw)).toEqual(['main_visual'])
  })

  it('returns empty array when recommendedModules is missing or wrong type', () => {
    expect(parseRecommendedModules(JSON.stringify({}))).toEqual([])
    expect(parseRecommendedModules(JSON.stringify({ recommendedModules: 'main_visual' }))).toEqual([])
    expect(parseRecommendedModules(JSON.stringify({ recommendedModules: [123] }))).toEqual([])
  })

  it('uses custom pool when provided', () => {
    const pool = MODULE_TYPES.filter((m) => m.category === 'core')
    const raw = JSON.stringify({ recommendedModules: ['main_visual', 'model_scene'] })
    expect(parseRecommendedModules(raw, pool)).toEqual(['main_visual'])
  })
})
