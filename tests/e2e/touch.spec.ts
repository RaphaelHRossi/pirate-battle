import type { CDPSession, Locator, Page } from '@playwright/test'
import {
  advance,
  aliveProjectiles,
  getState,
  openGame,
  STEP_MS,
} from '../helpers/game'
import { expect, test } from '../helpers/test'

const button = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Ship controls' }).getByRole('button', {
    name,
  })

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Touch button is not visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * Real multi-touch through the Chrome DevTools Protocol: each call lists
 * every finger currently on the screen, the way a touchscreen reports.
 * Playwright's own `tap()` only does one quick single-finger tap.
 */
async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: { x: number; y: number }[],
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point, id) => ({ ...point, id })),
  })
}

test.describe('on a touch screen', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch controls are for touch screens')

  test('holding forward sails; a second finger turns at the same time', async ({
    page,
  }) => {
    await openGame(page)
    const cdp = await page.context().newCDPSession(page)
    const forward = await centre(button(page, 'Sail forward'))
    const turnLeft = await centre(button(page, 'Turn left'))
    const start = (await getState(page)).world.player

    await touch(cdp, 'touchStart', [forward])
    await advance(page, 1000)
    const sailed = (await getState(page)).world.player
    const { speed } = (await getState(page)).world.config.player
    const distance = Math.hypot(sailed.x - start.x, sailed.y - start.y)
    expect(distance).toBeGreaterThan(speed * 0.9)
    expect(sailed.heading).toBeCloseTo(start.heading)

    // Forward still held, turn added: both act together.
    await touch(cdp, 'touchStart', [forward, turnLeft])
    await advance(page, 500)
    const turned = (await getState(page)).world.player
    expect(turned.heading).toBeLessThan(sailed.heading)
    expect(
      Math.hypot(turned.x - sailed.x, turned.y - sailed.y),
    ).toBeGreaterThan(0)

    // All fingers up: the ship stops acting at once.
    await touch(cdp, 'touchEnd', [])
    await advance(page, STEP_MS)
    const released = (await getState(page)).world.player
    await advance(page, 500)
    const idle = (await getState(page)).world.player
    expect(idle.heading).toBe(released.heading)
    expect(idle.x).toBeCloseTo(released.x)
    expect(idle.y).toBeCloseTo(released.y)
  })

  test('tapping the fire buttons fires the bow cannon and a broadside', async ({
    page,
  }) => {
    await openGame(page)
    await button(page, 'Fire bow cannon').tap()
    await advance(page, STEP_MS)
    expect(aliveProjectiles(await getState(page))).toHaveLength(1)

    await button(page, 'Fire starboard broadside').tap()
    await advance(page, STEP_MS)
    const { count } = (await getState(page)).world.config.player.broadside
    expect(aliveProjectiles(await getState(page))).toHaveLength(1 + count)
  })

  test('turning to portrait pauses and asks to rotate back', async ({
    page,
  }) => {
    await openGame(page)
    const viewport = page.viewportSize()
    if (!viewport) throw new Error('No viewport')
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    })
    await expect(page.getByText('Rotate your device')).toBeVisible()
    await expect.poll(async () => (await getState(page)).paused).toBe(true)

    await page.setViewportSize(viewport)
    await expect(page.getByText('Rotate your device')).toBeHidden()
    // Rotating back is not an explicit action: the player resumes.
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
    expect((await getState(page)).paused).toBe(true)
  })
})

test('touch controls are hidden with a mouse and keyboard', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop only')
  await openGame(page)
  await expect(page.getByRole('group', { name: 'Ship controls' })).toBeHidden()
})
