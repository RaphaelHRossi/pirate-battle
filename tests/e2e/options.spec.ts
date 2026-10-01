import type { Locator, Page } from '@playwright/test'
import { getState, readStorage, STORAGE_KEYS } from '../helpers/game'
import { expect, test } from '../helpers/test'

const sessionInput = (page: Page) =>
  page.getByRole('textbox', { name: 'Game session time' })
const spawnInput = (page: Page) =>
  page.getByRole('textbox', { name: 'Enemy spawn time' })

/** The field is invalid, and its description says why. */
async function expectError(input: Locator, message: RegExp): Promise<void> {
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAccessibleDescription(message)
}

async function expectValid(input: Locator): Promise<void> {
  await expect(input).not.toHaveAttribute('aria-invalid')
}

test('the options screen is reachable by keyboard and back', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Pirate Battle' }),
  ).toBeFocused()
  await page.keyboard.press('Tab') // Play
  await page.keyboard.press('Tab') // Options
  await expect(page.getByRole('button', { name: 'Options' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/#\/options$/)
  await expect(page.getByRole('heading', { name: 'Options' })).toBeFocused()
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await expect(page).toHaveURL(/#\/$/)
})

test('invalid values are explained accessibly and never saved', async ({
  page,
}) => {
  await page.goto('/#/options')
  const session = sessionInput(page)
  const spawn = spawnInput(page)
  await expect(session).toHaveValue('120')
  await expect(spawn).toHaveValue('3')
  await expectValid(session)

  await session.fill('65')
  await expectError(session, /steps of 10 seconds/)
  await session.fill('200')
  await expectError(session, /between 60 and 180 seconds/)
  await session.fill('abc')
  await expectError(session, /must be a number/)
  await session.fill('')
  await expectError(session, /Enter the game session time/)
  await spawn.fill('0.5')
  await expectError(spawn, /between 1 and 10 seconds/)
  await spawn.fill('2.25')
  await expectError(spawn, /steps of 0.5 seconds/)

  // Nothing invalid reached storage.
  expect(await readStorage(page, STORAGE_KEYS.options)).toBeNull()
})

test('valid values save, persist after refresh and apply to the next match', async ({
  page,
}) => {
  await page.goto('/?test=1&clock=manual&spawn=off#/options')
  const session = sessionInput(page)
  const spawn = spawnInput(page)

  await session.fill('90')
  await expectValid(session)
  await expect(page.getByTestId('options-status')).toHaveText(
    'Saved. Changes apply to your next match.',
  )
  // -/+ always step to a valid value: 3 → 2.5 → 2.
  const decreaseSpawn = page.getByRole('button', {
    name: 'Decrease enemy spawn time',
  })
  await decreaseSpawn.click()
  await decreaseSpawn.click()
  await expect(spawn).toHaveValue('2')

  // At a limit, the button that would leave the range is disabled.
  await session.fill('180')
  await expect(
    page.getByRole('button', { name: 'Increase game session time' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Decrease game session time' }).click()
  await expect(session).toHaveValue('170')

  await page.reload()
  await expect(sessionInput(page)).toHaveValue('170')
  await expect(spawnInput(page)).toHaveValue('2')

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  const { config, match } = (await getState(page)).world
  expect(config.match.durationSeconds).toBe(170)
  expect(config.spawn.intervalSeconds).toBe(2)
  expect(match.secondsLeft).toBe(170)
})

test('tampered or out-of-range saved options fall back to the defaults', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: 1, sessionSeconds: 5, spawnSeconds: 0 }),
    )
  }, STORAGE_KEYS.options)
  await page.goto('/#/options')
  await expect(sessionInput(page)).toHaveValue('120')
  await expect(spawnInput(page)).toHaveValue('3')
})
