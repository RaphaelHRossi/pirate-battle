import type { Page } from '@playwright/test'
import {
  chooseScenario,
  finishMatchByTime,
  openGame,
  readMockDb,
  readOutbox,
  STORAGE_KEYS,
} from '../helpers/game'
import { expect, test } from '../helpers/test'

const registration = (page: Page) => page.getByTestId('result-registration')

/** Counts PUT /api/matches requests and how many created a record. */
function watchSaves(page: Page): { sent: () => number; created: () => number } {
  let sent = 0
  let created = 0
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/api/matches/')) {
      sent += 1
    }
  })
  page.on('response', (response) => {
    const { method, url } = {
      method: response.request().method(),
      url: response.url(),
    }
    if (
      method === 'PUT' &&
      url.includes('/api/matches/') &&
      response.status() === 201
    ) {
      created += 1
    }
  })
  return { sent: () => sent, created: () => created }
}

test('a finished match appears once in the ranking and the history', async ({
  page,
}) => {
  // A config no fixture uses, so the player's match is the only entry.
  await page.goto('/')
  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: 1, sessionSeconds: 60, spawnSeconds: 1 }),
    )
  }, STORAGE_KEYS.options)
  await openGame(page)
  await finishMatchByTime(page)
  await expect(registration(page)).toHaveText('Saved')

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByTestId('ranking-config')).toHaveText(
    '60 second battles · 1 second spawn interval',
  )
  const ranking = page.locator('.log-table tbody tr')
  await expect(ranking).toHaveCount(1)
  await expect(ranking.first()).toContainText('01')
  await expect(ranking.first()).toContainText('You')
  await expect(ranking.first()).toHaveClass(/log-row--mine/)

  await page.getByRole('tab', { name: 'Match History' }).click()
  const history = page.locator('.log-table tbody tr')
  await expect(history).toHaveCount(1)
  await expect(history.first()).toContainText('01:00')
  await expect(history.first()).toContainText('Time up')
  expect(await readMockDb(page)).toHaveLength(1)
})

test.describe('when saving fails', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('save-unavailable keeps the record through a reload until the server is back', async ({
    page,
  }) => {
    const saves = watchSaves(page)
    await openGame(page, { scenario: 'save-unavailable' })
    await finishMatchByTime(page)
    await expect(registration(page)).toHaveText('Not saved', {
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    const [pending] = await readOutbox(page)
    expect(pending).toBeDefined()
    expect(await readMockDb(page)).toEqual([])

    // A refresh loses nothing: the record is still waiting.
    await page.reload()
    expect(await readOutbox(page)).toHaveLength(1)
    await expect(registration(page)).toHaveText('Not saved', {
      timeout: 10_000,
    })

    await chooseScenario(page, 'success')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await expect.poll(() => readOutbox(page), { timeout: 10_000 }).toEqual([])
    const db = await readMockDb(page)
    expect(db.map((record) => record.matchId)).toEqual([pending?.matchId])
    expect(saves.created()).toBe(1)

    await page.goto('/#/result')
    await expect(registration(page)).toHaveText('Saved')
  })

  test('Retry sends a failed record, and a new match can start meanwhile', async ({
    page,
  }) => {
    await openGame(page, { scenario: 'save-unavailable' })
    await finishMatchByTime(page)
    await expect(registration(page)).toHaveText('Not saved', {
      timeout: 10_000,
    })

    // Failures never block playing.
    await page.getByRole('button', { name: 'Play Again' }).click()
    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'ready',
    )
    await page.goBack()

    await page.evaluate((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ name: 'success', netSeed: 1 }),
      )
    }, STORAGE_KEYS.scenario)
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(registration(page)).toHaveText('Saved')
    expect(await readMockDb(page)).toHaveLength(1)
  })
})

test('a save that times out after committing is retried without a duplicate', async ({
  page,
}) => {
  const saves = watchSaves(page)
  await openGame(page, { scenario: 'save-timeout-after-commit' })
  await finishMatchByTime(page)
  await expect(registration(page)).toHaveText('Saving…')

  // First PUT committed but never answered (5 s timeout); the automatic
  // retry finds the record and gets 200.
  await expect(registration(page)).toHaveText('Saved', { timeout: 15_000 })
  expect(saves.sent()).toBe(2)
  expect(await readMockDb(page)).toHaveLength(1)
  expect(await readOutbox(page)).toEqual([])

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(page.locator('.log-table tbody tr')).toHaveCount(1)
})

test.describe('PUT /api/matches is idempotent', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('the same record returns 200; different data under the id returns 409', async ({
    page,
  }) => {
    await openGame(page)
    await finishMatchByTime(page)
    await expect(registration(page)).toHaveText('Saved')

    const statuses = await page.evaluate(async (key) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) throw new Error('No mock DB')
      const { matches } = JSON.parse(raw) as {
        matches: { matchId: string; score: number }[]
      }
      const [record] = matches
      if (!record) throw new Error('No record')
      const put = (body: unknown) =>
        fetch(`/api/matches/${record.matchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then((response) => response.status)
      return [
        await put(record),
        await put({ ...record, score: record.score + 1 }),
      ]
    }, STORAGE_KEYS.mockDb)
    expect(statuses).toEqual([200, 409])
    expect(await readMockDb(page)).toHaveLength(1)
  })
})
