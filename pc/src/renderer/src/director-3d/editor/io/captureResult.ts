import type { TFunction } from 'i18next'
import type { HostCaptureResult } from './hostBridge'

export interface CaptureResultSummary {
  previewCaptures: Array<{ dataUrl: string; fileName: string; error?: string }>
  status: string
}

export function summarizeCaptureResults(
  saved: HostCaptureResult[],
  t: TFunction<'translation', undefined>
): CaptureResultSummary {
  const empty = saved.find((r) => r.error === 'DIRECTOR3D_EMPTY_CAPTURES')
  if (empty) {
    return {
      previewCaptures: [],
      status: t('director3d.capture.emptyCaptures')
    }
  }

  const failures = saved.filter((r) => r.error || !r.asset)
  if (failures.length > 0) {
    return {
      previewCaptures: failures.map((f) => ({
        dataUrl: f.dataUrl,
        fileName: f.fileName,
        error: f.error === 'DIRECTOR3D_NO_PROJECT_ID'
          ? t('director3d.capture.noProjectId')
          : f.error
      })),
      status: t('director3d.capture.saveFailed', { count: failures.length })
    }
  }

  return {
    previewCaptures: [],
    status: t('director3d.capture.saveSuccess', { count: saved.length })
  }
}
