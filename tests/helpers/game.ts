import type { Page } from '@playwright/test'
import type { RenderStats, TestStateSnapshot } from '../../src/engine/testHooks'
import type { Projectile } from '../../src/game/types'
import { expect } from './test'

/**
 * Opens the game in test mode with a fixed seed (and optional fixture) and
 * a manual clock: real time never moves the simulation, only `advance()`.
 * Enemies only spawn on their own when `spawn: true`, so each test decides
 * exactly which ships exist.
 */
export async function openGame(
  page: Page,
  {
    seed = 1,
    fixture,
    spawn = false,
    scenario,
  }: {
    seed?: number
    fixture?: string
    spawn?: boolean
    /** Mock network scenario (src/mocks/scenarios.ts). */
    scenario?: string
  } = {},
): Promise<void> {
  const params = new URLSearchParams({
    test: '1',
    clock: 'manual',
    seed: String(seed),
  })
  if (fixture) params.set('fixture', fixture)
  if (!spawn) params.set('spawn', 'off')
  if (scenario) params.set('scenario', scenario)
  await page.goto(`/?${params.toString()}#/play`)
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  // Every test starts from the untouched initial state.
  expect((await getState(page)).world.tick).toBe(0)
}

export function getState(page: Page): Promise<TestStateSnapshot> {
  return page.evaluate(() => {
    if (!window.__pirate) throw new Error('Test hooks are not installed')
    return window.__pirate.getState()
  })
}

/** Simulates `ms` of game time through the real step + render path. */
export async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((duration) => {
    if (!window.__pirate) throw new Error('Test hooks are not installed')
    window.__pirate.advance(duration)
  }, ms)
}

/** One simulation step, in ms. */
export const STEP_MS = 1000 / 60

export function aliveProjectiles({ world }: TestStateSnapshot): Projectile[] {
  return world.projectiles.filter((projectile) => projectile.alive)
}

/** Starts a new match through the session, as "Play again" will. */
export async function restart(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (!window.__pirate) throw new Error('Test hooks are not installed')
    window.__pirate.restart()
  })
}

/** Lets real time drive the game again (the page opens with a manual clock). */
export async function resumeClock(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (!window.__pirate) throw new Error('Test hooks are not installed')
    window.__pirate.resumeClock()
  })
}

/** localStorage keys written by the app (see src/storage). */
export const STORAGE_KEYS = {
  options: 'pirate-battle:options',
  lastResult: 'pirate-battle:last-result',
  outbox: 'pirate-battle:outbox',
  mockDb: 'pirate-battle:mock-db',
  scenario: 'pirate-battle:scenario',
} as const

/** Records the mock server has confirmed, straight from its storage. */
export async function readMockDb(
  page: Page,
): Promise<{ matchId: string; playerId: string }[]> {
  const raw = await readStorage(page, STORAGE_KEYS.mockDb)
  if (raw === null) return []
  return (
    JSON.parse(raw) as { matches: { matchId: string; playerId: string }[] }
  ).matches
}

/** Match records still waiting to be confirmed by the server. */
export async function readOutbox(page: Page): Promise<{ matchId: string }[]> {
  const raw = await readStorage(page, STORAGE_KEYS.outbox)
  if (raw === null) return []
  return (JSON.parse(raw) as { records: { matchId: string }[] }).records
}

/** Switches the mock network scenario through the Network panel. */
export async function chooseScenario(page: Page, name: string): Promise<void> {
  await page.goto('/#/network')
  await page.getByRole('radio', { name, exact: true }).check()
}

export function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((name) => window.localStorage.getItem(name), key)
}

/**
 * Plays the match out by running down the clock, then waits through the
 * end-of-match delay until the result screen opens.
 */
export async function finishMatchByTime(page: Page): Promise<void> {
  const { config } = (await getState(page)).world
  await advance(page, config.match.durationSeconds * 1000)
  expect((await getState(page)).world.match.status).toBe('ended')
  await advance(page, config.match.resultDelaySeconds * 1000)
  await expect(page).toHaveURL(/#\/result$/)
}

/** What the renderer draws right now (arena placement, ships, canvas). */
export function getRenderStats(page: Page): Promise<RenderStats> {
  return page.evaluate(() => {
    if (!window.__pirate) throw new Error('Test hooks are not installed')
    return window.__pirate.getRenderStats()
  })
}
