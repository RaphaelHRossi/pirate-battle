import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  CONFIG_KEY_PATTERN,
  compareRanking,
  configKey,
  matchRecordSchema,
  pageQuerySchema,
  type MatchRecord,
  type Page,
  type RankingEntry,
} from '../api/contracts'
import { mockDb } from './db'
import { FIXTURE_MATCHES } from './fixtures'
import { applyScenario, currentScenario } from './scenarios'

function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
  }
}

function badRequest(message: string): Response {
  return HttpResponse.json({ error: message }, { status: 400 })
}

const rankingQuerySchema = pageQuerySchema.extend({
  configKey: z.string().regex(CONFIG_KEY_PATTERN),
})

function query(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams)
}

/** Same fields, same values, regardless of key order. */
function sameRecord(a: MatchRecord, b: MatchRecord): boolean {
  const canonical = (record: MatchRecord): string =>
    JSON.stringify(matchRecordSchema.parse(record), (_key, value: unknown) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).sort(([x], [y]) => (x < y ? -1 : 1)),
          )
        : value,
    )
  return canonical(a) === canonical(b)
}

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),

  /** One entry per match of the same config, best first. */
  http.get('/api/ranking', async ({ request }) => {
    const simulated = await applyScenario('ranking')
    if (simulated) return simulated
    const params = rankingQuerySchema.safeParse(query(request))
    if (!params.success) return badRequest('Invalid ranking query')
    const { configKey: key, page, pageSize } = params.data

    const matches =
      currentScenario() === 'empty'
        ? []
        : [...FIXTURE_MATCHES, ...mockDb.all()]
            .filter((record) => configKey(record.config) === key)
            .sort(compareRanking)
    const entries: RankingEntry[] = matches.map((record, index) => ({
      rank: index + 1,
      matchId: record.matchId,
      playerId: record.playerId,
      playerName: record.playerName,
      score: record.score,
      durationMs: record.durationMs,
      playedAt: record.playedAt,
    }))
    return HttpResponse.json(paginate(entries, page, pageSize))
  }),

  /** The player's own matches, newest first. */
  http.get('/api/players/:playerId/matches', async ({ request, params }) => {
    const simulated = await applyScenario('history')
    if (simulated) return simulated
    const paging = pageQuerySchema.safeParse(query(request))
    if (!paging.success) return badRequest('Invalid history query')
    const { page, pageSize } = paging.data
    const { playerId } = params

    const matches =
      currentScenario() === 'empty'
        ? []
        : mockDb
            .all()
            .filter((record) => record.playerId === playerId)
            .sort((a, b) =>
              a.playedAt === b.playedAt ? 0 : a.playedAt < b.playedAt ? 1 : -1,
            )
    return HttpResponse.json(paginate(matches, page, pageSize))
  }),

  /**
   * Idempotent upsert keyed by the client's matchId. Repeating the same
   * PUT (a retry after a timeout, a double click) returns the existing
   * record instead of creating a second one.
   */
  http.put('/api/matches/:matchId', async ({ request, params }) => {
    const simulated = await applyScenario('save')
    if (simulated) return simulated
    const body = matchRecordSchema.safeParse(await request.json())
    if (!body.success) return badRequest('Invalid match record')
    const record = body.data
    if (record.matchId !== params.matchId) {
      return badRequest('matchId in the path and body differ')
    }

    const existing = mockDb.get(record.matchId)
    if (existing) {
      if (!sameRecord(existing, record)) {
        return HttpResponse.json(
          { error: 'A different match already uses this id' },
          { status: 409 },
        )
      }
      return HttpResponse.json(existing, { status: 200 })
    }

    mockDb.insert(record)
    if (currentScenario() === 'save-timeout-after-commit') {
      // Committed, but the answer is lost: the client times out and will
      // retry. The retry finds the record and gets 200, not a duplicate.
      await delay('infinite')
    }
    return HttpResponse.json(record, { status: 201 })
  }),
]
