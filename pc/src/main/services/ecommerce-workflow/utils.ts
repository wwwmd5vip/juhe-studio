import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ECOMMERCE_PRODUCT_IMAGE_DIR } from '@shared/ecommerce-workflow/constants'
import type { WorkflowContext } from '@shared/ecommerce-workflow/types'
import { mapProviderType } from '@shared/constants/provider-mapping'
import type { ImageSize } from '@shared/types/generation'
import { getMimeType } from '@shared/utils/mime-types'
import { resolveModelCapabilities } from '@shared/utils/model-capabilities'
import { isPathInside } from '@main/utils/file-utils'
import { app } from 'electron'

export { resolveProvider as resolveProviderConfig, buildAiCoreSettings } from '@main/utils/provider-resolver'

export const DEFAULT_TEMPERATURE = 0.7
export const DEFAULT_MAX_RETRIES = 0

export type ContentPart = { type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }

export { mapProviderType }

export function checkCapability(modelId: string, required: 'vision' | 'chat' | 'image') {
  const caps = resolveModelCapabilities({ name: modelId })
  if (!caps.includes(required)) {
    throw new Error(`Model ${modelId} does not support ${required}`)
  }
}

export async function filePathToBase64DataUrl(filePath: string): Promise<string> {
  const rawPath = filePath.replace(/^file:\/\//, '')
  const resolved = path.resolve(rawPath)

  const allowedRoot = path.join(app.getPath('userData'), ECOMMERCE_PRODUCT_IMAGE_DIR)
  if (!isPathInside(resolved, allowedRoot)) {
    throw new Error(`Access denied: ${resolved} is outside allowed directory`)
  }

  const ext = path.extname(resolved).slice(1).toLowerCase() || 'png'
  const mime = getMimeType(ext)
  const buffer = await readFile(resolved)
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export function buildPromptContext(context: WorkflowContext, previousOutput?: string): Record<string, unknown> {
  return {
    productText: context.productText ?? '',
    productImage: context.productImage ?? '',
    platform: context.platform ?? '',
    market: context.market ?? 'us',
    language: context.language ?? 'en',
    ratio: context.ratio ?? '1:1',
    previousOutput: previousOutput ?? '',
    outputs: context.outputs
  }
}

export function aspectRatioToImageSize(ratio?: string): ImageSize {
  switch (ratio) {
    case '1:1':
      return '1024x1024'
    case '3:4':
    case '9:16':
      return '1024x1536'
    case '4:3':
    case '16:9':
      return '1536x1024'
    default:
      return '1024x1024'
  }
}
