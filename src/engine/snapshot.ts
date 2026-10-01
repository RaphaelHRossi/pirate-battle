import type { EndReason } from '../game/types'

export type SessionStatus = 'loading' | 'error' | 'running' | 'paused' | 'ended'

/**
 * What React shows about the session. Every field changes rarely (on load
 * progress, a hit, a kill, once per second, or a status change), so a new
 * object is only created when one of them actually changes: React's
 * useSyncExternalStore compares by reference and re-renders only then.
 */
export interface GameSnapshot {
  readonly status: SessionStatus
  /** 0..100 while loading. */
  readonly loadPercent: number
  /** False when the failure cannot be fixed by retrying (e.g. no WebGL). */
  readonly canRetry: boolean
  readonly hp: number
  readonly maxHp: number
  readonly score: number
  /** Whole seconds left, rounded up: 119.2 s shows as 120. */
  readonly secondsLeft: number
  readonly endReason: EndReason | null
  /**
   * The match has ended and its final moments have played out: time to
   * show the result screen.
   */
  readonly resultReady: boolean
}

export const INITIAL_SNAPSHOT: GameSnapshot = Object.freeze({
  status: 'loading',
  loadPercent: 0,
  canRetry: true,
  hp: 0,
  maxHp: 0,
  score: 0,
  secondsLeft: 0,
  endReason: null,
  resultReady: false,
})

export function sameSnapshot(a: GameSnapshot, b: GameSnapshot): boolean {
  return (
    a.status === b.status &&
    a.loadPercent === b.loadPercent &&
    a.canRetry === b.canRetry &&
    a.hp === b.hp &&
    a.maxHp === b.maxHp &&
    a.score === b.score &&
    a.secondsLeft === b.secondsLeft &&
    a.endReason === b.endReason &&
    a.resultReady === b.resultReady
  )
}
