import { useEffect, useRef } from 'react'
import type { GameSnapshot } from '../engine/snapshot'

interface LoadingScreenProps {
  snapshot: GameSnapshot
  onRetry: () => void
}

/** Real load progress, or the failure with a Retry for what failed. */
export function LoadingScreen({ snapshot, onRetry }: LoadingScreenProps) {
  const retryRef = useRef<HTMLButtonElement>(null)
  const failed = snapshot.status === 'error'

  // Move focus to the only action when the error appears.
  useEffect(() => {
    if (failed) retryRef.current?.focus()
  }, [failed])

  if (failed) {
    return (
      <div className="overlay">
        <div className="overlay-panel" role="alert">
          <h2>Could not load the game</h2>
          {snapshot.canRetry ? (
            <>
              <p>
                Some game assets failed to download. Check your connection and
                try again.
              </p>
              <button
                ref={retryRef}
                type="button"
                className="menu-button menu-button--primary"
                onClick={onRetry}
              >
                Retry
              </button>
            </>
          ) : (
            <p>This browser cannot run the game: WebGL is not available.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="overlay">
      <div className="overlay-panel">
        <h2 id="loading-title">Loading the fleet…</h2>
        <progress
          max={100}
          value={snapshot.loadPercent}
          aria-labelledby="loading-title"
        />
        <p aria-hidden="true">{snapshot.loadPercent}%</p>
      </div>
    </div>
  )
}
