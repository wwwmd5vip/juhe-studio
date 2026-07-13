import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import { describe, expect, it } from 'vitest'

describe('resolveModelCapabilities', () => {
  it('detects image models from common naming patterns', () => {
    expect(resolveModelCapabilities({ name: 'gpt-image-1' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'stable-image-ultra' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'qwen-image-plus' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'grok-4.2-image' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'juhe-nano' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'juhe-nano2' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'juhe-nano-pro' })).toContain('image')
    expect(resolveModelCapabilities({ name: 'juhe-gpt-image-2' })).toContain('image')
  })

  it('keeps explicit capability metadata', () => {
    expect(resolveModelCapabilities({ name: 'custom-model', capabilities: ['chat', 'image-generation'] })).toContain(
      'image'
    )
  })

  it('treats imageGeneration metadata as image capability', () => {
    expect(resolveModelCapabilities({ name: 'custom-model', imageGeneration: {} })).toContain('image')
  })

  it('treats image type models as image capable', () => {
    expect(resolveModelCapabilities({ name: 'anything', type: 'image' })).toContain('image')
  })

  it('does not add chat to image-type models', () => {
    const caps = resolveModelCapabilities({ name: 'juhe-nano', type: 'image', capabilities: ['image-generation'] })
    expect(caps).toContain('image')
    expect(caps).not.toContain('chat')
  })

  it('correctly resolves juhe image models from explicit metadata', () => {
    // Simulate the full model data from Juhe Management admin API
    for (const name of ['juhe-nano', 'juhe-nano2', 'juhe-nano-pro', 'juhe-gpt-image-2']) {
      const caps = resolveModelCapabilities({ name, type: 'image', capabilities: ['image-generation'] })
      expect(caps).toEqual(['image'])
    }
  })
})
