import type { TFunction } from 'i18next'

export type Director3dErrorCode =
  | 'DIRECTOR3D_VIEWPORT_CAPTURE_NOT_REGISTERED'
  | 'DIRECTOR3D_REF_VIDEO_NOT_READY'
  | 'DIRECTOR3D_MODEL_READ_FAILED'
  | 'DIRECTOR3D_MODEL_FORMAT_UNSUPPORTED'
  | 'DIRECTOR3D_PANORAMA_SIZE_FAILED'
  | 'DIRECTOR3D_PANORAMA_GEN_FAILED'
  | 'DIRECTOR3D_PANORAMA_FORMAT_UNSUPPORTED'

export function getDirector3dErrorMessage(
  error: unknown,
  t: TFunction<'translation', undefined>
): string {
  const message = error instanceof Error ? error.message : String(error)
  switch (message) {
    case 'DIRECTOR3D_VIEWPORT_CAPTURE_NOT_REGISTERED':
      return t('director3d.error.viewportCaptureNotRegistered')
    case 'DIRECTOR3D_REF_VIDEO_NOT_READY':
      return t('director3d.error.refVideoNotReady')
    case 'DIRECTOR3D_MODEL_READ_FAILED':
      return t('director3d.error.modelReadFailed')
    case 'DIRECTOR3D_MODEL_FORMAT_UNSUPPORTED':
      return t('director3d.error.modelFormatUnsupported')
    case 'DIRECTOR3D_PANORAMA_SIZE_FAILED':
      return t('director3d.error.panoramaSizeFailed')
    case 'DIRECTOR3D_PANORAMA_GEN_FAILED':
      return t('director3d.error.panoramaGenFailed')
    case 'DIRECTOR3D_PANORAMA_FORMAT_UNSUPPORTED':
      return t('director3d.error.panoramaFormatUnsupported')
    default:
      return message
  }
}
