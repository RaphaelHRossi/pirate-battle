import { z } from 'zod'
import { createUuid } from '../engine/matchResult'
import { seedFromString } from '../game/rng'
import { readStored, writeStored } from './local'

const KEY = 'player'

const NAMES = [
  'Jack',
  'Morgan',
  'Kidd',
  'Teach',
  'Drake',
  'Rackham',
  'Vane',
  'Avery',
] as const

const playerSchema = z.object({
  version: z.literal(1),
  playerId: z.uuid(),
  name: z.string().min(1).max(40),
})

export interface Player {
  playerId: string
  name: string
}

let cached: Player | null = null

/**
 * This browser's player: a random UUID created on first use and kept in
 * localStorage, with a captain name derived from it. It identifies the
 * player's matches in the ranking and the history.
 */
export function getPlayer(): Player {
  if (cached) return cached
  const stored = readStored(KEY, playerSchema)
  if (stored) {
    cached = { playerId: stored.playerId, name: stored.name }
    return cached
  }
  const playerId = createUuid()
  const name = `Captain ${NAMES[seedFromString(playerId) % NAMES.length] ?? 'Jack'}`
  cached = { playerId, name }
  writeStored(KEY, { version: 1, ...cached })
  return cached
}
