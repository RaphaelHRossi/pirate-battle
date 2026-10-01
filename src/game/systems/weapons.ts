import type { GunConfig } from '../config'
import type { DeepReadonly } from '../immutable'
import { TIME_EPSILON } from '../math'
import { acquire } from '../pool'
import type { InputIntents, PlayerShip, ProjectileOwner, World } from '../types'

type Side = -1 | 1
const LEFT: Side = -1
const RIGHT: Side = 1

export function spawnProjectile(
  world: World,
  owner: ProjectileOwner,
  x: number,
  y: number,
  heading: number,
  gun: DeepReadonly<GunConfig>,
): void {
  const projectile = acquire(world.projectiles)
  projectile.id = world.nextEntityId
  world.nextEntityId += 1
  projectile.alive = true
  projectile.owner = owner
  projectile.x = x
  projectile.y = y
  projectile.vx = Math.cos(heading) * gun.speed
  projectile.vy = Math.sin(heading) * gun.speed
  projectile.damage = gun.damage
  projectile.ttl = gun.ttlSeconds
}

export function spawnMuzzleFlash(
  world: World,
  x: number,
  y: number,
  heading: number,
): void {
  const flash = acquire(world.muzzleFlashes)
  flash.alive = true
  flash.x = x
  flash.y = y
  flash.heading = heading
  flash.ttl = world.config.effects.muzzleFlashSeconds
}

function isReady(cooldown: number): boolean {
  return cooldown <= TIME_EPSILON
}

/** One ball from the bow, flying along the heading. */
function fireFront(world: World, ship: PlayerShip): void {
  const { radius } = world.config.projectiles
  // Starts just past the bow circle so it never overlaps its own hull.
  const distance = ship.hullOffset + ship.hullRadius + radius
  const x = ship.x + Math.cos(ship.heading) * distance
  const y = ship.y + Math.sin(ship.heading) * distance
  spawnProjectile(
    world,
    'player',
    x,
    y,
    ship.heading,
    world.config.player.frontGun,
  )
  spawnMuzzleFlash(world, x, y, ship.heading)
}

/**
 * `count` parallel balls fired perpendicular to the hull, spread `spacing`
 * px apart along it. With a clockwise heading, heading + π/2 is starboard.
 */
function fireBroadside(world: World, ship: PlayerShip, side: Side): void {
  const { broadside } = world.config.player
  const { radius } = world.config.projectiles
  const direction = ship.heading + (side * Math.PI) / 2
  const outward = ship.hullRadius + radius
  const alongX = Math.cos(ship.heading)
  const alongY = Math.sin(ship.heading)
  const outX = Math.cos(direction) * outward
  const outY = Math.sin(direction) * outward

  for (let i = 0; i < broadside.count; i++) {
    const along = (i - (broadside.count - 1) / 2) * broadside.spacing
    const x = ship.x + alongX * along + outX
    const y = ship.y + alongY * along + outY
    spawnProjectile(world, 'player', x, y, direction, broadside)
    spawnMuzzleFlash(world, x, y, direction)
  }
}

/**
 * Counts cooldowns down in simulation time and fires every ready weapon
 * whose intent is set. Holding a key fires again as soon as it is ready.
 */
export function updatePlayerWeapons(
  world: World,
  input: Readonly<InputIntents>,
  dt: number,
): void {
  const { player } = world
  const { frontGun, broadside } = world.config.player
  const cooldowns = player.cooldowns

  cooldowns.front = Math.max(0, cooldowns.front - dt)
  cooldowns.left = Math.max(0, cooldowns.left - dt)
  cooldowns.right = Math.max(0, cooldowns.right - dt)

  if (input.fireFront && isReady(cooldowns.front)) {
    fireFront(world, player)
    cooldowns.front = frontGun.cooldownSeconds
  }
  if (input.fireLeft && isReady(cooldowns.left)) {
    fireBroadside(world, player, LEFT)
    cooldowns.left = broadside.cooldownSeconds
  }
  if (input.fireRight && isReady(cooldowns.right)) {
    fireBroadside(world, player, RIGHT)
    cooldowns.right = broadside.cooldownSeconds
  }
}
