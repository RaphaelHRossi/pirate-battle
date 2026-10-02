import type { Page } from '@playwright/test'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import { advance, getState, openGame, resumeClock } from '../helpers/game'
import { expect, test } from '../helpers/test'

/** The parts of the state that must not move while paused. */
const clockOf = ({ world }: TestStateSnapshot) => ({
  tick: world.tick,
  secondsLeft: world.match.secondsLeft,
})

/** Real time drives these tests: pausing must hold back the wall clock. */
async function openRunningGame(page: Page): Promise<void> {
  await openGame(page)
  await resumeClock(page)
  // Let some real frames run first, so there is a clock to freeze.
  await expect
    .poll(async () => (await getState(page)).world.tick)
    .toBeGreaterThan(10)
}

const pauseDialog = (page: Page) => page.getByRole('dialog', { name: 'Paused' })

/** Resumes, then checks the game ran on without replaying the pause. */
async function expectResumesWithoutCatchUp(
  page: Page,
  frozen: ReturnType<typeof clockOf>,
): Promise<void> {
  await expect(pauseDialog(page)).toBeHidden()
  const before = clockOf(await getState(page))
  // Nothing was simulated for the paused 1.5 s (90 steps); only the real
  // time since Resume (a few hundred ms of test round trips) has run.
  expect(before.tick - frozen.tick).toBeLessThan(45)
  // ...and it runs again in real time.
  await expect
    .poll(async () => clockOf(await getState(page)).tick)
    .toBeGreaterThan(before.tick)
}

test('losing window focus pauses; the timer holds until Resume', async ({
  page,
}) => {
  await openRunningGame(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))

  await expect(pauseDialog(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()
  const frozen = clockOf(await getState(page))
  await page.waitForTimeout(1500)
  expect(clockOf(await getState(page))).toEqual(frozen)
  // Regaining focus is not an explicit action: still paused.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(pauseDialog(page)).toBeVisible()

  await page.getByRole('button', { name: 'Resume' }).click()
  await expectResumesWithoutCatchUp(page, frozen)
})

test('hiding the tab pauses; the timer holds until Resume', async ({
  page,
}) => {
  await openRunningGame(page)
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => value,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    }, state)

  await setVisibility('hidden')
  await expect(pauseDialog(page)).toBeVisible()
  const frozen = clockOf(await getState(page))
  await page.waitForTimeout(1500)
  await setVisibility('visible')
  expect(clockOf(await getState(page))).toEqual(frozen)
  await expect(pauseDialog(page)).toBeVisible()

  await page.keyboard.press('Escape')
  await expectResumesWithoutCatchUp(page, frozen)
})

test('P pauses, Escape resumes and does not pause again', async ({ page }) => {
  await openRunningGame(page)
  const announcer = page.getByTestId('announcer')

  await page.keyboard.press('KeyP')
  await expect(pauseDialog(page)).toBeVisible()
  await expect(announcer).toHaveText('Game paused.')
  const frozen = clockOf(await getState(page))

  await page.keyboard.press('Escape')
  await expectResumesWithoutCatchUp(page, frozen)
  await expect(announcer).toHaveText('Game resumed.')
  // The Escape that resumed must not reach the game keys and re-pause.
  await page.waitForTimeout(300)
  expect((await getState(page)).paused).toBe(false)
  await expect(pauseDialog(page)).toBeHidden()
})

test('keys pressed while paused do nothing once the game resumes', async ({
  page,
}) => {
  await openGame(page)
  const start = await getState(page)
  await page.keyboard.press('KeyP')
  await expect(pauseDialog(page)).toBeVisible()

  // Held and tapped during the pause: the game is not listening.
  await page.keyboard.down('ArrowUp')
  await page.keyboard.down('Space')
  await page.keyboard.press('KeyE')
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(pauseDialog(page)).toBeHidden()

  await advance(page, 500)
  const after = await getState(page)
  expect(after.world.projectiles.filter((p) => p.alive)).toEqual([])
  expect(after.world.player.x).toBe(start.world.player.x)
  expect(after.world.player.y).toBe(start.world.player.y)
  expect(after.world.player.cooldowns).toEqual({ front: 0, left: 0, right: 0 })
  await page.keyboard.up('Space')
  await page.keyboard.up('ArrowUp')
})
