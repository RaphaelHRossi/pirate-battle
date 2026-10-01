import { spawnEnemy, spawnProjectile } from './entities'
import { degToRad, wrapAngle } from './math'
import type { World } from './types'

const FACING_UP = -Math.PI / 2
const FACING_DOWN = Math.PI / 2

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
 * x 264–504, y 136–376, and the column x = 960 is open water.
 * Fixtures with enemies turn spawning off so the scene stays isolated.
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
      FACING_DOWN,
      world.config.shooter.gun,
    )
  },
  /** A Chaser 400 px straight ahead of the player, coming at it. */
  'chaser-ahead': (world) => {
    world.spawn.enabled = false
    const { x, y } = world.player
    spawnEnemy(world, 'chaser', x, y - 400, FACING_DOWN)
  },
  /**
   * The northwest island stands between a Chaser (west of it) and the
   * player (east of it): the Chaser must steer around it.
   */
  'chaser-behind-island': (world) => {
    world.spawn.enabled = false
    placePlayer(world, 720, 256, Math.PI)
    spawnEnemy(world, 'chaser', 130, 256, 0)
  },
  /** Player low in the open column, a Shooter 800 px north, out of range. */
  'shooter-far': (world) => {
    world.spawn.enabled = false
    placePlayer(world, 960, 940, FACING_UP)
    spawnEnemy(world, 'shooter', 960, 140, FACING_DOWN)
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
