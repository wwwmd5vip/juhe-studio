import { parsePlan, parseSellingPoints } from '@main/services/ecommerce-showcase/parsers'
import { describe, expect, it } from 'vitest'

describe('parseSellingPoints', () => {
  it('parses valid json', () => {
    const result = parseSellingPoints('{"selling_points": ["a", "b"]}')
    expect(result.sellingPoints).toEqual(['a', 'b'])
  })

  it('parses markdown wrapped json', () => {
    const result = parseSellingPoints('```json\n{"selling_points": ["a"]}\n```')
    expect(result.sellingPoints).toEqual(['a'])
  })

  it('throws on missing field', () => {
    expect(() => parseSellingPoints('{"points": ["a"]}')).toThrow()
  })
})

describe('parsePlan', () => {
  it('parses valid plan', () => {
    const raw =
      '{"modules": [{"id": "main_visual", "title": "Main", "imagePrompt": "prompt", "copyRequirements": "copy"}]}'
    const result = parsePlan(raw)
    expect(result.modules).toHaveLength(1)
    expect(result.modules[0].id).toBe('main_visual')
  })

  it('throws when modules is empty', () => {
    expect(() => parsePlan('{"modules": []}')).toThrow()
  })
})
