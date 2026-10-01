import type { Page } from '@playwright/test'
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

test('repeated trips through every screen leave no canvas or session behind', async ({
  page,
}) => {
  await page.goto('/?test=1#/')
  const button = (name: string) =>
    page.getByRole('button', { name, exact: true })
  const heading = (name: string) => page.getByRole('heading', { name })

  for (let round = 0; round < 3; round++) {
    await button('Options').click()
    await expect(heading('Options')).toBeVisible()
    await button('Main Menu').click()

    await button('Ranking').click()
    await expect(page.locator('.log-table tbody tr')).toHaveCount(5)
    await page.getByRole('tab', { name: 'Match History' }).click()
    await expect(page.getByText('No battles yet.')).toBeVisible()
    await button('Main Menu').click()

    await button('Network settings').click()
    await expect(heading('Network')).toBeVisible()
    await button('Main Menu').click()

    await page.evaluate(() => {
      window.location.hash = '#/result'
    })
    await expect(heading('No battle yet')).toBeVisible()
    await button('Play Again').click()
    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'ready',
    )
    await expect(page.locator('canvas')).toHaveCount(1)
    await page.keyboard.press('KeyP')
    await button('Main Menu').click()

    await expect(heading('Pirate Battle')).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(await page.evaluate(() => window.__pirate === undefined)).toBe(true)
  }
})

/**
 * Records, for every keydown, whether anything called preventDefault():
 * the game's key handler does, for its keys, but only during gameplay.
 */
async function probeKeys(page: Page): Promise<() => Promise<boolean[]>> {
  await page.evaluate(() => {
    const seen: boolean[] = []
    Object.assign(window, { __keysPrevented: seen })
    window.addEventListener('keydown', (event) => {
      // After every other listener has run.
      setTimeout(() => seen.push(event.defaultPrevented))
    })
  })
  return async () => {
    await page.waitForTimeout(50)
    return page.evaluate(() => {
      const value: unknown = Reflect.get(window, '__keysPrevented')
      const list = Array.isArray(value) ? (value as boolean[]) : []
      return list.splice(0)
    })
  }
}

test('game keys are only captured while the match is being played', async ({
  page,
}) => {
  await page.goto('/?test=1&clock=manual&spawn=off#/')
  const prevented = await probeKeys(page)
  const keys = ['Space', 'ArrowUp', 'ArrowLeft', 'KeyQ', 'KeyE', 'KeyP']

  // Menu (focus on the heading, not on a button Space would click).
  for (const key of keys) await page.keyboard.press(key)
  expect(await prevented()).toEqual(keys.map(() => false))
  await expect(page).toHaveURL(/#\/$/)

  // During gameplay the same keys belong to the game.
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.locator('.game-host')).toHaveAttribute(
    'data-status',
    'ready',
  )
  await page.keyboard.press('ArrowUp')
  expect(await prevented()).toEqual([true])

  // Paused: game keys are released to the page and the ship stays put.
  await page.keyboard.press('KeyP')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  await prevented()
  const before = await page.evaluate(
    () => window.__pirate?.getState().world.player.x,
  )
  await page.keyboard.down('ArrowUp')
  await page.evaluate(() => window.__pirate?.advance(500))
  await page.keyboard.up('ArrowUp')
  expect(await prevented()).toEqual([false])
  expect(
    await page.evaluate(() => window.__pirate?.getState().world.player.x),
  ).toBe(before)

  // Back on the menu after a match: nothing is captured, nothing fires.
  await page.getByRole('button', { name: 'Main Menu' }).click()
  await expect(
    page.getByRole('heading', { name: 'Pirate Battle' }),
  ).toBeFocused()
  for (const key of keys) await page.keyboard.press(key)
  expect(await prevented()).toEqual(keys.map(() => false))
  await expect(page.locator('canvas')).toHaveCount(0)
})
