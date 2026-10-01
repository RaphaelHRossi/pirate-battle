import {
  circleAabbPush,
  circleArenaPush,
  HULL_SIDES,
  hullCircle,
} from '../collision'
import type { Aabb } from '../map'
import type { Vec2 } from '../math'
import type { Ship } from '../types'

/**
 * Solver passes per step. Pushing one circle out can push the other into a
 * different obstacle (e.g. in a corner between coast and arena edge); a few
 * passes settle that. Nearly every step exits after the first pass.
 */
const COLLISION_ITERATIONS = 4

function applyPush(ship: Ship, push: Vec2 | null): boolean {
  if (!push) return false
  ship.x += push.x
  ship.y += push.y
  return true
}

/**
 * Moves the ship out of islands and back inside the arena. Only the part of
 * the motion that points into an obstacle is undone, so a ship hitting a
 * coast at an angle slides along it instead of stopping dead.
 */
export function resolveShipObstacles(
  ship: Ship,
  colliders: readonly Readonly<Aabb>[],
  arena: Readonly<{ width: number; height: number }>,
): void {
  for (let pass = 0; pass < COLLISION_ITERATIONS; pass++) {
    let moved = false
    for (const side of HULL_SIDES) {
      for (const box of colliders) {
        // Recomputed after every push: both circles move with the ship.
        moved =
          applyPush(ship, circleAabbPush(hullCircle(ship, side), box)) || moved
      }
      // The arena goes last so it always wins: a ship never leaves it.
      moved =
        applyPush(ship, circleArenaPush(hullCircle(ship, side), arena)) || moved
    }
    if (!moved) return
  }
}
