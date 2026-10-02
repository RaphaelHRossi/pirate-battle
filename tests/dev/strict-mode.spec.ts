import { expect, test } from '../helpers/test'

/**
 * Runs against the Vite dev server, where React Strict Mode mounts every
 * effect twice: the game must still end up with exactly one session (one
 * canvas, one set of hooks) and tear it down cleanly, with no console
 * errors, every time the match screen is entered and left.
 */
test('Strict Mode double mounting leaves one canvas and cleans up', async ({
  page,
}) => {
  await page.goto('/?test=1&clock=manual&spawn=off#/')
  const canvas = page.locator('canvas')

  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.locator('.game-host')).toHaveAttribute(
      'data-status',
      'ready',
      { timeout: 30_000 },
    )
    await expect(canvas).toHaveCount(1)
    // The surviving session is the one wired to the hooks and the HUD.
    expect(
      await page.evaluate(() => window.__pirate?.getState().world.tick),
    ).toBe(0)
    await expect(page.getByTestId('hud-health')).toHaveText('100 / 100')
    // Its loop is alive: one second of game time moves the clock.
    await page.evaluate(() => window.__pirate?.advance(1000))
    await expect(page.getByTestId('hud-time')).toHaveText('01:59')

    await page.keyboard.press('KeyP')
    await page.getByRole('button', { name: 'Main Menu' }).click()
    await expect(canvas).toHaveCount(0)
    expect(await page.evaluate(() => window.__pirate === undefined)).toBe(true)
  }
})
