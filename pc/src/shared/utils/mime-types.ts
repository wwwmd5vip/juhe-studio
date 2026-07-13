/**
 * MIME type utilities for mapping between MIME types and file extensions.
 *
 * @packageDocumentation
 */

/**
 * Mapping of MIME types to their canonical file extensions.
 */
export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'opus',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/wav': 'wav',
  'audio/pcm': 'wav'
}

/**
 * Reverse mapping of file extensions to MIME types.
 *
 * Includes both `jpg` and `jpeg` aliases for `image/jpeg`.
 */
export const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav'
}

/**
 * Resolve the MIME type for a given file extension.
 *
 * The extension is lowercased and any leading dot is stripped before lookup.
 *
 * @param ext - The file extension (e.g. `'.png'`, `'PNG'`, `'png'`).
 * @returns The matching MIME type, or `'application/octet-stream'` if unknown.
 */
export function getMimeType(ext: string): string {
  const normalized = ext.toLowerCase().replace(/^\./, '')
  return EXT_TO_MIME[normalized] || 'application/octet-stream'
}

/**
 * Resolve the canonical file extension for a given MIME type.
 *
 * @param mimeType - The MIME type (e.g. `'image/jpeg'`).
 * @returns The matching extension without a leading dot, or `'bin'` if unknown.
 */
export function getExtension(mimeType: string): string {
  return MIME_TO_EXT[mimeType] || 'bin'
}
