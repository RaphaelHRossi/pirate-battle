import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { outbox, useOutbox } from '../api/outbox'
import { useSendMatch } from '../api/queries'
import { SAVE_MATCH_KEY, savedMatchId } from '../api/queryClient'

/**
 * Always mounted. Sends every pending outbox record: on app start (a
 * refresh or a crash left some), whenever a match adds one, and each time
 * the player returns to the main menu (a natural moment to try again).
 * Renders nothing and never blocks the game.
 */
export function RegistrationSync({ onMenu }: { onMenu: boolean }) {
  const pending = useOutbox()
  const send = useSendMatch()
  const client = useQueryClient()

  useEffect(() => {
    for (const record of pending) send(record)
  }, [pending, send])

  useEffect(() => {
    if (!onMenu) return
    // Read the store directly: this effect runs on navigation only, while
    // outbox changes are handled by the effect above.
    const deferred = new Set<string>()
    for (const record of outbox.getSnapshot()) {
      if (!send(record)) deferred.add(record.matchId)
    }
    if (deferred.size === 0) return
    // A save already in flight was skipped. If that attempt was sent before
    // the server recovered it can still fail; give it one more try then,
    // instead of waiting for the next app start or menu visit.
    return client.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return
      if (!event.mutation.options.mutationKey) return
      if (event.mutation.options.mutationKey[0] !== SAVE_MATCH_KEY[0]) return
      const matchId = savedMatchId(event.mutation)
      if (!matchId || !deferred.delete(matchId)) return
      const record = outbox
        .getSnapshot()
        .find((candidate) => candidate.matchId === matchId)
      if (record) send(record)
    })
  }, [onMenu, send, client])

  return null
}
