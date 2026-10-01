import { z } from 'zod'
import { readStored, removeStored, writeStored } from './local'

const KEY = 'last-result'

/**
 * A completed match, as shown on the result screen (and, later, sent to
 * the API). Abandoned matches never produce one.
 */
export const matchResultSchema = z.object({
  /** Client-generated UUID, created when the match ends. */
  matchId: z.uuid(),
  score: z.int().nonnegative(),
  /** Simulated time played, in whole milliseconds. */
  durationMs: z.int().nonnegative(),
  endReason: z.enum(['timeUp', 'playerDestroyed']),
  /** ISO 8601 timestamp of the end of the match. */
  playedAt: z.iso.datetime(),
  /** The options the match was played with. */
  sessionSeconds: z.number().positive(),
  spawnSeconds: z.number().positive(),
})

export type MatchResult = z.infer<typeof matchResultSchema>

const storedResultSchema = z.object({
  version: z.literal(1),
  result: matchResultSchema,
})

export function loadLastResult(): MatchResult | null {
  return readStored(KEY, storedResultSchema)?.result ?? null
}

export function saveLastResult(result: MatchResult): void {
  writeStored(KEY, { version: 1, result })
}

export function clearLastResult(): void {
  removeStored(KEY)
}
