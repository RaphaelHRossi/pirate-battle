import { resolveShipObstacles } from './systems/shipCollision'
import { updatePlayerMovement } from './systems/playerMovement'
import type { InputIntents, World } from './types'

/**
 * Advances the simulation by exactly one fixed step. `dt` is always the
 * loop's fixed step, never the frame delta.
 */
export function step(
  world: World,
  input: Readonly<InputIntents>,
  dt: number,
): void {
  world.tick += 1
  world.elapsedSeconds += dt
  updatePlayerMovement(world, input, dt)
  resolveShipObstacles(world.player, world.map.colliders, world.config.arena)
}
