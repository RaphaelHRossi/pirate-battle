import { useState } from 'react'
import { outbox } from '../api/outbox'
import { navigate } from '../app/router'
import { mockDb } from '../mocks/db'
import {
  clearScenario,
  currentScenario,
  SCENARIO_NAMES,
  SCENARIOS,
  setScenario,
  type ScenarioName,
} from '../mocks/scenarios'
import { clearLastResult } from '../storage/lastResult'
import { MenuScreen } from './MenuScreen'

/**
 * Picks the mock server's simulated network (applied to the next request)
 * and resets the demo to a clean state.
 */
export function NetworkPanel() {
  const [selected, setSelected] = useState<ScenarioName>(currentScenario)

  const reset = (): void => {
    mockDb.clear()
    outbox.clear()
    clearLastResult()
    clearScenario()
    // Reload so in-memory state (query cache, pending saves, scenario
    // counters) starts over too. Drop ?scenario= or it would be re-applied.
    const url = new URL(window.location.href)
    url.searchParams.delete('scenario')
    url.searchParams.delete('netSeed')
    url.hash = '#/'
    if (url.search === window.location.search) {
      // Only the hash differs: replace() alone would not reload the page.
      window.history.replaceState(null, '', url)
      window.location.reload()
    } else {
      window.location.replace(url.href)
    }
  }

  return (
    <MenuScreen title="Network" heading="Network" className="panel--wide">
      <fieldset className="scenario-list">
        <legend>Simulated network (mock server)</legend>
        {SCENARIO_NAMES.map((name) => (
          <div key={name} className="scenario-option">
            <input
              type="radio"
              id={`scenario-${name}`}
              name="scenario"
              value={name}
              checked={selected === name}
              aria-describedby={`scenario-${name}-description`}
              onChange={() => {
                setScenario(name)
                setSelected(name)
              }}
            />
            <label htmlFor={`scenario-${name}`} className="scenario-name">
              {name}
            </label>
            <span
              id={`scenario-${name}-description`}
              className="scenario-description"
            >
              {SCENARIOS[name]}
            </span>
          </div>
        ))}
      </fieldset>
      <p className="panel-note">
        Reset deletes recorded matches, pending saves, the last result and the
        scenario. Options are kept.
      </p>
      <div className="menu-actions menu-actions--row">
        <button type="button" className="menu-button" onClick={reset}>
          Reset
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
    </MenuScreen>
  )
}
