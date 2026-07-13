import type { WebSearchResult } from '@shared/types/websearch'
import type { SearchProviderConfig, SearchProviderImplementation } from '../types'
import { searchSearxng } from './searxng'
import { searchTavily } from './tavily'

export const PROVIDER_PRESETS: Record<
  string,
  { name: string; apiHost?: string; searchHost?: string; fetchHost?: string }
> = {
  tavily: { name: 'Tavily', apiHost: 'https://api.tavily.com' },
  searxng: { name: 'SearXNG', apiHost: 'http://localhost:8080' },
  jina: { name: 'Jina', searchHost: 'https://s.jina.ai', fetchHost: 'https://r.jina.ai' },
  exa: { name: 'Exa', apiHost: 'https://api.exa.ai' },
  zhipu: { name: 'Zhipu', apiHost: 'https://open.bigmodel.cn/api/paas/v4/web_search' },
  bocha: { name: 'Bocha', apiHost: 'https://api.bochaai.com' },
  querit: { name: 'Querit', apiHost: 'https://api.querit.ai' }
}

const SEARCH_IMPLEMENTATIONS: Record<string, SearchProviderImplementation> = {
  tavily: searchTavily,
  searxng: searchSearxng
}

export async function searchWithProvider(
  provider: SearchProviderConfig,
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const implementation = SEARCH_IMPLEMENTATIONS[provider.type]

  if (!implementation) {
    throw new Error(`ERR_UNSUPPORTED_SEARCH_PROVIDER: Unsupported search provider type: ${provider.type}`)
  }

  return implementation(provider, query, maxResults)
}
