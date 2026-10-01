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
