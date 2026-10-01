import { useState } from 'react'
import { outbox } from '../api/outbox'
import { useRegistrationStatus, useSendMatch } from '../api/queries'
import { navigate } from '../app/router'
import { loadLastResult, type MatchResult } from '../storage/lastResult'
import { formatTime } from './format'
import { MenuScreen } from './MenuScreen'

const END_REASON_LABEL: Record<MatchResult['endReason'], string> = {
  timeUp: 'Time up',
  playerDestroyed: 'Ship destroyed',
}

const REGISTRATION_LABEL = {
  saving: 'Saving…',
  saved: 'Saved',
  failed: 'Not saved',
} as const

/**
 * Whether the server has this match yet. The record waits in the outbox
 * until it has, so "Not saved" is never final: Retry sends it now, and it
 * is also sent again on the next app start or visit to the main menu.
 */
function Registration({ matchId }: { matchId: string }) {
  const status = useRegistrationStatus(matchId)
  const send = useSendMatch()
  return (
    <span className="registration">
      <span role="status" data-testid="result-registration">
        {REGISTRATION_LABEL[status]}
      </span>
      {status === 'failed' && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            const record = outbox
              .getSnapshot()
              .find((pending) => pending.matchId === matchId)
            if (record) send(record)
          }}
        >
          Retry
        </button>
      )}
    </span>
  )
}

function Actions() {
  return (
    <div className="menu-actions">
      <button
        type="button"
        className="menu-button"
        onClick={() => {
          navigate({ name: 'play' })
        }}
      >
        Play Again
      </button>
      <button
        type="button"
        className="menu-button"
        onClick={() => {
          navigate({ name: 'menu' })
        }}
      >
        Main Menu
      </button>
    </div>
  )
}

/**
 * The last completed match, read from localStorage, so the screen
 * survives a refresh. Abandoned matches are never saved, so they never
 * show up here.
 */
export function ResultScreen() {
  // Read once on mount: a result only changes by finishing another match.
  const [result] = useState(loadLastResult)

  if (!result) {
    return (
      <MenuScreen title="Result" heading="No battle yet">
        <p className="panel-note">
          Finish a match and its result will be waiting for you here.
        </p>
        <Actions />
      </MenuScreen>
    )
  }

  const reason = END_REASON_LABEL[result.endReason]
  return (
    <MenuScreen
      title="Result"
      heading={
        result.endReason === 'timeUp' ? 'Battle complete' : 'Ship destroyed'
      }
    >
      <p className="result-score">
        <span data-testid="result-score">{result.score}</span>
        <span className="result-score-label">points</span>
      </p>
      <dl className="result-details">
        <div>
          <dt>Time played</dt>
          <dd data-testid="result-time">
            {formatTime(Math.floor(result.durationMs / 1000))}
          </dd>
        </div>
        <div>
          <dt>End reason</dt>
          <dd data-testid="result-reason">{reason}</dd>
        </div>
        <div>
          <dt>Registration</dt>
          <dd>
            <Registration matchId={result.matchId} />
          </dd>
        </div>
      </dl>
      <Actions />
    </MenuScreen>
  )
}
