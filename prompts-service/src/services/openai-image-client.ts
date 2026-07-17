import { request } from 'undici'
import { z } from 'zod'

export interface ProviderConfig {
  base_url: string
  api_key: string
  model: string
  size: string
  response_format?: 'url' | 'b64_json'
}

const responseSchema = z.object({
  data: z.array(
    z.object({
      url: z.string().optional(),
      b64_json: z.string().optional()
    })
  )
})

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [1000, 2000, 4000]

class NonRetryableError extends Error {}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

export function replacePlaceholders(text: string, value: string) {
  return text.replace(/\{[^{}]+\}/g, value)
}

export function buildImageRequest(
  config: Pick<ProviderConfig, 'model' | 'size' | 'response_format'>,
  prompt: string
) {
  return {
    model: config.model,
    prompt,
    n: 1,
    size: config.size,
    response_format: config.response_format || 'url'
  }
}

type RequestOptions = Parameters<typeof request>[1] & { connectTimeout?: number }

async function downloadImage(url: string, signal?: AbortSignal, redirect = false): Promise<Buffer> {
  const imgRes = await request(url, {
    signal,
    connectTimeout: 10000,
    headersTimeout: 10000,
    bodyTimeout: 60000
  } as RequestOptions)

  if (imgRes.statusCode >= 400 && imgRes.statusCode < 500) {
    throw new NonRetryableError(`IMAGE_DOWNLOAD_HTTP_${imgRes.statusCode}`)
  }

  if (imgRes.statusCode >= 500) {
    throw new Error(`IMAGE_DOWNLOAD_HTTP_${imgRes.statusCode}`)
  }

  if (imgRes.statusCode >= 300) {
    const rawLocation = imgRes.headers.location
    const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation
    if (!location || redirect) {
      throw new NonRetryableError('IMAGE_DOWNLOAD_REDIRECT_FAILED')
    }
    return downloadImage(location, signal, true)
  }

  return Buffer.from(await imgRes.body.arrayBuffer())
}

async function doGenerateImage(
  config: ProviderConfig,
  prompt: string,
  signal?: AbortSignal
): Promise<Buffer> {
  const body = buildImageRequest(config, prompt)
  const res = await request(`${config.base_url}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`
    },
    body: JSON.stringify(body),
    signal,
    connectTimeout: 10000,
    headersTimeout: 10000,
    bodyTimeout: 60000
  } as RequestOptions)

  if (res.statusCode >= 400 && res.statusCode < 500) {
    throw new NonRetryableError(`HTTP_${res.statusCode}`)
  }

  if (res.statusCode >= 500) {
    throw new Error(`HTTP_${res.statusCode}`)
  }

  let data: unknown
  try {
    data = await res.body.json()
  } catch {
    throw new NonRetryableError('INVALID_IMAGE_RESPONSE')
  }

  const parsed = responseSchema.safeParse(data)
  if (!parsed.success || parsed.data.data.length === 0) {
    throw new NonRetryableError('INVALID_IMAGE_RESPONSE')
  }

  const item = parsed.data.data[0]
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item.url) {
    return downloadImage(item.url, signal)
  }

  throw new NonRetryableError('INVALID_IMAGE_RESPONSE')
}

export async function generateImage(
  config: ProviderConfig,
  prompt: string,
  signal?: AbortSignal
): Promise<Buffer> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw signal.reason
    }

    try {
      return await doGenerateImage(config, prompt, signal)
    } catch (err) {
      if (signal?.aborted) {
        throw signal.reason
      }

      if (err instanceof NonRetryableError) {
        throw err
      }

      lastError = err as Error
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS_MS[attempt], signal)
      }
    }
  }

  throw lastError || new NonRetryableError('INVALID_IMAGE_RESPONSE')
}
