import type { EndReason } from '../api/contracts'

// en-US gives three-letter months ("Sep"); en-GB would give "Sept".
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "08 SEP" and "21:42", in the player's local time zone. */
export function formatPlayedAt(iso: string): { date: string; time: string } {
  const when = new Date(iso)
  const day = String(when.getDate()).padStart(2, '0')
  const month = MONTH.format(when).toUpperCase()
  return { date: `${day} ${month}`, time: TIME.format(when) }
}

export const END_REASON_LABEL: Record<EndReason, string> = {
  timeUp: 'Time up',
  playerDestroyed: 'Ship destroyed',
}

/** 1 → "01", as on the sample ranking. */
export function formatRank(rank: number): string {
  return String(rank).padStart(2, '0')
}
