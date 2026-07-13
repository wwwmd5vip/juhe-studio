/**
 * JSON and object filtering utilities.
 */

/**
 * Parse a value that may be a JSON string, an already-parsed object, or nullish.
 *
 * - `null` / `undefined` → returns `fallback`.
 * - `string` → attempts `JSON.parse`; on failure returns `fallback`.
 * - otherwise (already an object/array/number/etc.) → returned as-is typed as `T`.
 *
 * @param value - The raw value to interpret.
 * @param fallback - The value to use when parsing is not possible.
 * @returns The parsed value, the value itself, or the fallback.
 */
export function parseJsonField<T>(value: string | T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

/**
 * Return a new object containing only the keys from `allowed` that exist in `data`.
 *
 * Keys in `allowed` that are not present on `data` are skipped; keys on `data`
 * that are not in `allowed` are omitted from the result.
 *
 * @param data - The source object.
 * @param allowed - The allow-list of keys to retain.
 * @returns A shallow copy of `data` filtered to the allowed keys.
 */
export function filterAllowed(data: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      result[key] = data[key]
    }
  }
  return result
}
