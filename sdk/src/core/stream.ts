import { JuheStreamError } from './errors.js'
import type { ChatCompletionChunk } from './types.js'

export async function* parseSSEStream(
  response: Response
): AsyncGenerator<ChatCompletionChunk> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new JuheStreamError(`Stream request failed: ${response.status} ${text}`)
  }
  if (!response.body) {
    throw new JuheStreamError('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const MAX_BUFFER = 1024 * 1024 // 1MB
  let buffer = ''

  let needsCancel = true
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        needsCancel = false
        break
      }

      buffer += decoder.decode(value, { stream: true })
      if (buffer.length > MAX_BUFFER) {
        throw new JuheStreamError('SSE buffer overflow — malformed stream')
      }
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') {
          needsCancel = false
          return
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const chunk: ChatCompletionChunk = JSON.parse(trimmed.slice(6))
            yield chunk
          } catch {
            console.warn('[Juhe SDK] Failed to parse SSE chunk:', trimmed.slice(0, 100))
          }
        }
      }
    }

    // Process remaining buffer after stream ends (incomplete final line)
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const chunk: ChatCompletionChunk = JSON.parse(trimmed.slice(6))
          yield chunk
        } catch {
          console.warn('[Juhe SDK] Failed to parse SSE final chunk:', trimmed.slice(0, 100))
        }
      }
    }
  } finally {
    if (needsCancel) reader.cancel().catch(() => {})
  }
}

export interface StandaloneStreamOptions {
  /** Timeout in milliseconds (default: 300000 = 5 minutes). */
  timeout?: number
  /** External AbortSignal to combine with the timeout. */
  signal?: AbortSignal
}

export async function streamChatCompletions(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  options?: StandaloneStreamOptions,
): Promise<AsyncGenerator<ChatCompletionChunk>> {
  const timeoutSignal = AbortSignal.timeout(options?.timeout ?? 300_000)
  const signal = (options?.signal ? AbortSignal.any([timeoutSignal, options.signal]) : timeoutSignal) as AbortSignal
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new JuheStreamError(`Stream request timed out after ${options?.timeout ?? 300_000}ms`)
    }
    throw new JuheStreamError(`Stream request failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new JuheStreamError(`Stream request failed: ${response.status} ${text}`)
  }
  return parseSSEStream(response)
}
