import { circlesOverlap, hullCircles } from '../collision'
import {
  damageShip,
  destroyEnemy,
  spawnEffect,
  spawnProjectile,
} from '../entities'
import { clamp, degToRad, wrapAngle } from '../math'
import type { Enemy, World } from '../types'
import { isReady } from './weapons'

/**
 * True if a point is too close to an island or the arena edge for a hull
 * of radius `margin` to pass through it.
 */
function isBlocked(
  world: World,
  x: number,
  y: number,
  margin: number,
): boolean {
  const { width, height } = world.config.arena
  if (x < margin || y < margin || x > width - margin || y > height - margin) {
    return true
  }
  return world.map.colliders.some(
    (box) =>
      x > box.minX - margin &&
      x < box.maxX + margin &&
      y > box.minY - margin &&
      y < box.maxY + margin,
  )
}

/**
 * Seek-with-avoidance steering. Three feelers (ahead, and ±feelerAngle)
 * probe the water in front of the ship:
 * - nothing blocked: turn toward the player, at most turnSpeed × dt;
 * - one side blocked: turn away from it at full rate;
 * - both sides or only the centre blocked: turn toward the player's side;
 * - once avoiding, keep that direction until every feeler is clear
 *   (hysteresis), letting hull collision slide the ship along the coast.
 * Close to the player the feelers are ignored, so a Chaser still rams a
 * player hugging a coast.
 */
function steer(world: World, enemy: Enemy, dt: number): number {
  const { player } = world
  const { feelerLength, feelerAngleDeg } = world.config.ai
  const maxTurn = degToRad(world.config[enemy.kind].turnSpeedDegPerSec) * dt
  const dx = player.x - enemy.x
  const dy = player.y - enemy.y
  const offPlayer = wrapAngle(Math.atan2(dy, dx) - enemy.heading)

  if (Math.hypot(dx, dy) > feelerLength) {
    const spread = degToRad(feelerAngleDeg)
    const feeler = (angle: number): boolean =>
      isBlocked(
        world,
        enemy.x + Math.cos(enemy.heading + angle) * feelerLength,
        enemy.y + Math.sin(enemy.heading + angle) * feelerLength,
        enemy.hullRadius,
      )
    const left = feeler(-spread)
    const centre = feeler(0)
    const right = feeler(spread)
    if (left || centre || right) {
      // Commit to one direction until the way is clear. Re-deciding every
      // step would flip-flop when the player is dead ahead (offset 0 → turn
      // right, offset −2° → turn left, ...) and the ship would never turn.
      if (enemy.avoidTurn === 0) {
        if (left && !right) enemy.avoidTurn = 1
        else if (right && !left) enemy.avoidTurn = -1
        else enemy.avoidTurn = offPlayer >= 0 ? 1 : -1
      }
      return enemy.avoidTurn * maxTurn
    }
  }
  enemy.avoidTurn = 0
  return clamp(offPlayer, -maxTurn, maxTurn)
}

/** Turns and moves every live enemy; collisions are resolved afterwards. */
export function updateEnemyMovement(world: World, dt: number): void {
  const { player } = world
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue
    enemy.heading = wrapAngle(enemy.heading + steer(world, enemy, dt))

    const stats = world.config[enemy.kind]
    // A Shooter holds position once it is close enough; Chasers never stop.
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y)
    const holding =
      enemy.kind === 'shooter' && distance <= world.config.shooter.stopDistance
    if (!holding) {
      enemy.x += Math.cos(enemy.heading) * stats.speed * dt
      enemy.y += Math.sin(enemy.heading) * stats.speed * dt
    }
  }
}

/**
 * A Chaser touching the player's hull deals its contact damage and
 * explodes. It scores nothing: only the player's guns score.
 */
export function resolveChaserContacts(world: World): void {
  const { player } = world
  const playerHull = hullCircles(player)
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.kind !== 'chaser') continue
    const touching = hullCircles(enemy).some((circle) =>
      playerHull.some((other) => circlesOverlap(circle, other)),
    )
    if (!touching) continue
    damageShip(world, player, world.config.chaser.contactDamage)
    destroyEnemy(world, enemy, { scored: false })
  }
}

/**
 * Shooters fire their front gun when the player is in range, the bow
 * points at the player within the aim tolerance, and the gun is ready.
 */
export function updateShooterWeapons(world: World, dt: number): void {
  const { player } = world
  const { range, aimToleranceDeg, gun } = world.config.shooter
  const { radius } = world.config.projectiles
  const tolerance = degToRad(aimToleranceDeg)

  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.kind !== 'shooter') continue
    enemy.gunCooldown = Math.max(0, enemy.gunCooldown - dt)

    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const aimError = Math.abs(wrapAngle(Math.atan2(dy, dx) - enemy.heading))
    if (Math.hypot(dx, dy) > range || aimError > tolerance) continue
    if (!isReady(enemy.gunCooldown)) continue

    const muzzle = enemy.hullOffset + enemy.hullRadius + radius
    const x = enemy.x + Math.cos(enemy.heading) * muzzle
    const y = enemy.y + Math.sin(enemy.heading) * muzzle
    spawnProjectile(world, 'enemy', x, y, enemy.heading, gun)
    spawnEffect(world, 'muzzleFlash', x, y, enemy.heading)
    enemy.gunCooldown = gun.cooldownSeconds
  }
}
