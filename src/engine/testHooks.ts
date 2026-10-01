import { seedFromString } from '../game/rng'
import type { World } from '../game/types'

export interface TestParams {
  /** `?test=1`: expose `window.__pirate`. */
  testMode: boolean
  /** `?seed=`: number, or any text hashed into one. */
  seed: number | null
  /** `?fixture=`: named start state (test mode only). */
  fixture: string | null
  /** `?debug=1`: draw colliders and hull circles. */
  debug: boolean
  /**
   * `?clock=manual` (test mode only): start with the clock paused, so not a
   * single real frame runs before the test takes control with `advance`.
   */
  manualClock: boolean
  /** `?spawn=off` (test mode only): no enemies spawn on their own. */
  spawnOff: boolean
}

export interface TestStateSnapshot {
  /** Paused by the player (P/Escape), not by `pauseClock()`. */
  paused: boolean
  world: World
}

export interface PirateTestApi {
  /** A deep copy: mutating it never affects the running game. */
  getState(): TestStateSnapshot
  /** Stops real time from driving the game; only `advance` steps it. */
  pauseClock(): void
  resumeClock(): void
  /** Runs `ms` of game time through the real step + render path. */
  advance(ms: number): void
}

declare global {
  interface Window {
    __pirate?: PirateTestApi
  }
}

export function readTestParams(search: string): TestParams {
  const params = new URLSearchParams(search)
  const rawSeed = params.get('seed')
  let seed: number | null = null
  if (rawSeed !== null && rawSeed !== '') {
    seed = /^\d+$/.test(rawSeed)
      ? Number(rawSeed) >>> 0
      : seedFromString(rawSeed)
  }
  return {
    testMode: params.get('test') === '1',
    seed,
    fixture: params.get('fixture') || null,
    debug: params.get('debug') === '1',
    manualClock: params.get('clock') === 'manual',
    spawnOff: params.get('spawn') === 'off',
  }
}

/** Installs the API and returns a function that removes it again. */
export function installTestHooks(api: PirateTestApi): () => void {
  window.__pirate = api
  return () => {
    // A newer session may already own the hooks (Strict Mode remount).
    if (window.__pirate === api) delete window.__pirate
  }
}
