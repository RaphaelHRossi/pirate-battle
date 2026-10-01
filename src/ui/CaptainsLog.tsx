import { useRef, type KeyboardEvent } from 'react'
import { navigate, type LogTab } from '../app/router'
import { MenuScreen } from './MenuScreen'

const TABS: readonly { tab: LogTab; label: string }[] = [
  { tab: 'ranking', label: 'Ranking' },
  { tab: 'history', label: 'Match History' },
]

/**
 * Ranking and Match History as ARIA tabs. The selected tab is part of the
 * URL (#/log, #/log/history), so a refresh keeps it. Arrow keys, Home and
 * End move between tabs (roving tabindex: only the selected one is in
 * the Tab order).
 */
export function CaptainsLog({ tab }: { tab: LogTab }) {
  const tabRefs = useRef(new Map<LogTab, HTMLButtonElement>())

  const select = (next: LogTab): void => {
    navigate({ name: 'log', tab: next }, { replace: true })
    tabRefs.current.get(next)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = TABS.findIndex((entry) => entry.tab === tab)
    const last = TABS.length - 1
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    const next = target === undefined ? undefined : TABS[target]
    if (!next) return
    event.preventDefault()
    select(next.tab)
  }

  return (
    <MenuScreen
      title="Captain's log"
      heading="Captain's Log"
      className="panel--wide"
    >
      <div
        className="tabs"
        role="tablist"
        aria-label="Captain's log"
        onKeyDown={onKeyDown}
      >
        {TABS.map((entry) => (
          <button
            key={entry.tab}
            ref={(element) => {
              if (element) tabRefs.current.set(entry.tab, element)
              else tabRefs.current.delete(entry.tab)
            }}
            type="button"
            role="tab"
            id={`tab-${entry.tab}`}
            className="tab"
            aria-selected={entry.tab === tab}
            aria-controls={`panel-${entry.tab}`}
            tabIndex={entry.tab === tab ? 0 : -1}
            onClick={() => {
              select(entry.tab)
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        <p className="panel-note">
          {tab === 'ranking'
            ? 'The fleet ranking is on its way. Check back soon.'
            : 'Your match history is on its way. Check back soon.'}
        </p>
      </div>
      <div className="menu-actions">
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
