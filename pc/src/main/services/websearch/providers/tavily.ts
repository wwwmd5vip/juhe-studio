import { httpRequest, HttpError } from '@shared/utils/http-client'
import type { SearchProviderConfig, SearchProviderImplementation } from '../types'

interface TavilySearchResult {
  title: string
  url: string
  content: string
}

interface TavilySearchResponse {
  results: TavilySearchResult[]
  answer?: string
}

export const searchTavily: SearchProviderImplementation = async (
  config: SearchProviderConfig,
  query: string,
  maxResults: number
) => {
  const apiHost = config.apiHost || 'https://api.tavily.com'
  const apiKey = config.apiKey

  const parsed = new URL(apiHost)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid Tavily apiHost scheme')
  }

  if (!apiKey) {
    throw new Error('ERR_TAVILY_API_KEY_REQUIRED: Tavily API key is required')
  }

  const endpoint = `${apiHost}/search`

  let data: TavilySearchResponse
  try {
    const { data: parsed } = await httpRequest<TavilySearchResponse>(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: {
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false
      }
    })
    data = parsed
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[WebSearch:Tavily] API 返回错误:', {
        status: err.status,
        statusText: err.statusText,
        body: err.body.slice(0, 500),
        endpoint,
        query: query.slice(0, 100),
        maxResults
      })
      throw new Error(`ERR_TAVILY_API_ERROR: Tavily search error: ${err.status} ${err.body}`)
    }
    console.error('[WebSearch:Tavily] 网络请求失败:', {
      endpoint,
      query: query.slice(0, 100),
      maxResults,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  return (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    content: item.content
  }))
}
