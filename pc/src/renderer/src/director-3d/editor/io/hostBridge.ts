import type { Asset } from '@shared/types/creator-os'

export interface HostCaptureItem {
  dataUrl: string
  fileName?: string
}

export interface HostCaptureResult {
  asset?: Asset
  dataUrl: string
  fileName: string
  error?: string
}

let currentProjectId: string | null = null

export function setDirectorDeskProjectId(projectId: string | null) {
  currentProjectId = projectId
}

export function clearDirectorDeskHostBridge() {
  currentProjectId = null
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Post director desk capture data URLs to the host canvas, creating assets.
 *
 * @param captures - The captures to upload. Items without a fileName will use fallbackFileNameBase.
 * @param fallbackFileNameBase - Required base string for generated file names.
 */
export async function postDirectorDeskCapturesToHost(
  captures: HostCaptureItem[],
  fallbackFileNameBase: string
): Promise<HostCaptureResult[]> {
  const normalizedCaptures = captures
    .map((capture, index) => {
      const dataUrl = normalizeString(capture.dataUrl)
      if (!dataUrl) return null
      return {
        dataUrl,
        fileName: normalizeString(capture.fileName) || `${fallbackFileNameBase}-${index + 1}.png`
      }
    })
    .filter((capture): capture is { dataUrl: string; fileName: string } => Boolean(capture))

  if (normalizedCaptures.length === 0) {
    return [{ dataUrl: '', fileName: '', error: 'DIRECTOR3D_EMPTY_CAPTURES' }]
  }

  console.log('[Director3D] Captures ready:', normalizedCaptures.length)

  const projectId = currentProjectId
  if (!projectId) {
    return normalizedCaptures.map((capture) => ({
      ...capture,
      error: 'DIRECTOR3D_NO_PROJECT_ID'
    }))
  }

  return Promise.all(
    normalizedCaptures.map(async (capture) => {
      try {
        const asset = await window.api.creatorOs.createAssetFromDataUrl(
          projectId,
          capture.dataUrl,
          capture.fileName,
          { source: 'director-3d-capture' }
        )
        return { ...capture, asset }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ...capture, error: message }
      }
    })
  )
}

export function initDirectorDeskHostBridge() {
  // pc/ 不需要 message 监听；保留函数以保持调用方兼容。
}
