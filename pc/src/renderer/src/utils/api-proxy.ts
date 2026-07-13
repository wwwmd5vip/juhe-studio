/**
 * Renderer API proxy factory.
 * Creates a lazy proxy that delegates to the real RendererAPI on first access.
 * Replaces the identical Proxy pattern duplicated across 10 store files.
 */

import type { RendererAPI } from '@shared/types/ipc'
import { getApi } from '@/utils/ipc'

/**
 * Create a lazy proxy for the RendererAPI.
 * Each property access delegates to the current getApi() result,
 * ensuring the proxy always uses the latest API instance.
 */
export function createApiProxy(): RendererAPI {
  return new Proxy({} as RendererAPI, {
    get(_, prop) {
      const real = getApi()
      return real[prop as keyof RendererAPI]
    }
  })
}
