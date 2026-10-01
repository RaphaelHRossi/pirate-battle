import type { Page } from '@playwright/test'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import type { Projectile } from '../../src/game/types'
import { expect } from './test'

/**
 * Opens the game in test mode with a fixed seed (and optional fixture) and
 * a manual clock: real time never moves the simulation, only `advance()`.
 */
export async function openGame(
  page: Page,
  { seed = 1, fixture }: { seed?: number; fixture?: string } = {},
): Promise<void> {
  const params = new URLSearchParams({
    test: '1',
    clock: 'manual',
    seed: String(seed),
  })
  if (fixture) params.set('fixture', fixture)
  await page.goto(`/?${params.toString()}`)
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
