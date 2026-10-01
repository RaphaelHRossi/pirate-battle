import {
  keepPreviousData,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import type { MatchRecord } from './contracts'
import { getHistory, getRanking } from './endpoints'
import { useOutbox } from './outbox'
import { SAVE_MATCH_KEY, savedMatchId } from './queryClient'

export const LOG_PAGE_SIZE = 5

/**
 * One cache entry per (config, page): a response can only ever be stored
 * under the key it was requested for, so a late answer for page 2 can
 * never replace what page 3 shows.
 */
export function useRanking(configKey: string, page: number) {
  return useQuery({
    queryKey: ['ranking', configKey, page],
    // TanStack aborts the signal when the result is no longer wanted.
    queryFn: ({ signal }) =>
      getRanking({ configKey, page, pageSize: LOG_PAGE_SIZE }, signal),
    // Keep showing the previous page while the next one loads.
    placeholderData: keepPreviousData,
    // Showing the tab again refreshes it in the background.
    refetchOnMount: 'always',
  })
}

export function useHistory(playerId: string, page: number) {
  return useQuery({
    queryKey: ['history', playerId, page],
    queryFn: ({ signal }) =>
      getHistory({ playerId, page, pageSize: LOG_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  })
}

/**
 * Sends outbox records. `send` skips a record already being sent, so a
 * flush, a Retry click and a new match can never race two requests for
 * the same match (and the server would dedupe them anyway).
 */
export function useSendMatch(): (record: MatchRecord) => void {
  const client = useQueryClient()
  const { mutate } = useMutation<MatchRecord, Error, MatchRecord>({
    mutationKey: SAVE_MATCH_KEY,
  })
  return useCallback(
    (record: MatchRecord) => {
      const inFlight = client
        .getMutationCache()
        .findAll({ mutationKey: SAVE_MATCH_KEY, status: 'pending' })
        .some((mutation) => savedMatchId(mutation) === record.matchId)
      if (!inFlight) mutate(record)
    },
    [client, mutate],
  )
}

export type RegistrationStatus = 'saving' | 'saved' | 'failed'

/** Saved once the outbox no longer holds it; else the latest attempt's state. */
export function useRegistrationStatus(matchId: string): RegistrationStatus {
  const pending = useOutbox().some((record) => record.matchId === matchId)
  const attempts = useMutationState({
    filters: { mutationKey: SAVE_MATCH_KEY },
    select: (mutation) => ({
      matchId: savedMatchId(mutation),
      status: mutation.state.status,
    }),
  })
  if (!pending) return 'saved'
  const latest = attempts
    .filter((attempt) => attempt.matchId === matchId)
    .at(-1)
  return latest?.status === 'error' ? 'failed' : 'saving'
}
