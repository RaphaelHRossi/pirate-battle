import { useSyncExternalStore } from 'react'

/**
 * A tiny hash router. The screen lives in the URL fragment (`#/options`),
 * so a refresh reopens the same screen, Back/Forward work, and the static
 * host needs no rewrite rules. The query string (`?test=1&seed=…`) is
 * separate from the fragment, so test parameters survive navigation.
 */

export type LogTab = 'ranking' | 'history'

export type Route =
  | { name: 'menu' }
  | { name: 'options' }
  | { name: 'play' }
  | { name: 'result' }
  | { name: 'log'; tab: LogTab }

/** `#/log` opens the Ranking tab; `#/log/history` the Match History tab. */
export function parseRoute(hash: string): Route | null {
  const path = hash.replace(/^#/, '') || '/'
  switch (path) {
    case '/':
      return { name: 'menu' }
    case '/options':
      return { name: 'options' }
    case '/play':
      return { name: 'play' }
    case '/result':
      return { name: 'result' }
    case '/log':
    case '/log/ranking':
      return { name: 'log', tab: 'ranking' }
    case '/log/history':
      return { name: 'log', tab: 'history' }
    default:
      return null
  }
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'menu':
      return '#/'
    case 'log':
      return route.tab === 'ranking' ? '#/log' : '#/log/history'
    default:
      return `#/${route.name}`
  }
}

/**
 * Goes to `route`. `replace` swaps the current history entry instead of
 * adding one, e.g. ending a match: Back from the result screen should not
 * land on #/play and start another match.
 */
export function navigate(route: Route, { replace = false } = {}): void {
  const hash = routeHash(route)
  if (window.location.hash === hash) return
  if (replace) window.location.replace(hash)
  else window.location.hash = hash
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
  }
}

// The snapshot is the raw string: strings compare by value, so React sees
// "no change" until the hash really changes (a parsed object would be new
// on every call and loop forever).
const getHash = (): string => window.location.hash

/** The current hash; parse it with `parseRoute`. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, getHash)
}
