import { updateEffects } from './systems/effects'
import {
  resolveChaserContacts,
  updateEnemyMovement,
  updateShooterWeapons,
} from './systems/enemies'
import { checkPlayerDestroyed, updateMatchClock } from './systems/match'
import { updatePlayerMovement } from './systems/playerMovement'
import { updateProjectiles } from './systems/projectiles'
import { separateShips } from './systems/separation'
import { resolveShipObstacles } from './systems/shipCollision'
import { updateSpawning } from './systems/spawning'
import { updatePlayerWeapons } from './systems/weapons'
import type { InputIntents, World } from './types'

/**
 * A call (not a property read) so TypeScript does not narrow the status
 * across systems that can end the match.
 */
function hasEnded(world: World): boolean {
  return world.match.status === 'ended'
}

/**
 * Advances the simulation by exactly one fixed step. `dt` is always the
 * loop's fixed step, never the frame delta.
 *
 * Once the match has ended this is the only gate needed to freeze it:
 * no system that moves, fires, damages, spawns or scores runs again.
 * Visual effects keep fading so the final explosion plays out.
 */
export function step(
  world: World,
  input: Readonly<InputIntents>,
  dt: number,
): void {
  if (hasEnded(world)) {
    updateEffects(world, dt)
    return
  }
  world.tick += 1
  world.elapsedSeconds += dt

  updateMatchClock(world, dt)
  if (hasEnded(world)) return

  updateSpawning(world, dt)

  // Move everyone, then settle contacts and overlaps; islands and the
  // arena are resolved last so they always win.
  updatePlayerMovement(world, input, dt)
  updateEnemyMovement(world, dt)
  resolveChaserContacts(world)
  separateShips(world)
  const { colliders } = world.map
  const { arena } = world.config
  resolveShipObstacles(world.player, colliders, arena)
  for (const enemy of world.enemies) {
    if (enemy.alive) resolveShipObstacles(enemy, colliders, arena)
  }

  // Fire from resolved positions, then fly everything (new shots included).
  updatePlayerWeapons(world, input, dt)
  updateShooterWeapons(world, dt)
  updateProjectiles(world, dt)
  updateEffects(world, dt)

  checkPlayerDestroyed(world)
}
