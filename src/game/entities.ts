import type { GunConfig } from './config'
import type { DeepReadonly } from './immutable'
import { acquire } from './pool'
import type {
  EffectKind,
  Enemy,
  EnemyKind,
  ProjectileOwner,
  Ship,
  World,
} from './types'

/** Allocates the next unique entity id. */
export function nextId(world: World): number {
  const id = world.nextEntityId
  world.nextEntityId += 1
  return id
}

export function spawnProjectile(
  world: World,
  owner: ProjectileOwner,
  x: number,
  y: number,
  heading: number,
  gun: DeepReadonly<GunConfig>,
): void {
  const projectile = acquire(world.projectiles)
  projectile.id = nextId(world)
  projectile.alive = true
  projectile.owner = owner
  projectile.x = x
  projectile.y = y
  projectile.vx = Math.cos(heading) * gun.speed
  projectile.vy = Math.sin(heading) * gun.speed
  projectile.damage = gun.damage
  projectile.ttl = gun.ttlSeconds
}

export function spawnEffect(
  world: World,
  kind: EffectKind,
  x: number,
  y: number,
  heading: number,
): void {
  const { muzzleFlashSeconds, explosionSeconds } = world.config.effects
  const effect = acquire(world.effects)
  effect.alive = true
  effect.kind = kind
  effect.x = x
  effect.y = y
  effect.heading = heading
  effect.ttl = kind === 'explosion' ? explosionSeconds : muzzleFlashSeconds
}

/**
 * Puts an enemy into a free slot, or returns null when all `maxAlive`
 * slots are taken.
 */
export function spawnEnemy(
  world: World,
  kind: EnemyKind,
  x: number,
  y: number,
  heading: number,
): Enemy | null {
  const enemy = world.enemies.find((slot) => !slot.alive)
  if (!enemy) return null
  const stats = world.config[kind]
  enemy.id = nextId(world)
  enemy.alive = true
  enemy.kind = kind
  enemy.x = x
  enemy.y = y
  enemy.heading = heading
  enemy.hp = stats.maxHp
  enemy.maxHp = stats.maxHp
  enemy.hullRadius = stats.hullRadius
  enemy.hullOffset = stats.hullOffset
  enemy.gunCooldown = 0
  enemy.avoidTurn = 0
  return enemy
}

/**
 * Removes an enemy from play at once: a dead slot no longer moves, fires,
 * collides or takes hits. Only kills by the player's guns score.
 */
export function destroyEnemy(
  world: World,
  enemy: Enemy,
  { scored }: { scored: boolean },
): void {
  enemy.alive = false
  enemy.hp = 0
  if (scored) world.match.score += 1
  spawnEffect(world, 'explosion', enemy.x, enemy.y, enemy.heading)
}

/** Point `distance` px ahead of the ship along its heading. */
export function pointAhead(
  ship: Readonly<Ship>,
  distance: number,
): { x: number; y: number } {
  return {
    x: ship.x + Math.cos(ship.heading) * distance,
    y: ship.y + Math.sin(ship.heading) * distance,
  }
}
