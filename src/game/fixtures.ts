import { spawnProjectile } from './entities'
import { degToRad, wrapAngle } from './math'
import type { World } from './types'

function placePlayer(
  world: World,
  x: number,
  y: number,
  heading: number,
): void {
  world.player.x = x
  world.player.y = y
  world.player.heading = wrapAngle(heading)
}

/**
 * Named start states for e2e tests (`?test=1&fixture=<name>`). Coordinates
 * refer to DEFAULT_MAP: the northwest island's collider spans
 * x 264–504, y 136–376.
 */
export const GAME_FIXTURES: Readonly<Record<string, (world: World) => void>> = {
  /** Facing west, straight at the northwest island's east coast. */
  'island-ahead': (world) => {
    placePlayer(world, 720, 256, Math.PI)
  },
  /** Facing west and 20° north, so it meets the same coast at an angle. */
  'island-glancing': (world) => {
    placePlayer(world, 720, 330, Math.PI + degToRad(20))
  },
  /** An enemy ball 150 px ahead of the player (at spawn), flying at its bow. */
  'incoming-shot': (world) => {
    const { x, y } = world.player
    spawnProjectile(
      world,
      'enemy',
      x,
      y - 150,
      Math.PI / 2,
      world.config.shooter.gun,
    )
  },
}

export function applyFixture(world: World, name: string): void {
  const fixture = GAME_FIXTURES[name]
  if (!fixture) {
    const known = Object.keys(GAME_FIXTURES).join(', ')
    throw new Error(`Unknown fixture "${name}" (known: ${known})`)
  }
  fixture(world)
}
