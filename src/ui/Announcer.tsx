import { useState } from 'react'
import type { GameSnapshot } from '../engine/snapshot'
import { describeEvent } from './announcements'

/**
 * A visually hidden polite live region that speaks only events (pause,
 * resume, 30 s / 10 s left, low health, match over), never the clock
 * ticking or every hit.
 */
export function Announcer({ snapshot }: { snapshot: GameSnapshot }) {
  const [previous, setPrevious] = useState(snapshot)
  const [message, setMessage] = useState({ text: '', id: 0 })

  // Derive from the previous render's snapshot during render (React's
  // "storing information from previous renders" pattern), not in an effect.
  if (snapshot !== previous) {
    const text = describeEvent(previous, snapshot)
    setPrevious(snapshot)
    if (text) setMessage((current) => ({ text, id: current.id + 1 }))
  }

  return (
    <div className="visually-hidden" aria-live="polite" data-testid="announcer">
      {/* A new key re-inserts the node, so a repeated message is spoken again. */}
      <p key={message.id}>{message.text}</p>
    </div>
  )
}
