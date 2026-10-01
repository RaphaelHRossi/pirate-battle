import { circleAabbPush, circlesOverlap, hullCircles } from '../collision'
import { spawnEnemy } from '../entities'
import { TIME_EPSILON } from '../math'
import { nextFloat } from '../rng'
import type { EnemyKind, Ship, World } from '../types'

/**
 * 60/40 by `chaserChance`, except that the Nth spawn is forced to be a
 * Shooter if none appeared before it (N = guaranteedShooterWithinFirst).
 */
function chooseKind(world: World): EnemyKind {
  const { spawned, shootersSpawned } = world.spawn
  const { guaranteedShooterWithinFirst, chaserChance } = world.config.spawn
  if (shootersSpawned === 0 && spawned === guaranteedShooterWithinFirst - 1) {
    return 'shooter'
  }
  return nextFloat(world.rng) < chaserChance ? 'chaser' : 'shooter'
}

/** A random point `edgeMargin` inside one of the four arena edges. */
function edgePoint(world: World): { x: number; y: number } {
  const { width, height } = world.config.arena
  const { edgeMargin } = world.config.spawn
  const edge = Math.floor(nextFloat(world.rng) * 4)
  const t = nextFloat(world.rng)
  const x = edgeMargin + t * (width - 2 * edgeMargin)
  const y = edgeMargin + t * (height - 2 * edgeMargin)
  if (edge === 0) return { x, y: edgeMargin }
  if (edge === 1) return { x: width - edgeMargin, y }
  if (edge === 2) return { x, y: height - edgeMargin }
  return { x: edgeMargin, y }
}

function isFree(world: World, candidate: Ship): boolean {
  const { player } = world
  const { minDistanceFromPlayer } = world.config.spawn
  if (
    Math.hypot(candidate.x - player.x, candidate.y - player.y) <
    minDistanceFromPlayer
  ) {
    return false
  }
  const hull = hullCircles(candidate)
  for (const circle of hull) {
    if (world.map.colliders.some((box) => circleAabbPush(circle, box))) {
      return false
    }
  }
  const others: Ship[] = [player, ...world.enemies.filter((e) => e.alive)]
  return !others.some((ship) =>
    hullCircles(ship).some((a) => hull.some((b) => circlesOverlap(a, b))),
  )
}

/**
 * Tries up to `attempts` seeded random points along the arena edges and
 * returns the first one clear of islands and ships and far enough from the
 * player, facing the player. Null if none qualifies this time.
 */
function findSpawnPoint(world: World, kind: EnemyKind): Ship | null {
  const stats = world.config[kind]
  const { player } = world
  for (let attempt = 0; attempt < world.config.spawn.attempts; attempt++) {
    const { x, y } = edgePoint(world)
    const candidate: Ship = {
      id: 0,
      x,
      y,
      heading: Math.atan2(player.y - y, player.x - x),
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      hullRadius: stats.hullRadius,
      hullOffset: stats.hullOffset,
      lastHitAt: null,
    }
    if (isFree(world, candidate)) return candidate
  }
  return null
}

/**
 * Spawns one enemy every `intervalSeconds` of simulation time, unless the
 * `maxAlive` cap is reached (that interval is skipped).
 */
export function updateSpawning(world: World, dt: number): void {
  const spawn = world.spawn
  if (!spawn.enabled) return
  spawn.timer -= dt
  if (spawn.timer > TIME_EPSILON) return
  spawn.timer += world.config.spawn.intervalSeconds

  const alive = world.enemies.filter((enemy) => enemy.alive).length
  if (alive >= world.config.spawn.maxAlive) return

  const kind = chooseKind(world)
  const point = findSpawnPoint(world, kind)
  if (!point) return
  if (!spawnEnemy(world, kind, point.x, point.y, point.heading)) return
  spawn.spawned += 1
  if (kind === 'shooter') spawn.shootersSpawned += 1
}
