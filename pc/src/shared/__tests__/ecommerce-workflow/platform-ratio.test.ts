import { ASPECT_RATIOS, PLATFORMS } from '@shared/ecommerce-workflow/enums'
import { DEFAULT_ASPECT_RATIOS, getDefaultAspectRatio } from '@shared/ecommerce-workflow/platform-ratio'

describe('DEFAULT_ASPECT_RATIOS', () => {
  it('defines a default ratio for every platform and each ratio is allowed', () => {
    for (const platform of PLATFORMS) {
      const ratio = DEFAULT_ASPECT_RATIOS[platform]
      expect(ratio).toBeDefined()
      expect(ASPECT_RATIOS).toContain(ratio)
    }
  })
})

describe('getDefaultAspectRatio', () => {
  it('returns 1:1 for unknown platforms', () => {
    expect(getDefaultAspectRatio('unknown' as never)).toBe('1:1')
    expect(getDefaultAspectRatio('')).toBe('1:1')
  })

  it('returns 1:1 for undefined', () => {
    expect(getDefaultAspectRatio(undefined)).toBe('1:1')
  })

  it('returns correct ratios for key platforms', () => {
    expect(getDefaultAspectRatio('taobao')).toBe('3:4')
    expect(getDefaultAspectRatio('tiktok')).toBe('9:16')
    expect(getDefaultAspectRatio('amazon')).toBe('1:1')
    expect(getDefaultAspectRatio('xiaohongshu')).toBe('9:16')
    expect(getDefaultAspectRatio('ebay')).toBe('1:1')
  })
})
