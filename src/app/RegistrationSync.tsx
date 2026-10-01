import { useEffect } from 'react'
import { outbox, useOutbox } from '../api/outbox'
import { useSendMatch } from '../api/queries'

/**
 * Always mounted. Sends every pending outbox record: on app start (a
 * refresh or a crash left some), whenever a match adds one, and each time
 * the player returns to the main menu (a natural moment to try again).
 * Renders nothing and never blocks the game.
 */
export function RegistrationSync({ onMenu }: { onMenu: boolean }) {
  const pending = useOutbox()
  const send = useSendMatch()

  useEffect(() => {
    for (const record of pending) send(record)
  }, [pending, send])

  useEffect(() => {
    if (!onMenu) return
    // Read the store directly: this effect runs on navigation only, while
    // outbox changes are handled by the effect above.
    for (const record of outbox.getSnapshot()) send(record)
  }, [onMenu, send])

  return null
}
