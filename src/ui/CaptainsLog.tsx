import { useRef, useState, type KeyboardEvent } from 'react'
import {
  configKey,
  type MatchRecord,
  type RankingEntry,
} from '../api/contracts'
import { useHistory, useRanking } from '../api/queries'
import { navigate, type LogTab } from '../app/router'
import { loadOptions } from '../storage/options'
import { getPlayer } from '../storage/player'
import { formatTime } from './format'
import { END_REASON_LABEL, formatPlayedAt, formatRank } from './logFormat'
import { LogTable, type Column } from './LogTable'
import { MenuScreen } from './MenuScreen'
import { uiImage } from './uiAssets'

const TABS: readonly { tab: LogTab; label: string }[] = [
  { tab: 'ranking', label: 'Ranking' },
  { tab: 'history', label: 'Match History' },
]

function PlayedAt({ iso }: { iso: string }) {
  const { date, time } = formatPlayedAt(iso)
  return (
    <time dateTime={iso}>
      <span className="log-date">{date}</span> · {time}
    </time>
  )
}

function RankingTab() {
  const { playerId } = getPlayer()
  // The ranking compares like with like: the config of the next match.
  const [options] = useState(loadOptions)
  const [page, setPage] = useState(1)
  const query = useRanking(configKey(options), page)

  const columns: readonly Column<RankingEntry>[] = [
    {
      header: 'Rank',
      className: 'log-rank',
      cell: (row) => formatRank(row.rank),
    },
    {
      header: 'Captain',
      cell: (row) => (
        <span className="log-captain">
          {row.rank === 1 && (
            <img className="log-star" src={uiImage('hud/icon_score')} alt="" />
          )}
          {row.playerName}
          {row.playerId === playerId && (
            <span className="you-badge">
              You<span className="visually-hidden"> (your match)</span>
            </span>
          )}
        </span>
      ),
    },
    { header: 'Points', className: 'log-points', cell: (row) => row.score },
    { header: 'Played', cell: (row) => <PlayedAt iso={row.playedAt} /> },
  ]

  return (
    <>
      <p className="log-subtitle" data-testid="ranking-config">
        {options.sessionSeconds} second battles · {options.spawnSeconds} second
        spawn interval
      </p>
      <LogTable
        query={query}
        caption="Ranking"
        columns={columns}
        rowKey={(row) => row.matchId}
        isMine={(row) => row.playerId === playerId}
        emptyText="No battles recorded with these settings yet. Be the first!"
        page={page}
        onPage={setPage}
      />
    </>
  )
}

function HistoryTab() {
  const { playerId, name } = getPlayer()
  const [page, setPage] = useState(1)
  const query = useHistory(playerId, page)

  const columns: readonly Column<MatchRecord>[] = [
    { header: 'Date', cell: (row) => <PlayedAt iso={row.playedAt} /> },
    { header: 'Points', className: 'log-points', cell: (row) => row.score },
    {
      header: 'Duration',
      cell: (row) => formatTime(Math.floor(row.durationMs / 1000)),
    },
    {
      header: 'Result',
      cell: (row) => (
        <span className={`log-reason log-reason--${row.endReason}`}>
          {END_REASON_LABEL[row.endReason]}
        </span>
      ),
    },
  ]

  return (
    <>
      <p className="log-subtitle">{name} · Your recent battles</p>
      <LogTable
        query={query}
        caption="Match history"
        columns={columns}
        rowKey={(row) => row.matchId}
        emptyText="No battles yet. Your finished matches will appear here."
        page={page}
        onPage={setPage}
      />
    </>
  )
}

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
      className="panel--log"
    >
      <div
        className="tabs"
        role="tablist"
        aria-label="Captain's log"
        onKeyDown={onKeyDown}
      >
        {TABS.map((entry) => {
          const selected = entry.tab === tab
          return (
            <button
              key={entry.tab}
              ref={(element) => {
                if (element) tabRefs.current.set(entry.tab, element)
                else tabRefs.current.delete(entry.tab)
              }}
              type="button"
              role="tab"
              id={`tab-${entry.tab}`}
              className={
                selected ? 'menu-button' : 'menu-button menu-button--secondary'
              }
              aria-selected={selected}
              aria-controls={`panel-${entry.tab}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                select(entry.tab)
              }}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
      <div
        className="tab-panel"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {/* Keyed: switching tabs starts the other one on its first page. */}
        {tab === 'ranking' ? (
          <RankingTab key="ranking" />
        ) : (
          <HistoryTab key="history" />
        )}
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
