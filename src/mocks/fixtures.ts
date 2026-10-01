import type { MatchRecord } from '../api/contracts'
import { createRng, nextFloat, nextRange, type Rng } from '../game/rng'

/**
 * Other captains' matches, so the ranking has rivals. Generated from a
 * fixed seed: the same records (ids, scores, dates) on every load, in
 * every browser, which keeps tests and screenshots stable. They live in
 * code, not in the mock DB, so Reset never removes them.
 */

const CAPTAINS = [
  'Captain Flint',
  'Red Sparrow',
  'Storm Rider',
  'Sea Wolf',
  'Anne Bonny',
  'Black Bart',
  'Grace O’Malley',
  'Iron Hook',
  'Salty Pete',
  'Mary Read',
  'Long Ben',
  'Silver Gull',
  'Calico Jack',
  'Ching Shih',
] as const

/** How many fixture matches each config has (120s-3s spans 4 pages of 5). */
const MATCHES_PER_CONFIG = [
  { sessionSeconds: 120, spawnSeconds: 3, count: 18 },
  { sessionSeconds: 60, spawnSeconds: 1.5, count: 6 },
  { sessionSeconds: 180, spawnSeconds: 5, count: 4 },
  { sessionSeconds: 90, spawnSeconds: 2, count: 3 },
] as const

const FIRST_DATE = Date.UTC(2026, 8, 7, 18, 0)

function uuidFrom(rng: Rng): string {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(nextFloat(rng) * 16).toString(16),
  )
  // Version 4 and RFC 4122 variant digits, as the contract requires.
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][Math.floor(nextFloat(rng) * 4)] ?? '8'
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

function buildFixtures(): MatchRecord[] {
  const rng = createRng(20261002)
  const players = CAPTAINS.map((name) => ({ name, id: uuidFrom(rng) }))
  const records: MatchRecord[] = []
  for (const { sessionSeconds, spawnSeconds, count } of MATCHES_PER_CONFIG) {
    for (let i = 0; i < count; i++) {
      const player = players[i % players.length] ?? players[0]
      if (!player) continue
      const destroyed = nextFloat(rng) < 0.4
      const durationMs = destroyed
        ? Math.round(nextRange(rng, 0.3, 0.95) * sessionSeconds) * 1000
        : sessionSeconds * 1000
      const minutes = Math.floor(nextRange(rng, 0, 36 * 60))
      records.push({
        matchId: uuidFrom(rng),
        playerId: player.id,
        playerName: player.name,
        playedAt: new Date(FIRST_DATE + minutes * 60_000).toISOString(),
        score: Math.floor(nextRange(rng, 3, 40)),
        durationMs,
        endReason: destroyed ? 'playerDestroyed' : 'timeUp',
        config: { sessionSeconds, spawnSeconds },
      })
    }
  }
  return records
}

export const FIXTURE_MATCHES: readonly MatchRecord[] = buildFixtures()
