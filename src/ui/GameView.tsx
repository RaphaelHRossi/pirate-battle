import { useEffect, useRef, useState } from 'react'
import { GameSession } from '../engine/GameSession'

export function GameView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // One session per effect run: Strict Mode's second mount gets a fresh one.
    const session = new GameSession(host)
    session.start().catch((cause: unknown) => {
      if (session.isDisposed) return
      console.error('Failed to start the game', cause)
      setError('Failed to load the game. Please reload the page.')
    })

    return () => {
      session.destroy()
    }
  }, [])

  return (
    <div ref={hostRef} className="game-host">
      {error && (
        <p role="alert" className="game-error">
          {error}
        </p>
      )}
    </div>
  )
}
