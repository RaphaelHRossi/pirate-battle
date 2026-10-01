import { useEffect, useRef } from 'react'
import { Announcer } from './Announcer'
import { Hud } from './Hud'
import { LoadingScreen } from './LoadingScreen'
import { PauseDialog } from './PauseDialog'
import { useGameSession } from './useGameSession'

/**
 * The match screen: the Pixi canvas host plus React overlays. The canvas
 * host has no React children, because Pixi appends its canvas there.
 */
export function GameView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const renderCount = useRef(0)
  const { snapshot, controls } = useGameSession(hostRef)
  const { status } = snapshot
  const inMatch =
    status === 'running' || status === 'paused' || status === 'ended'

  // Render counter: proves React renders only on snapshot changes. It runs
  // after every render and writes to the DOM directly, so counting never
  // causes a render itself. Visible in dev; tests read the data attribute.
  useEffect(() => {
    renderCount.current += 1
    const count = String(renderCount.current)
    rootRef.current?.setAttribute('data-render-count', count)
    if (badgeRef.current) badgeRef.current.textContent = `renders: ${count}`
  })

  return (
    <div ref={rootRef} className="game-screen">
      <div ref={hostRef} className="game-host" />
      {inMatch ? (
        <Hud
          snapshot={snapshot}
          onPause={() => {
            controls.pause()
          }}
        />
      ) : (
        <LoadingScreen
          snapshot={snapshot}
          onRetry={() => {
            controls.retry()
          }}
        />
      )}
      <PauseDialog
        open={status === 'paused'}
        onResume={() => {
          controls.resume()
        }}
      />
      <Announcer snapshot={snapshot} />
      {import.meta.env.DEV && (
        <span ref={badgeRef} className="render-counter" aria-hidden="true" />
      )}
    </div>
  )
}
