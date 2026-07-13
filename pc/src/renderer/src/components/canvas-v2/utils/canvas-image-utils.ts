/**
 * canvas-image-utils.ts - 图片工具
 * 裁剪、分割、放大
 */

/** Safe canvas 2d context */
function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2d canvas context')
  return ctx
}

/** 从 data URL 创建 Image */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

/** Image → canvas → dataURL */
function _imageToDataUrl(img: HTMLImageElement, format = 'image/png', quality = 1): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = get2DContext(canvas)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL(format, quality)
}

/** Canvas → dataURL */
function canvasToDataUrl(canvas: HTMLCanvasElement, format = 'image/png'): string {
  return canvas.toDataURL(format)
}

// ---- Crop ----

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export async function cropImage(dataUrl: string, rect: CropRect): Promise<string> {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = rect.width
  canvas.height = rect.height
  const ctx = get2DContext(canvas)
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
  return canvasToDataUrl(canvas)
}

/** 居中裁剪到指定尺寸 */
export async function centerCrop(dataUrl: string, targetW: number, targetH: number): Promise<string> {
  const img = await loadImage(dataUrl)
  const srcRatio = img.naturalWidth / img.naturalHeight
  const targetRatio = targetW / targetH

  let srcX = 0,
    srcY = 0,
    srcW = img.naturalWidth,
    srcH = img.naturalHeight

  if (srcRatio > targetRatio) {
    srcW = img.naturalHeight * targetRatio
    srcX = (img.naturalWidth - srcW) / 2
  } else {
    srcH = img.naturalWidth / targetRatio
    srcY = (img.naturalHeight - srcH) / 2
  }

  return cropImage(dataUrl, {
    x: Math.round(srcX),
    y: Math.round(srcY),
    width: Math.round(srcW),
    height: Math.round(srcH)
  })
}

// ---- Split ----

export interface SplitParams {
  rows: number
  cols: number
}

export async function splitImage(dataUrl: string, params: SplitParams): Promise<string[]> {
  const img = await loadImage(dataUrl)
  const pieceW = Math.floor(img.naturalWidth / params.cols)
  const pieceH = Math.floor(img.naturalHeight / params.rows)
  const results: string[] = []

  for (let row = 0; row < params.rows; row++) {
    for (let col = 0; col < params.cols; col++) {
      const rect: CropRect = {
        x: col * pieceW,
        y: row * pieceH,
        width: pieceW,
        height: pieceH
      }
      results.push(await cropImage(dataUrl, rect))
    }
  }

  return results
}

// ---- Upscale ----

export type UpscaleMethod = 'nearest' | 'bilinear' | 'bicubic'

export async function upscaleImage(
  dataUrl: string,
  scale: number,
  method: UpscaleMethod = 'bicubic',
  maxDimension = 4096
): Promise<string> {
  const img = await loadImage(dataUrl)
  const w = Math.min(Math.round(img.naturalWidth * scale), maxDimension)
  const h = Math.min(Math.round(img.naturalHeight * scale), maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = get2DContext(canvas)

  ctx.imageSmoothingEnabled = method !== 'nearest'
  ctx.imageSmoothingQuality = method === 'bicubic' ? 'high' : 'medium'

  ctx.drawImage(img, 0, 0, w, h)
  return canvasToDataUrl(canvas)
}

// ---- Get Image Dimensions ----

export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(dataUrl)
  return { width: img.naturalWidth, height: img.naturalHeight }
}
