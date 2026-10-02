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
  /** A Shooter 350 px straight ahead of the player, in range, facing it. */
  'shooter-ahead': (world) => {
    world.spawn.enabled = false
    const { x, y } = world.player
    spawnEnemy(world, 'shooter', x, y - 350, FACING_DOWN)
  },
  /** Like chaser-behind-island, with a Shooter west of the island. */
  'shooter-behind-island': (world) => {
    world.spawn.enabled = false
    placePlayer(world, 720, 256, Math.PI)
    spawnEnemy(world, 'shooter', 130, 256, 0)
  },
  /**
   * Worst case for performance profiling: 12 Shooters (the enemy cap) on a
   * 360 px ring around the player, all firing, nothing spawning. The
   * player gets 1,000,000 hp: 12 guns deal at most 60 hp/s, so it cannot
   * sink in any session (no rule is changed), and as long as the player
   * does not fire, all 12 stay alive.
   */
  stress: (world) => {
    world.spawn.enabled = false
    world.player.maxHp = 1_000_000
    world.player.hp = 1_000_000
    const { x, y } = world.player
    const count = world.config.spawn.maxAlive
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      // Facing the player (heading points from the ring to the centre).
      const shooter = spawnEnemy(
        world,
        'shooter',
        x + Math.cos(angle) * 360,
        y + Math.sin(angle) * 360,
        wrapAngle(angle + Math.PI),
      )
      // Staggered guns: a steady stream of shots, not one volley every 2 s.
      if (shooter) {
        shooter.gunCooldown =
          (i / count) * world.config.shooter.gun.cooldownSeconds
      }
    }
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
