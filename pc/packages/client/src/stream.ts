import { JuheStreamError } from './errors.js'
import type { ChatCompletionChunk } from './types.js'

export async function* parseSSEStream(response: Response): AsyncGenerator<ChatCompletionChunk> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new JuheStreamError(`Stream request failed: ${response.status} ${text}`)
  }
  if (!response.body) {
    throw new JuheStreamError('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') return

        if (trimmed.startsWith('data: ')) {
          try {
            const chunk: ChatCompletionChunk = JSON.parse(trimmed.slice(6))
            yield chunk
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function streamChatCompletions(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<AsyncGenerator<ChatCompletionChunk>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ...body, stream: true })
  })
  return parseSSEStream(response)
}
