/**
 * IPC API defensive accessor.
 *
 * All renderer stores should use `getApi()` instead of capturing `window.api`
 * at module scope. If preload hasn't finished (or failed), this throws a clear
 * error instead of the cryptic "can't access property 'X', api is undefined".
 */

import type { RendererAPI } from '@shared/types/ipc'

let cachedApi: RendererAPI | null = null

export function getApi(): RendererAPI {
  if (!cachedApi) {
    cachedApi = (window as unknown as { api: RendererAPI }).api
    if (!cachedApi) {
      throw new Error(
        'IPC not ready — preload failed or window.api was not exposed. Check the preload console for errors.'
      )
    }
  }
  return cachedApi
}
