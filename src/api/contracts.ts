import { z } from 'zod'

/**
 * The API's data shapes, shared by the app (which validates every
 * response) and the MSW handlers (which validate every request). One
 * definition means the client and the mock server cannot drift apart.
 */

export const endReasonSchema = z.enum(['timeUp', 'playerDestroyed'])
export type EndReason = z.infer<typeof endReasonSchema>

/** The options a match was played with; the ranking compares like with like. */
export const matchConfigSchema = z.object({
  sessionSeconds: z.number().positive(),
  spawnSeconds: z.number().positive(),
})
export type MatchConfig = z.infer<typeof matchConfigSchema>

/** `120s-3s`: the ranking is filtered by this key. */
export function configKey({
  sessionSeconds,
  spawnSeconds,
}: MatchConfig): string {
  return `${String(sessionSeconds)}s-${String(spawnSeconds)}s`
}

export const CONFIG_KEY_PATTERN = /^\d+(\.\d+)?s-\d+(\.\d+)?s$/

/** One completed match: a single history row and a single ranking entry. */
export const matchRecordSchema = z.object({
  /** Client-generated UUID: the idempotency key of PUT /api/matches/:id. */
  matchId: z.uuid(),
  playerId: z.uuid(),
  playerName: z.string().min(1).max(40),
  /** ISO 8601 time the match ended. */
  playedAt: z.iso.datetime(),
  score: z.int().nonnegative(),
  /** Time actually played, in whole milliseconds. */
  durationMs: z.int().nonnegative(),
  endReason: endReasonSchema,
  config: matchConfigSchema,
})
export type MatchRecord = z.infer<typeof matchRecordSchema>

export const rankingEntrySchema = z.object({
  /** 1-based position among all matches of the same config. */
  rank: z.int().positive(),
  matchId: z.uuid(),
  playerId: z.uuid(),
  playerName: z.string(),
  score: z.int().nonnegative(),
  durationMs: z.int().nonnegative(),
  playedAt: z.iso.datetime(),
})
export type RankingEntry = z.infer<typeof rankingEntrySchema>

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    /** 1-based. */
    page: z.int().positive(),
    pageSize: z.int().positive(),
    totalItems: z.int().nonnegative(),
    /** At least 1, even when there are no items. */
    totalPages: z.int().positive(),
  })
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export const rankingPageSchema = pageSchema(rankingEntrySchema)
export const historyPageSchema = pageSchema(matchRecordSchema)

/** Query string of both list endpoints. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
})

type Ranked = Pick<MatchRecord, 'score' | 'durationMs' | 'playedAt' | 'matchId'>

/**
 * Deterministic ranking order: score desc, then the longer survival, then
 * whoever got there first, and finally the match id so no two entries
 * ever tie. (ISO timestamps in UTC compare correctly as strings.)
 */
export function compareRanking(a: Ranked, b: Ranked): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.durationMs !== b.durationMs) return b.durationMs - a.durationMs
  if (a.playedAt !== b.playedAt) return a.playedAt < b.playedAt ? -1 : 1
  if (a.matchId === b.matchId) return 0
  return a.matchId < b.matchId ? -1 : 1
}
