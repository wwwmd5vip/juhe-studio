import type { WebSearchResult } from '@shared/types/websearch'

export interface SearchProviderConfig {
  id: string
  name: string
  type: string
  apiKey?: string
  apiHost?: string
  engines?: string[]
}

export interface SearchCapability {
  feature: 'searchKeywords' | 'fetchUrls'
  apiHost?: string
}

export type SearchProviderImplementation = (
  config: SearchProviderConfig,
  query: string,
  maxResults: number
) => Promise<WebSearchResult[]>
