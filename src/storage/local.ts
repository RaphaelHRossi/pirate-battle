import type { z } from 'zod'

/** Every key this app writes starts with this, so Reset can find them all. */
export const STORAGE_PREFIX = 'pirate-battle:'

/**
 * Reads and validates one JSON value. Anything missing, unparsable or not
 * matching the schema (an old version, a hand edit) is treated as absent:
 * the caller falls back to its default instead of trusting the data.
 * localStorage itself can throw (disabled storage, private mode).
 */
export function readStored<T>(key: string, schema: z.ZodType<T>): T | null {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_PREFIX + key)
  } catch {
    return null
  }
  if (raw === null) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = schema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** Writes one JSON value; returns false if storage is unavailable or full. */
export function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`Could not save "${key}"`, error)
    return false
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // Nothing stored, nothing to remove.
  }
}
