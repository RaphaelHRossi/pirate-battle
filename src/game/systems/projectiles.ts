import {
  circleAabbPush,
  circlesOverlap,
  hullCircles,
  type Circle,
} from '../collision'
import { TIME_EPSILON } from '../math'
import type { Projectile, Ship, World } from '../types'

/**
 * The only place damage is applied. Removing the projectile in the same
 * call is what makes "each projectile hits at most once" hold: every loop
 * skips dead projectiles, so it can never be seen again.
 */
export function applyHit(projectile: Projectile, ship: Ship): void {
  ship.hp = Math.max(0, ship.hp - projectile.damage)
  projectile.alive = false
}

/** Hits `ship` if the ball touches either hull circle; true if it did. */
function tryHit(projectile: Projectile, ball: Circle, ship: Ship): boolean {
  for (const hull of hullCircles(ship)) {
    if (circlesOverlap(ball, hull)) {
      applyHit(projectile, ship)
      return true
    }
  }
  return false
}

function isOutsideArena(
  projectile: Projectile,
  arena: Readonly<{ width: number; height: number }>,
): boolean {
  return (
    projectile.x < 0 ||
    projectile.y < 0 ||
    projectile.x > arena.width ||
    projectile.y > arena.height
  )
}

/**
 * Moves every live projectile and removes it when it expires, leaves the
 * arena, hits an island or hits a ship of the other side.
 */
export function updateProjectiles(world: World, dt: number): void {
  const { arena, projectiles } = world.config
  const colliders = world.map.colliders

  for (const projectile of world.projectiles) {
    if (!projectile.alive) continue

    projectile.x += projectile.vx * dt
    projectile.y += projectile.vy * dt
    projectile.ttl -= dt

    const ball: Circle = {
      x: projectile.x,
      y: projectile.y,
      r: projectiles.radius,
    }
    if (
      projectile.ttl <= TIME_EPSILON ||
      isOutsideArena(projectile, arena) ||
      colliders.some((box) => circleAabbPush(ball, box) !== null)
    ) {
      projectile.alive = false
      continue
    }

    // Owners never hit their own side. Player shots will test enemies here
    // once they exist; tryHit stops at the first ship hit.
    if (projectile.owner === 'enemy') tryHit(projectile, ball, world.player)
  }
}
