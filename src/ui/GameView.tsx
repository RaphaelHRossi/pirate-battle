import { useEffect, useRef } from 'react'
import { navigate } from '../app/router'
import type { SessionOptions } from '../engine/GameSession'
import { TouchControls } from '../input/TouchControls'
import { saveLastResult } from '../storage/lastResult'
import { loadOptions } from '../storage/options'
import { Announcer } from './Announcer'
import { Hud } from './Hud'
import { LoadingScreen } from './LoadingScreen'
import { PauseDialog } from './PauseDialog'
import { useGameSession } from './useGameSession'

/**
 * Every match reads the saved options when it starts, and a completed
 * match saves its result the moment it ends. Nothing else is saved: an
 * abandoned match (refresh, Back, Main Menu) leaves no trace.
 */
const SESSION_OPTIONS: SessionOptions = {
  matchOptions: loadOptions,
  onMatchEnd: saveLastResult,
}

/**
 * The match screen: the Pixi canvas host plus React overlays. The canvas
 * host has no React children, because Pixi appends its canvas there.
 * Unmounting it (leaving #/play) destroys the session and its match.
 */
export function GameView() {
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const renderCount = useRef(0)
  const { snapshot, controls } = useGameSession(hostRef, SESSION_OPTIONS)
  const { status, resultReady } = snapshot
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

  useEffect(() => {
    document.title = 'Battle · Pirate Battle'
  }, [])

  // The result is already saved; once the end has played out, show it.
  // Replace, so Back from the result does not start another match.
  useEffect(() => {
    if (resultReady) navigate({ name: 'result' }, { replace: true })
  }, [resultReady])

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
      {(status === 'running' || status === 'paused') && (
        <TouchControls input={controls} />
      )}
      <PauseDialog
        open={status === 'paused'}
        onResume={() => {
          controls.resume()
        }}
        onMainMenu={() => {
          navigate({ name: 'menu' })
        }}
      />
      <Announcer snapshot={snapshot} />
      {import.meta.env.DEV && (
        <span ref={badgeRef} className="render-counter" aria-hidden="true" />
      )}
    </div>
  )
}
