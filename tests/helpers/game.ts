import type { Page } from '@playwright/test'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import { expect } from './test'

/**
 * Opens the game in test mode with a fixed seed (and optional fixture) and
 * takes control of the clock, so only `advance()` moves the simulation.
 */
export async function openGame(
  page: Page,
  { seed = 1, fixture }: { seed?: number; fixture?: string } = {},
): Promise<void> {
  const params = new URLSearchParams({ test: '1', seed: String(seed) })
  if (fixture) params.set('fixture', fixture)
  await page.goto(`/?${params.toString()}`)
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await page.evaluate(() => {
    if (!window.__pirate) throw new Error('Test hooks are not installed')
    window.__pirate.pauseClock()
  })
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
