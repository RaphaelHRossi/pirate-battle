import type { Page } from '@playwright/test'
import { STORAGE_KEYS } from '../helpers/game'
import { expect, test } from '../helpers/test'

const rows = (page: Page) => page.locator('.log-table tbody tr')
const firstRank = (page: Page) => rows(page).first().locator('td').first()
const pagerLabel = (page: Page) => page.getByTestId('pager-label')

test('the ranking pages through the fixtures five at a time', async ({
  page,
}) => {
  await page.goto('/#/log')
  await expect(page.getByTestId('ranking-config')).toHaveText(
    '120 second battles · 3 second spawn interval',
  )
  await expect(rows(page)).toHaveCount(5)
  await expect(pagerLabel(page)).toHaveText('Page 1 of 4')
  await expect(firstRank(page)).toHaveText('01')
  await expect(
    page.getByRole('button', { name: 'Previous page' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('table', { name: /Ranking, page 1 of 4/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(pagerLabel(page)).toHaveText('Page 2 of 4')
  await expect(firstRank(page)).toHaveText('06')

  // Points never go up down the ranking.
  const points = await rows(page).locator('td:nth-child(3)').allTextContents()
  const sorted = [...points].map(Number).sort((a, b) => b - a)
  expect(points.map(Number)).toEqual(sorted)

  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(firstRank(page)).toHaveText('01')
})

test('a slow server shows a loading state, then the rows', async ({ page }) => {
  await page.goto('/?scenario=slow#/log')
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading…' }),
  ).toBeVisible()
  await expect(rows(page)).toHaveCount(5, { timeout: 5000 })

  // Changing page keeps the previous rows (dimmed, busy) until the next arrive.
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('.log-table')).toHaveAttribute('aria-busy', 'true')
  await expect(firstRank(page)).toHaveText('01')
  await expect(firstRank(page)).toHaveText('06', { timeout: 5000 })
  await expect(page.locator('.log-table')).not.toHaveAttribute('aria-busy')
})

test('empty lists say so in both tabs', async ({ page }) => {
  await page.goto('/?scenario=empty#/log')
  await expect(
    page.getByText('No battles recorded with these settings yet'),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Match History' }).click()
  await expect(page.getByText('No battles yet.')).toBeVisible()
})

test.describe('when the ranking fails', () => {
  // The browser logs every failed (5xx) response; those are expected here.
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('it shows an error with Retry, and the history still works', async ({
    page,
  }) => {
    await page.goto('/?scenario=ranking-fail#/log')
    // Shown once the automatic retries are used up.
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Could not load the ranking', {
      timeout: 10_000,
    })

    await page.getByRole('tab', { name: 'Match History' }).click()
    await expect(page.getByText('No battles yet.')).toBeVisible()
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await expect(alert).toContainText('Could not load the ranking', {
      timeout: 10_000,
    })

    // The server recovers; Retry fetches again.
    await page.evaluate((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ name: 'success', netSeed: 1 }),
      )
    }, STORAGE_KEYS.scenario)
    await alert.getByRole('button', { name: 'Retry' }).click()
    await expect(rows(page)).toHaveCount(5)
  })
})

test('out-of-order responses never replace the page asked for last', async ({
  page,
}) => {
  const answered: string[] = []
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname === '/api/ranking') {
      answered.push(url.searchParams.get('page') ?? '?')
    }
  })
  await page.goto('/?scenario=out-of-order#/log')
  await expect(rows(page)).toHaveCount(5, { timeout: 5000 })

  // Page 2 is slow (1.2 s), page 3 fast (0.6 s): ask for both in a row.
  const next = page.getByRole('button', { name: 'Next page' })
  await next.click()
  await next.click()
  await expect(firstRank(page)).toHaveText('11', { timeout: 5000 })
  // Long enough for page 2's late answer to arrive (or be cancelled).
  await page.waitForTimeout(1500)

  await expect(pagerLabel(page)).toHaveText('Page 3 of 4')
  await expect(firstRank(page)).toHaveText('11')
  // Page 3 really answered before page 2 could.
  expect(answered.indexOf('3')).toBeGreaterThan(-1)
  const page2 = answered.indexOf('2')
  if (page2 !== -1) expect(page2).toBeGreaterThan(answered.indexOf('3'))
})

