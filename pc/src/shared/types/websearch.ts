// Web Search Provider Types
export type WebSearchProviderType = 'tavily' | 'searxng' | 'exa' | 'jina' | 'zhipu' | 'bocha' | 'querit' | 'fetch'

export interface WebSearchProvider {
  id: string
  name: string
  type: WebSearchProviderType
  apiKey?: string
  apiHost?: string
  isEnabled?: boolean
  engines?: string[] // for searxng
  createdAt: string
  updatedAt: string
}

// Web Search Request/Response
export interface WebSearchRequest {
  query: string
  providerId?: string
  maxResults?: number
  excludeDomains?: string[]
}

export interface WebSearchResult {
  title: string
  url: string
  content?: string
  hostname?: string
  favicon?: string
}

export interface WebSearchResponse {
  results: WebSearchResult[]
  query: string
  providerId: string
}

// Citation Types
export interface Citation {
  number: number
  url: string
  title?: string
  hostname?: string
  content?: string
  favicon?: string
}

// Tool Types for AI SDK integration
export interface WebSearchToolInput {
  query: string
}

export interface WebFetchToolInput {
  url: string
}
