import { TIME_EPSILON } from '../math'
import type { World } from '../types'

/** Ages visual effects in game time, so they freeze while paused. */
export function updateEffects(world: World, dt: number): void {
  for (const flash of world.muzzleFlashes) {
    if (!flash.alive) continue
    flash.ttl -= dt
    if (flash.ttl <= TIME_EPSILON) flash.alive = false
  }
}
