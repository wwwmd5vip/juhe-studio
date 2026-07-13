/**
 * Unified HTTP client with built-in error parsing and timeout.
 * Replaces the repeated fetch + error-parsing pattern across service files.
 */

import { errorMessage } from './error-classifier'

/**
 * HTTP error with structured response information.
 * Automatically parses the response body for a human-readable error message.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string
  ) {
    super(parseErrorMessage(status, body) || `HTTP ${status}`)
    this.name = 'HttpError'
  }
}

export interface HttpRequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  /** When true, does not consume the response body — caller must read response directly. */
  raw?: boolean
}

/**
 * Execute an HTTP request with automatic error parsing and timeout.
 * Returns the parsed JSON response and the raw Response object.
 * For non-JSON responses (e.g. binary audio), returns the response text as data.
 *
 * When `raw` is true, the response body is NOT consumed — the caller gets the
 * unread Response object and must read it (e.g. via `response.arrayBuffer()`).
 * Errors are still parsed from a cloned response.
 */
export async function httpRequest<T = unknown>(
  url: string,
  options: HttpRequestOptions = {}
): Promise<{ data: T; response: Response }> {
  const { method = 'POST', headers = {}, body, signal, timeoutMs = 120_000, raw = false } = options

  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: combinedSignal
  })

  if (raw) {
    // For binary responses: check status using a clone, leave original body untouched
    if (!response.ok) {
      const errorBody = await response.clone().text()
      throw new HttpError(response.status, response.statusText, errorBody, url)
    }
    return { data: null as T, response }
  }

  const responseText = await response.text()

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, responseText, url)
  }

  try {
    return { data: JSON.parse(responseText) as T, response }
  } catch {
    // Non-JSON response (e.g. plain text) — return raw text
    return { data: responseText as unknown as T, response }
  }
}

/**
 * Parse an error message from an HTTP response body.
 * Tries JSON first (looking for error.message or message fields), then falls back to raw text.
 */
function parseErrorMessage(status: number, body: string): string | undefined {
  if (!body) return undefined
  try {
    const json = JSON.parse(body)
    return json.error?.message || json.message || json.error || json.msg
  } catch {
    return body.length > 200 ? body.slice(0, 200) : body
  }
}
