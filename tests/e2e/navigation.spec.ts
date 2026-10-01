import { expect, test } from '../helpers/test'

test('menu → play → menu five times leaves one canvas and no errors', async ({
  page,
}) => {
  await page.goto('/?test=1#/')
  const canvas = page.locator('canvas')

  for (let round = 0; round < 5; round++) {
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'ready',
    )
    await expect(canvas).toHaveCount(1)

    // Alternate the two ways out: the pause menu and the browser's Back.
    if (round % 2 === 0) {
      await page.keyboard.press('KeyP')
      await page.getByRole('button', { name: 'Main Menu' }).click()
    } else {
      await page.goBack()
    }
    await expect(page).toHaveURL(/#\/$/)
    await expect(canvas).toHaveCount(0)
    // The session is gone with its hooks and its key listeners.
    expect(await page.evaluate(() => window.__pirate === undefined)).toBe(true)
  }

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await expect(canvas).toHaveCount(1)
})

test('every screen keeps its place on refresh; unknown hashes go to the menu', async ({
  page,
}) => {
  const screens: [string, string][] = [
    ['#/options', 'Options'],
    ['#/log', "Captain's Log"],
    ['#/result', 'No battle yet'],
  ]
  for (const [hash, heading] of screens) {
    await page.goto(`/${hash}`)
    await page.reload()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }

  await page.goto('/#/nowhere')
  await expect(page).toHaveURL(/#\/$/)
  await expect(
    page.getByRole('heading', { name: 'Pirate Battle' }),
  ).toBeVisible()
})

test('Ranking and Match History open the log on their tab', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Match History' }).click()
  await expect(page).toHaveURL(/#\/log\/history$/)
  const history = page.getByRole('tab', { name: 'Match History' })
  await expect(history).toHaveAttribute('aria-selected', 'true')

  // Arrow keys move between tabs, and the tab is kept in the URL.
  await history.focus()
  await page.keyboard.press('ArrowLeft')
  const ranking = page.getByRole('tab', { name: 'Ranking' })
  await expect(ranking).toBeFocused()
  await expect(ranking).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/#\/log$/)

  await page.getByRole('button', { name: 'Main Menu' }).click()
  await page.getByRole('button', { name: 'Ranking' }).click()
  await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})
