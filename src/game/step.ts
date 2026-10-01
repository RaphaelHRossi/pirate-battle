import type { InputIntents, World } from './types'

/**
 * Advances the simulation by exactly one fixed step. `dt` is always the
 * loop's fixed step, never the frame delta.
 */
export function step(
  world: World,
  // Read by the movement system once it exists.
  _input: Readonly<InputIntents>,
  dt: number,
): void {
  world.tick += 1
  world.elapsedSeconds += dt
}
