import { spawnEffect } from '../entities'
import { TIME_EPSILON } from '../math'
import type { EndReason, World } from '../types'

function endMatch(world: World, reason: EndReason): void {
  if (world.match.status === 'ended') return
  world.match.status = 'ended'
  world.match.endReason = reason
}

/** Counts the match down in simulation time; ends it when time is up. */
export function updateMatchClock(world: World, dt: number): void {
  const { match } = world
  match.secondsLeft = Math.max(0, match.secondsLeft - dt)
  if (match.secondsLeft <= TIME_EPSILON) {
    match.secondsLeft = 0
    endMatch(world, 'timeUp')
  }
}

/** Ends the match once the player's hull is gone. */
export function checkPlayerDestroyed(world: World): void {
  const { player } = world
  if (player.hp > 0) return
  spawnEffect(world, 'explosion', player.x, player.y, player.heading)
  endMatch(world, 'playerDestroyed')
}
