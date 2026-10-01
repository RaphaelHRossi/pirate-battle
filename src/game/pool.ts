/** Anything kept in a fixed-size pool: dead slots are reused, never freed. */
export interface Poolable {
  alive: boolean
  /** Seconds of life left; also decides which slot to recycle when full. */
  ttl: number
}

/** Allocates every slot up front, so a match never allocates mid-combat. */
export function createPool<T extends Poolable>(
  capacity: number,
  make: () => T,
): T[] {
  return Array.from({ length: capacity }, make)
}

/**
 * Returns a slot to (re)initialise: the first dead one, or, if every slot
 * is alive, the one closest to expiring. The caller overwrites every field.
 */
export function acquire<T extends Poolable>(pool: T[]): T {
  let victim: T | undefined
  for (const item of pool) {
    if (!item.alive) return item
    if (!victim || item.ttl < victim.ttl) victim = item
  }
  if (!victim) throw new Error('Cannot acquire from an empty pool')
  return victim
}
