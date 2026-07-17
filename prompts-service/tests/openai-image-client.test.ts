import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { request } from 'undici'
import {
  buildImageRequest,
  replacePlaceholders,
  generateImage,
  type ProviderConfig
} from '../src/services/openai-image-client.js'

vi.mock('undici', () => ({
  request: vi.fn()
}))

const config: ProviderConfig = {
  base_url: 'https://api.example.com',
  api_key: 'test-api-key',
  model: 'dall-e-3',
  size: '1024x1024'
}

function mockJsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {},
    body: {
      json: vi.fn().mockResolvedValue(body),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    }
  }
}

function mockMalformedJsonResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: {
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    }
  }
}

function mockBinaryResponse(buffer: Buffer, statusCode = 200, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers,
    body: {
      json: vi.fn(),
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from(buffer).buffer)
    }
  }
}

describe('replacePlaceholders', () => {
  it('replaces placeholders with value', () => {
    expect(replacePlaceholders('a {product_name} on table', 'watch')).toBe('a watch on table')
  })
})

describe('buildImageRequest', () => {
  it('builds request with defaults', () => {
    const req = buildImageRequest({ model: 'dall-e-3', size: '1024x1024' }, 'hello')
    expect(req).toEqual({
      model: 'dall-e-3',
      prompt: 'hello',
      n: 1,
      size: '1024x1024',
      response_format: 'url'
    })
  })

  it('uses provided response_format', () => {
    const req = buildImageRequest(
      { model: 'dall-e-3', size: '1024x1024', response_format: 'b64_json' },
      'hello'
    )
    expect(req.response_format).toBe('b64_json')
  })
})

