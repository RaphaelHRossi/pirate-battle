import { existsSync } from 'node:fs'
import { finishMatchByTime, openGame } from '../helpers/game'
import { expect, test } from '../helpers/test'

/**
 * Screenshot baselines are per project and per OS (see playwright.config).
 * When this OS has no baseline yet, the test is skipped with a note rather
 * than failing, unless baselines are being written (--update-snapshots).
 */
function requireBaseline(name: string): void {
  const info = test.info()
  const updating =
    info.config.updateSnapshots === 'all' ||
    info.config.updateSnapshots === 'changed'
  const baseline = info.snapshotPath(name, { kind: 'screenshot' })
  test.skip(
    !updating && !existsSync(baseline),
    `No ${process.platform} baseline (${name}); run "npm run test:visual:update" to create it.`,
  )
}

test('main menu', async ({ page }) => {
  requireBaseline('menu.png')
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Pirate Battle' }),
  ).toBeFocused()
  // The title image must be decoded before the shot.
  await expect(page.locator('.title-image')).toHaveJSProperty('complete', true)
  await expect(page).toHaveScreenshot('menu.png')
})

test('arena in a stable state', async ({ page }) => {
  requireBaseline('arena.png')
  // Fixed seed, manual clock (nothing moves) and no spawns.
  await openGame(page)
  await expect(page.getByTestId('hud-time')).toHaveText('02:00')
  await expect(page).toHaveScreenshot('arena.png')
})

test('result screen', async ({ page }) => {
  requireBaseline('result.png')
  await openGame(page)
  await finishMatchByTime(page)
  await expect(page.getByTestId('result-registration')).toHaveText('Saved')
  await expect(page).toHaveScreenshot('result.png')
})
