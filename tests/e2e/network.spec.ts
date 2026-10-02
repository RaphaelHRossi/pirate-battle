import {
  finishMatchByTime,
  openGame,
  readStorage,
  STORAGE_KEYS,
} from '../helpers/game'
import { expect, test } from '../helpers/test'

test.use({ allowedConsoleErrors: [/Failed to load resource/] })

test('Reset clears the mock DB, outbox, last result and scenario, and keeps options', async ({
  page,
}) => {
  // A confirmed record already in the mock DB...
  await openGame(page)
  await finishMatchByTime(page)
  await expect(page.getByTestId('result-registration')).toHaveText('Saved')
  // ...a pending one stuck in the outbox, and saved options.
  await page.goto(
    '/?test=1&clock=manual&spawn=off&scenario=save-unavailable#/options',
  )
  await page.getByRole('textbox', { name: 'Game session time' }).fill('90')
  await page.evaluate(() => {
    window.location.hash = '#/play'
  })
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await finishMatchByTime(page)
  await expect(page.getByTestId('result-registration')).toHaveText(
    'Not saved',
    {
      timeout: 10_000,
    },
  )

  for (const key of [
    STORAGE_KEYS.mockDb,
    STORAGE_KEYS.outbox,
    STORAGE_KEYS.lastResult,
    STORAGE_KEYS.scenario,
  ]) {
    expect(await readStorage(page, key), key).not.toBeNull()
  }

  await page.evaluate(() => {
    window.location.hash = '#/network'
  })
  await expect(
    page.getByRole('radio', { name: 'save-unavailable', exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Reset' }).click()

  // Reloaded on the menu, without ?scenario= (it would be re-applied).
  await expect(page).toHaveURL(/#\/$/)
  expect(new URL(page.url()).searchParams.has('scenario')).toBe(false)
  await expect(
    page.getByRole('heading', { name: 'Pirate Battle' }),
  ).toBeVisible()
  expect(await readStorage(page, STORAGE_KEYS.mockDb)).toBeNull()
  expect(await readStorage(page, STORAGE_KEYS.outbox)).toBeNull()
  expect(await readStorage(page, STORAGE_KEYS.lastResult)).toBeNull()
  expect(await readStorage(page, STORAGE_KEYS.scenario)).toBeNull()
  expect(await readStorage(page, STORAGE_KEYS.options)).not.toBeNull()

  await page.getByRole('button', { name: 'Network settings' }).click()
  await expect(
    page.getByRole('radio', { name: 'success', exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(page.getByText('No battles yet.')).toBeVisible()
})

test('a failing API never blocks the options or the game', async ({ page }) => {
  // A different value each time, so every round really saves something.
  const rounds = [
    { scenario: 'server-error', seconds: 90, after1s: '01:29' },
    { scenario: 'offline', seconds: 100, after1s: '01:39' },
    { scenario: 'timeout', seconds: 110, after1s: '01:49' },
  ]
  for (const { scenario, seconds, after1s } of rounds) {
    await page.goto(
      `/?test=1&clock=manual&spawn=off&scenario=${scenario}#/options`,
    )
    const session = page.getByRole('textbox', { name: 'Game session time' })
    await session.fill(String(seconds))
    await expect(page.getByTestId('options-status')).toHaveText(
      'Saved. Changes apply to your next match.',
    )
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'ready',
    )
    const tick = await page.evaluate(() => {
      window.__pirate?.advance(1000)
      return window.__pirate?.getState().world.tick
    })
    expect(tick).toBe(60)
    await expect(page.getByTestId('hud-time')).toHaveText(after1s)
  }
})
