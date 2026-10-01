import type { World } from '../game/types'
import type { MatchResult } from '../storage/lastResult'

/**
 * RFC 4122 version 4 UUID. `crypto.randomUUID` only exists in secure
 * contexts, so a phone opening the dev server over plain http on the LAN
 * falls back to `getRandomValues`, which is available everywhere.
 */
export function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // Index access is in range for a 16-byte array.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

/** The record of a match that has just ended. */
export function createMatchResult(
  world: World,
  now: Date = new Date(),
): MatchResult {
  const { endReason } = world.match
  if (world.match.status !== 'ended' || endReason === null) {
    throw new Error('Only an ended match has a result')
  }
  return {
    matchId: createUuid(),
    score: world.match.score,
    durationMs: Math.round(world.elapsedSeconds * 1000),
    endReason,
    playedAt: now.toISOString(),
    sessionSeconds: world.config.match.durationSeconds,
    spawnSeconds: world.config.spawn.intervalSeconds,
  }
}
