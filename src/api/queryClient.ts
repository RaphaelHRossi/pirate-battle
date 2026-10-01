import { QueryClient, type Mutation } from '@tanstack/react-query'
import type { MatchRecord } from './contracts'
import { putMatch } from './endpoints'
import { isRetryable } from './http'
import { outbox } from './outbox'

/** Retries: at most 2, and only when another attempt can succeed. */
const MAX_RETRIES = 2
const retry = (failureCount: number, error: unknown): boolean =>
  failureCount < MAX_RETRIES && isRetryable(error)
/** 500 ms, 1 s, 2 s... capped at 4 s. */
const retryDelay = (attempt: number): number =>
  Math.min(500 * 2 ** attempt, 4000)

export const SAVE_MATCH_KEY = ['saveMatch'] as const

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Fresh for 30 s: revisiting a page within that time shows it from
        // the cache without asking the server again.
        staleTime: 30_000,
        retry,
        retryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: { retry, retryDelay },
    },
  })

  // Registering a match is defined once on the client, not in a component:
  // a save keeps running (and its onSuccess still runs) when the screen
  // that started it unmounts, e.g. the player starts another match.
  client.setMutationDefaults(SAVE_MATCH_KEY, {
    mutationFn: (record: MatchRecord) => putMatch(record),
    onSuccess: (_saved: MatchRecord, record: MatchRecord) => {
      // Confirmed by the server: only now may it leave the outbox.
      outbox.remove(record.matchId)
      void client.invalidateQueries({ queryKey: ['ranking'] })
      void client.invalidateQueries({ queryKey: ['history'] })
    },
  })
  return client
}

/** The matchId a saveMatch mutation is sending, if any. */
export function savedMatchId(mutation: Mutation): string | null {
  const variables = mutation.state.variables
  if (
    typeof variables === 'object' &&
    variables !== null &&
    'matchId' in variables &&
    typeof variables.matchId === 'string'
  ) {
    return variables.matchId
  }
  return null
}
