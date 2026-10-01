import { saveLastResult, type MatchResult } from '../storage/lastResult'
import { getPlayer } from '../storage/player'
import type { MatchRecord } from './contracts'
import { outbox } from './outbox'

export function toMatchRecord(result: MatchResult): MatchRecord {
  const { playerId, name } = getPlayer()
  return {
    matchId: result.matchId,
    playerId,
    playerName: name,
    playedAt: result.playedAt,
    score: result.score,
    durationMs: result.durationMs,
    endReason: result.endReason,
    config: {
      sessionSeconds: result.sessionSeconds,
      spawnSeconds: result.spawnSeconds,
    },
  }
}

/**
 * Called on the step a match ends. Synchronous and network-free: the
 * result and its record are on disk before any request exists, so the
 * RegistrationSync component only ever sends what the outbox holds.
 */
export function recordCompletedMatch(result: MatchResult): void {
  saveLastResult(result)
  outbox.add(toMatchRecord(result))
}