/** Seeds this browser's player and `count` of their matches in the mock DB. */
async function seedHistory(page: Page, count: number): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ count, keys }) => {
      const playerId = crypto.randomUUID()
      const matches = Array.from({ length: count }, (_, i) => ({
        matchId: crypto.randomUUID(),
        playerId,
        playerName: 'Captain Test',
        // One match per hour, the newest last.
        playedAt: new Date(Date.UTC(2026, 8, 1, i)).toISOString(),
        score: i,
        durationMs: 120_000,
        endReason: i % 2 === 0 ? 'timeUp' : 'playerDestroyed',
        config: { sessionSeconds: 120, spawnSeconds: 3 },
      }))
      localStorage.setItem(
        keys.player,
        JSON.stringify({ version: 1, playerId, name: 'Captain Test' }),
      )
      localStorage.setItem(keys.mockDb, JSON.stringify({ version: 1, matches }))
    },
    {
      count,
      keys: { player: 'pirate-battle:player', mockDb: STORAGE_KEYS.mockDb },
    },
  )
}

test('match history pages through the player’s matches, newest first', async ({
  page,
}) => {
  await seedHistory(page, 7)
  await page.goto('/#/log/history')
  await expect(
    page.getByText('Captain Test · Your recent battles'),
  ).toBeVisible()
  await expect(rows(page)).toHaveCount(5)
  await expect(pagerLabel(page)).toHaveText('Page 1 of 2')
  // Score i was played at hour i: the newest (6) comes first.
  const points = rows(page).locator('td:nth-child(2)')
  await expect(points).toHaveText(['6', '5', '4', '3', '2'])

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(pagerLabel(page)).toHaveText('Page 2 of 2')
  await expect(points).toHaveText(['1', '0'])
  await expect(rows(page).first()).toContainText('Ship destroyed')
})

test.describe('when the history fails', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('it shows an error with Retry, and the ranking still works', async ({
    page,
  }) => {
    await page.goto('/?scenario=history-fail#/log/history')
    await expect(page.getByRole('alert')).toContainText(
      'Could not load the match history',
      { timeout: 10_000 },
    )
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await expect(rows(page)).toHaveCount(5)
  })
})

/** Counts the page's GET /api/ranking requests. */
function countRankingRequests(page: Page): () => number {
  let count = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/ranking') count += 1
  })
  return () => count
}

test.describe('network failures', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] })

  test('5xx answers are retried twice, then the error is shown', async ({
    page,
  }) => {
    const requests = countRankingRequests(page)
    await page.goto('/?scenario=server-error#/log')
    await expect(page.getByRole('alert')).toContainText('(500)', {
      timeout: 10_000,
    })
    await page.waitForTimeout(1500)
    expect(requests()).toBe(3)
  })

  test('4xx answers are not retried', async ({ page }) => {
    const requests = countRankingRequests(page)
    await page.goto('/?scenario=bad-request#/log')
    await expect(page.getByRole('alert')).toContainText('(400)')
    await page.waitForTimeout(1500)
    expect(requests()).toBe(1)
  })

  test('a lost connection is retried, then reported', async ({ page }) => {
    const requests = countRankingRequests(page)
    await page.goto('/?scenario=offline#/log')
    await expect(page.getByRole('alert')).toContainText(
      'Could not reach the server',
      { timeout: 10_000 },
    )
    expect(requests()).toBe(3)
  })

  test('a server that never answers times out, then is reported', async ({
    page,
  }) => {
    // 3 attempts × 5 s timeout + 0.5 s + 1 s of backoff.
    test.slow()
    await page.goto('/?scenario=timeout#/log')
    await expect(
      page.getByRole('status').filter({ hasText: 'Loading…' }),
    ).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('took too long', {
      timeout: 25_000,
    })
  })
})

test('a tab shown again comes from the cache at once and refreshes in the background', async ({
  page,
}) => {
  const requests = countRankingRequests(page)
  await page.goto('/?scenario=slow#/log')
  await expect(rows(page)).toHaveCount(5, { timeout: 5000 })
  const afterFirstLoad = requests()

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Ranking' }).click()
  // Cached rows immediately (the slow server takes 2 s)...
  await expect(rows(page)).toHaveCount(5, { timeout: 500 })
  // ...while a background refetch is under way.
  const updating = page.locator('.log-updating')
  await expect(updating).toHaveText('Updating…')
  await expect(updating).toHaveText('', { timeout: 5000 })
  expect(requests()).toBe(afterFirstLoad + 1)
})
