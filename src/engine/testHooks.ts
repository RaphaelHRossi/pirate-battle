import { seedFromString } from '../game/rng'
import type { World } from '../game/types'
import type { RendererState } from '../render/inspection'

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
  /**
   * `?perf=1` (any build, no test mode needed): record frame times and
   * offer a JSON report when the match ends.
   */
  perf: boolean
}

export interface RenderStats {
  /** Textures uploaded to the GPU by the live renderer. */
  gpuTextures: number
  /** Texture objects held in the Pixi Assets cache (shared by sessions). */
  cachedTextures: number
  /** Renderer resolution: min(devicePixelRatio, 2). */
  resolution: number
  /** Canvas size in CSS pixels and in backing-store pixels. */
  canvas: { cssWidth: number; cssHeight: number; width: number; height: number }
  /** Arena placement and per-ship drawing state. */
  renderer: RendererState | null
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
  /** Starts a new match, as the result screen's "Play again" will. */
  restart(): void
  /** GPU and cached texture counts, for the memory profiling script. */
  getRenderStats(): RenderStats
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
    perf: params.get('perf') === '1',
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
