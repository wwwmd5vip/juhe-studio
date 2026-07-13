import type { SearchProviderConfig, SearchProviderImplementation } from '../types'

interface SearxngResult {
  title: string
  url: string
  content?: string
}

interface SearxngSearchResponse {
  results: SearxngResult[]
}

export const searchSearxng: SearchProviderImplementation = async (
  config: SearchProviderConfig,
  query: string,
  maxResults: number
) => {
  const apiHost = config.apiHost || 'http://localhost:8080'

  const parsed = new URL(apiHost)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid SearXNG apiHost scheme')
  }

  const url = new URL(`${apiHost}/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')

  let response: Response
  let responseText: string
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })
    responseText = await response.text()
  } catch (err) {
    console.error('[WebSearch:SearXNG] 网络请求失败:', {
      endpoint: url.toString(),
      query: query.slice(0, 100),
      maxResults,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }

  if (!response.ok) {
    console.error('[WebSearch:SearXNG] API 返回错误:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText.slice(0, 500),
      endpoint: url.toString(),
      query: query.slice(0, 100),
      maxResults
    })
    throw new Error(`ERR_SEARXNG_API_ERROR: SearXNG search error: ${response.status} ${responseText}`)
  }

  let data: SearxngSearchResponse
  try {
    data = JSON.parse(responseText) as SearxngSearchResponse
  } catch (err) {
    console.error('[WebSearch:SearXNG] 解析响应失败:', {
      body: responseText.slice(0, 500),
      endpoint: url.toString(),
      query: query.slice(0, 100),
      error: err instanceof Error ? err.message : String(err)
    })
    throw new Error('ERR_SEARXNG_INVALID_RESPONSE: Failed to parse SearXNG response')
  }

  return (data.results || []).slice(0, maxResults).map((item) => ({
    title: item.title,
    url: item.url,
    content: item.content || ''
  }))
}
