import { estimateShowcaseCost } from '@shared/ecommerce-workflow/cost-estimate'
import { describe, expect, it } from 'vitest'

describe('estimateShowcaseCost', () => {
  it('returns 1 for selling_points and plan', () => {
    expect(estimateShowcaseCost('selling_points', 0)).toBe(1)
    expect(estimateShowcaseCost('plan', 0)).toBe(1)
  })

  it('returns module count for images', () => {
    expect(estimateShowcaseCost('images', 4)).toBe(4)
  })
})
