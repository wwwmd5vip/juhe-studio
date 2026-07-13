import type { Provider } from '@shared/types/provider'
import { describe, expect, it } from 'vitest'
import { filterAvailableProviders } from '../task-model-selector.utils'

function makeProvider(models: Array<{ name: string; capabilities: string[] }>): Provider {
  return {
    id: 'p1',
    name: 'Test Provider',
    type: 'openai-chat-completions',
    presetId: null,
    baseUrl: null,
    apiKey: null,
    accessKeyId: null,
    secretAccessKey: null,
    isEnabled: true,
    isCustom: false,
    createdAt: '',
    updatedAt: '',
    connectionStatus: 'unknown',
    models: models.map((model, index) => ({
      id: `m${index}`,
      providerId: 'p1',
      name: model.name,
      displayName: null,
      type: 'llm',
      capabilities: model.capabilities,
      parameters: null,
      isEnabled: true,
      isAutoFetched: false,
      createdAt: '',
      updatedAt: ''
    }))
  } as unknown as Provider
}

describe('filterAvailableProviders', () => {
  it('excludes models that only satisfy some capabilities when mode is all', () => {
    const providers = [
      makeProvider([
        { name: 'Doubao-embedding', capabilities: ['chat', 'embedding'] },
        { name: 'gemini-3.5-thinking', capabilities: ['chat', 'vision', 'reasoning'] }
      ])
    ]

    const result = filterAvailableProviders(providers, ['vision', 'chat'], 'all')

    expect(result).toHaveLength(1)
    expect(result[0].models).toHaveLength(1)
    expect(result[0].models[0].name).toBe('gemini-3.5-thinking')
  })

  it('includes models that satisfy any capability when mode is any', () => {
    const providers = [
      makeProvider([
        { name: 'Doubao-embedding', capabilities: ['chat', 'embedding'] },
        { name: 'gemini-3.5-thinking', capabilities: ['chat', 'vision', 'reasoning'] }
      ])
    ]

    const result = filterAvailableProviders(providers, ['vision', 'chat'], 'any')

    expect(result).toHaveLength(1)
    expect(result[0].models).toHaveLength(2)
  })
})