describe('generateImage', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a Buffer from a b64_json response', async () => {
    const imgBuffer = Buffer.from('fake-image-bytes')
    vi.mocked(request).mockResolvedValueOnce(
      mockJsonResponse(200, { data: [{ b64_json: imgBuffer.toString('base64') }] })
    )

    const result = await generateImage(config, 'hello')

    expect(result).toEqual(imgBuffer)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key'
        },
        body: JSON.stringify(buildImageRequest(config, 'hello')),
        bodyTimeout: 60000
      })
    )
  })

  it('returns a Buffer from a url response by downloading the image', async () => {
    const imgBuffer = Buffer.from('downloaded-image-bytes')
    vi.mocked(request)
      .mockResolvedValueOnce(mockJsonResponse(200, { data: [{ url: 'https://cdn.example.com/img.png' }] }))
      .mockResolvedValueOnce(mockBinaryResponse(imgBuffer))

    const result = await generateImage(config, 'hello')

    expect(result).toEqual(imgBuffer)
    expect(request).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenLastCalledWith('https://cdn.example.com/img.png', expect.anything())
  })

  it('retries on network failure and eventually succeeds', async () => {
    vi.useFakeTimers()
    const imgBuffer = Buffer.from('fake-image-bytes')
    vi.mocked(request)
      .mockImplementationOnce(
        () => new Promise((_, reject) => queueMicrotask(() => reject(new Error('ECONNREFUSED'))))
      )
      .mockResolvedValueOnce(
        mockJsonResponse(200, { data: [{ b64_json: imgBuffer.toString('base64') }] })
      )

    const promise = generateImage(config, 'hello')
    await vi.runOnlyPendingTimersAsync()
    const result = await promise

    expect(result).toEqual(imgBuffer)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('retries on HTTP 5xx and eventually succeeds', async () => {
    vi.useFakeTimers()
    const imgBuffer = Buffer.from('fake-image-bytes')
    vi.mocked(request)
      .mockResolvedValueOnce(mockJsonResponse(503, { error: 'service unavailable' }))
      .mockResolvedValueOnce(
        mockJsonResponse(200, { data: [{ b64_json: imgBuffer.toString('base64') }] })
      )

    const promise = generateImage(config, 'hello')
    await vi.runOnlyPendingTimersAsync()
    const result = await promise

    expect(result).toEqual(imgBuffer)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('retries up to 3 times then throws last error', async () => {
    vi.useFakeTimers()
    vi.mocked(request).mockImplementation(
      () => new Promise((_, reject) => queueMicrotask(() => reject(new Error('TIMEOUT'))))
    )

    const promise = generateImage(config, 'hello')
    const [, error] = await Promise.all([
      vi.runAllTimersAsync(),
      promise.catch((err: Error) => err)
    ])

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('TIMEOUT')
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('does not retry on HTTP 4xx and throws immediately', async () => {
    vi.mocked(request).mockResolvedValueOnce(mockJsonResponse(401, { error: 'unauthorized' }))

    await expect(generateImage(config, 'hello')).rejects.toThrow('HTTP_401')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('throws INVALID_IMAGE_RESPONSE for malformed JSON', async () => {
    vi.mocked(request).mockResolvedValueOnce(mockJsonResponse(200, { invalid: true }))

    await expect(generateImage(config, 'hello')).rejects.toThrow('INVALID_IMAGE_RESPONSE')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('throws INVALID_IMAGE_RESPONSE when JSON parse fails (non-retryable)', async () => {
    vi.mocked(request).mockResolvedValueOnce(mockMalformedJsonResponse())

    await expect(generateImage(config, 'hello')).rejects.toThrow('INVALID_IMAGE_RESPONSE')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('throws INVALID_IMAGE_RESPONSE when response data array is empty', async () => {
    vi.mocked(request).mockResolvedValueOnce(mockJsonResponse(200, { data: [] }))

    await expect(generateImage(config, 'hello')).rejects.toThrow('INVALID_IMAGE_RESPONSE')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not retry on image download 4xx and throws immediately', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce(mockJsonResponse(200, { data: [{ url: 'https://cdn.example.com/img.png' }] }))
      .mockResolvedValueOnce(mockBinaryResponse(Buffer.from(''), 403))

    await expect(generateImage(config, 'hello')).rejects.toThrow('IMAGE_DOWNLOAD_HTTP_403')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('retries on image download 5xx and eventually succeeds', async () => {
    vi.useFakeTimers()
    const imgBuffer = Buffer.from('downloaded-image-bytes')
    vi.mocked(request)
      .mockResolvedValueOnce(mockJsonResponse(200, { data: [{ url: 'https://cdn.example.com/img.png' }] }))
      .mockResolvedValueOnce(mockBinaryResponse(Buffer.from(''), 503))
      .mockResolvedValueOnce(mockJsonResponse(200, { data: [{ url: 'https://cdn.example.com/img.png' }] }))
      .mockResolvedValueOnce(mockBinaryResponse(imgBuffer))

    const promise = generateImage(config, 'hello')
    await vi.runOnlyPendingTimersAsync()
    const result = await promise

    expect(result).toEqual(imgBuffer)
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('follows a 302 redirect when downloading an image and returns the final buffer', async () => {
    const imgBuffer = Buffer.from('final-image-bytes')
    vi.mocked(request)
      .mockResolvedValueOnce(mockJsonResponse(200, { data: [{ url: 'https://cdn.example.com/img.png' }] }))
      .mockResolvedValueOnce(mockBinaryResponse(Buffer.from(''), 302, { location: 'https://example.com/final.png' }))
      .mockResolvedValueOnce(mockBinaryResponse(imgBuffer))

    const result = await generateImage(config, 'hello')

    expect(result).toEqual(imgBuffer)
    expect(request).toHaveBeenCalledTimes(3)
    expect(request).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/img.png', expect.anything())
    expect(request).toHaveBeenNthCalledWith(3, 'https://example.com/final.png', expect.anything())
  })

  it('throws NonRetryableError when image download redirects more than once', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce(mockJsonResponse(200, { data: [{ url: 'https://cdn.example.com/img.png' }] }))
      .mockResolvedValueOnce(mockBinaryResponse(Buffer.from(''), 302, { location: 'https://example.com/loop.png' }))
      .mockResolvedValueOnce(mockBinaryResponse(Buffer.from(''), 302, { location: 'https://example.com/another.png' }))

    await expect(generateImage(config, 'hello')).rejects.toThrow('IMAGE_DOWNLOAD_REDIRECT_FAILED')
    expect(request).toHaveBeenCalledTimes(3)
    expect(request).toHaveBeenNthCalledWith(2, 'https://cdn.example.com/img.png', expect.anything())
    expect(request).toHaveBeenNthCalledWith(3, 'https://example.com/loop.png', expect.anything())
  })

  it('respects AbortSignal and aborts in-flight request', async () => {
    const controller = new AbortController()
    const abortReason = new Error('aborted')
    vi.mocked(request).mockImplementation(
      () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(abortReason))
        })
    )

    const promise = generateImage(config, 'hello', controller.signal)
    controller.abort(abortReason)
    await expect(promise).rejects.toBe(abortReason)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('respects AbortSignal during retry delay', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const abortReason = new Error('aborted')

    vi.mocked(request).mockRejectedValueOnce(new Error('NETWORK_ERROR'))

    const promise = generateImage(config, 'hello', controller.signal)
    controller.abort(abortReason)
    await expect(promise).rejects.toBe(abortReason)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
