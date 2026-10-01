import { TIME_EPSILON } from '../math'
import type { World } from '../types'

/** Ages visual effects in game time, so they freeze while paused. */
export function updateEffects(world: World, dt: number): void {
  for (const effect of world.effects) {
    if (!effect.alive) continue
    effect.ttl -= dt
    if (effect.ttl <= TIME_EPSILON) effect.alive = false
  }
}
