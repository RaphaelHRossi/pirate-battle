import { seedFromString } from '../game/rng'
import type { World } from '../game/types'

export interface TestParams {
  /** `?test=1`: expose `window.__pirate`. */
  testMode: boolean
  /** `?seed=`: number, or any text hashed into one. */
  seed: number | null
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
  return { testMode: params.get('test') === '1', seed }
}

/** Installs the API and returns a function that removes it again. */
export function installTestHooks(api: PirateTestApi): () => void {
  window.__pirate = api
  return () => {
    // A newer session may already own the hooks (Strict Mode remount).
    if (window.__pirate === api) delete window.__pirate
  }
}
