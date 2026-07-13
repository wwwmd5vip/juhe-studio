/**
 * Utilities for parsing data URLs and handling the `juhe-image://` protocol.
 *
 * The `juhe-image://` protocol is a custom scheme used to reference local image
 * files stored on disk. The path portion is URI-encoded so it can safely carry
 * spaces and non-ASCII characters.
 */

/**
 * Parse a `data:` URL into its MIME type and Base64 payload.
 *
 * @param url - The candidate URL string.
 * @returns An object with `mimeType` and `base64` fields, or `null` if the
 *   input is not a valid Base64 data URL.
 */
export function parseDataUrl(url: string): { mimeType: string; base64: string } | null {
  const match = url.match(/^data:([a-zA-Z0-9+/.-]+);base64,(.+)$/)
  if (!match) {
    return null
  }
  return { mimeType: match[1], base64: match[2] }
}

/**
 * Normalize a Base64 string by trimming surrounding whitespace, stripping any
 * leading data URL prefix, and removing all remaining whitespace characters.
 *
 * @param data - A raw Base64 string, optionally prefixed with a data URL.
 * @returns A compact Base64 string with no whitespace or prefix.
 */
export function cleanBase64(data: string): string {
  const trimmed = data.trim()
  const commaIndex = trimmed.indexOf(',')
  const withoutPrefix = commaIndex !== -1 ? trimmed.slice(commaIndex + 1) : trimmed
  return withoutPrefix.replace(/\s/g, '')
}

/**
 * Determine whether a URL uses the `juhe-image://` protocol.
 *
 * @param url - The URL string to test.
 * @returns `true` if the URL starts with `juhe-image://`.
 */
export function isJuheImageURL(url: string): boolean {
  return url.startsWith('juhe-image://')
}

/**
 * Build a `juhe-image://` URL from a file path.
 *
 * @param filePath - The absolute or relative file path to encode.
 * @returns A `juhe-image://` URL with the path URI-encoded.
 */
export function toJuheImageURL(filePath: string): string {
  return `juhe-image://${encodeURI(filePath)}`
}

/**
 * Extract the original file path from a `juhe-image://` URL.
 *
 * @param url - A `juhe-image://` URL.
 * @returns The decoded file path with the protocol prefix removed.
 */
export function fromJuheImageURL(url: string): string {
  return decodeURIComponent(url.slice('juhe-image://'.length))
}
