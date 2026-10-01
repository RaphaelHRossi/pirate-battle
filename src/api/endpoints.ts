import type { z } from 'zod'
import {
  historyPageSchema,
  matchRecordSchema,
  rankingPageSchema,
  type MatchRecord,
  type Page,
  type RankingEntry,
} from './contracts'
import { ApiError, http } from './http'

/** Responses are validated too: a contract mismatch is an error, not data. */
function parse<T>(schema: z.ZodType<T>, data: unknown, status: number): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw new ApiError('http', status, 'The server sent an unexpected answer.')
  }
  return parsed.data
}

export async function getRanking(
  params: { configKey: string; page: number; pageSize: number },
  signal?: AbortSignal,
): Promise<Page<RankingEntry>> {
  const response = await http.get<unknown>('/ranking', { params, signal })
  return parse(rankingPageSchema, response.data, response.status)
}

export async function getHistory(
  { playerId, ...params }: { playerId: string; page: number; pageSize: number },
  signal?: AbortSignal,
): Promise<Page<MatchRecord>> {
  const response = await http.get<unknown>(
    `/players/${encodeURIComponent(playerId)}/matches`,
    { params, signal },
  )
  return parse(historyPageSchema, response.data, response.status)
}

/**
 * Idempotent upsert keyed by the client's matchId: 201 when created, 200
 * when that exact record already exists. Safe to repeat after a timeout.
 */
export async function putMatch(record: MatchRecord): Promise<MatchRecord> {
  const response = await http.put<unknown>(
    `/matches/${encodeURIComponent(record.matchId)}`,
    record,
  )
  return parse(matchRecordSchema, response.data, response.status)
}
