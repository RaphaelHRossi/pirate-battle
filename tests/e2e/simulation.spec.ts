import type { Page } from '@playwright/test'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import { getState, openGame } from '../helpers/game'
import { expect, test } from '../helpers/test'

/** Everything the rules decide: if frame timing leaked in, this would differ. */
function outcome({ world }: TestStateSnapshot): unknown {
  return {
    tick: world.tick,
    match: world.match,
    spawn: world.spawn,
    rng: world.rng,
    player: world.player,
    enemies: world.enemies.filter((e) => e.alive),
    projectiles: world.projectiles.filter((p) => p.alive),
  }
}

/** 10 s of game time with the same keys held, cut into frames by `slices`. */
async function play(page: Page, slices: number[]): Promise<unknown> {
  // A real navigation each time (the same URL with a hash would not reload).
  await page.goto('about:blank')
  await openGame(page, { seed: 3, spawn: true })
  const keys = ['ArrowUp', 'ArrowLeft', 'Space', 'KeyE']
  for (const key of keys) await page.keyboard.down(key)
  // Every slice is its own advance() call (one "frame"), all in one round
  // trip to the page so the test stays fast.
  await page.evaluate((frames) => {
    for (const ms of frames) window.__pirate?.advance(ms)
  }, slices)
  for (const key of keys) await page.keyboard.up(key)
  return outcome(await getState(page))
}

test('the simulation gives the same result however time is cut into frames', async ({
  page,
}) => {
  // Two full 10 s simulations with spawns: slow on the mobile profile.
  test.slow()
  // One 10 s slice...
  const once = await play(page, [10_000])
  // ...vs 600 uneven frames (5 to 40 ms) adding up to the same 10 s.
  const pattern = [5, 11, 23, 40, 4.5, 16.5]
  const uneven = await play(
    page,
    Array.from({ length: 100 }, () => pattern).flat(),
  )
  expect(uneven).toEqual(once)
  expect((once as { tick: number }).tick).toBe(600)
})
