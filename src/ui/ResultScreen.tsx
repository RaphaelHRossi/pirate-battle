import { useState } from 'react'
import { navigate } from '../app/router'
import { loadLastResult, type MatchResult } from '../storage/lastResult'
import { formatTime } from './format'
import { MenuScreen } from './MenuScreen'

const END_REASON_LABEL: Record<MatchResult['endReason'], string> = {
  timeUp: 'Time up',
  playerDestroyed: 'Ship destroyed',
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
          {/* Placeholder until results are sent to the ranking API. */}
          <dd data-testid="result-registration">
            Not sent yet: online ranking coming soon
          </dd>
        </div>
      </dl>
      <Actions />
    </MenuScreen>
  )
}
