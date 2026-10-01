import type { Page } from '@playwright/test'
import {
  advance,
  finishMatchByTime,
  getState,
  openGame,
  readStorage,
  STORAGE_KEYS,
} from '../helpers/game'
import { expect, test } from '../helpers/test'

async function savedResultId(page: Page): Promise<string | null> {
  const raw = await readStorage(page, STORAGE_KEYS.lastResult)
  if (raw === null) return null
  const stored = JSON.parse(raw) as { result: { matchId: string } }
  return stored.result.matchId
}

async function expectNoResult(page: Page): Promise<void> {
  expect(await readStorage(page, STORAGE_KEYS.lastResult)).toBeNull()
  await page.goto('/#/result')
  await expect(
    page.getByRole('heading', { name: 'No battle yet' }),
  ).toBeVisible()
}

test('a match run out of time shows its result, which survives a refresh', async ({
  page,
}) => {
  await openGame(page)
  const { config } = (await getState(page)).world
  await advance(page, config.match.durationSeconds * 1000)
  // Ended, and saved at once, but the end plays out before the result.
  expect((await getState(page)).world.match.status).toBe('ended')
  expect(await savedResultId(page)).not.toBeNull()
  await expect(page).toHaveURL(/#\/play$/)

  await advance(page, config.match.resultDelaySeconds * 1000)
  await expect(page).toHaveURL(/#\/result$/)
  const check = async (): Promise<void> => {
    await expect(
      page.getByRole('heading', { name: 'Battle complete' }),
    ).toBeVisible()
    await expect(page.getByTestId('result-score')).toHaveText('0')
    await expect(page.getByTestId('result-time')).toHaveText('02:00')
    await expect(page.getByTestId('result-reason')).toHaveText('Time up')
    await expect(page.getByTestId('result-registration')).toBeVisible()
  }
  await check()
  await page.reload()
  await check()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('a sunk ship shows score, time played and "Ship destroyed"', async ({
  page,
}) => {
  await openGame(page, { spawn: true, seed: 7 })
  let state = await getState(page)
  for (let i = 0; i < 120 && state.world.match.status === 'running'; i++) {
    await advance(page, 1000)
    state = await getState(page)
  }
  expect(state.world.match.endReason).toBe('playerDestroyed')
  await advance(page, state.world.config.match.resultDelaySeconds * 1000)

  await expect(page).toHaveURL(/#\/result$/)
  await expect(
    page.getByRole('heading', { name: 'Ship destroyed' }),
  ).toBeVisible()
  await expect(page.getByTestId('result-score')).toHaveText(
    String(state.world.match.score),
  )
  const played = Math.floor(state.world.elapsedSeconds)
  const mmss = `${String(Math.floor(played / 60)).padStart(2, '0')}:${String(played % 60).padStart(2, '0')}`
  await expect(page.getByTestId('result-time')).toHaveText(mmss)
  await expect(page.getByTestId('result-reason')).toHaveText('Ship destroyed')

  // Back must not land on #/play (the result replaced it).
  await page.goBack()
  await expect(page).not.toHaveURL(/#\/play$/)
})

test('leaving through the pause menu abandons the match: nothing is recorded', async ({
  page,
}) => {
  await openGame(page)
  await advance(page, 5000)
  await page.keyboard.press('KeyP')
  await page.getByRole('button', { name: 'Main Menu' }).click()

  await expect(page).toHaveURL(/#\/$/)
  await expect(page.locator('canvas')).toHaveCount(0)
  await expectNoResult(page)
})

test('refreshing mid-match abandons it and starts a new one', async ({
  page,
}) => {
  await openGame(page)
  await advance(page, 5000)
  expect((await getState(page)).world.tick).toBeGreaterThan(0)

  await page.reload()
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  expect((await getState(page)).world.tick).toBe(0)
  await expectNoResult(page)
})

test('an abandoned match never replaces the last completed result', async ({
  page,
}) => {
  await openGame(page)
  await finishMatchByTime(page)
  const completed = await savedResultId(page)
  expect(completed).not.toBeNull()

  await page.getByRole('button', { name: 'Play Again' }).click()
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await advance(page, 10_000)
  await page.goBack() // leaves #/play mid-match

  await expect(page).toHaveURL(/#\/result$/)
  expect(await savedResultId(page)).toBe(completed)
  await expect(page.getByTestId('result-time')).toHaveText('02:00')
})
