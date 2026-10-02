import type { Locator, Page } from '@playwright/test'
import { getRenderStats, getState, openGame } from '../helpers/game'
import { expect, test } from '../helpers/test'

const ARENA_RATIO = 1920 / 1080

/** The whole arena is drawn, centred, at 16:9, touching two canvas edges. */
async function expectLetterboxed(page: Page): Promise<void> {
  const { renderer, canvas } = await getRenderStats(page)
  if (!renderer) throw new Error('no renderer')
  const { x, y, width, height } = renderer.layout
  expect(width / height).toBeCloseTo(ARENA_RATIO, 6)
  expect(x).toBeGreaterThanOrEqual(-0.5)
  expect(y).toBeGreaterThanOrEqual(-0.5)
  expect(x + width).toBeLessThanOrEqual(canvas.cssWidth + 0.5)
  expect(y + height).toBeLessThanOrEqual(canvas.cssHeight + 0.5)
  expect(x).toBeCloseTo((canvas.cssWidth - width) / 2, 1)
  expect(y).toBeCloseTo((canvas.cssHeight - height) / 2, 1)
  const fillsWidth = Math.abs(width - canvas.cssWidth) < 1
  const fillsHeight = Math.abs(height - canvas.cssHeight) < 1
  expect(fillsWidth || fillsHeight).toBe(true)
}

async function expectInsideViewport(page: Page, locator: Locator) {
  const viewport = page.viewportSize()
  const box = await locator.boundingBox()
  if (!viewport || !box) throw new Error('not laid out')
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5)
}

test('the canvas fills the screen and the arena keeps its proportions', async ({
  page,
}) => {
  await openGame(page)
  const viewport = page.viewportSize()
  const { canvas, resolution } = await getRenderStats(page)
  expect(canvas.cssWidth).toBe(viewport?.width)
  expect(canvas.cssHeight).toBe(viewport?.height)
  // Sharp on high-density screens, capped at 2× for performance.
  const dpr = await page.evaluate(() => window.devicePixelRatio)
  expect(resolution).toBe(Math.min(dpr, 2))
  expect(canvas.width).toBe(Math.round(canvas.cssWidth * resolution))
  await expectLetterboxed(page)

  // Nothing of the HUD (or the touch controls) is cut off.
  for (const id of ['hud-health', 'hud-score', 'hud-time']) {
    await expectInsideViewport(page, page.getByTestId(id))
  }
  await expectInsideViewport(page, page.getByRole('button', { name: 'Pause' }))
  const touch = page.getByRole('group', { name: 'Ship controls' })
  if (await touch.isVisible()) {
    for (const button of await touch.getByRole('button').all()) {
      await expectInsideViewport(page, button)
    }
  }
})

test('resizing re-fits the arena without changing the rules', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Window resizing is a desktop concern')
  await openGame(page)
  const before = await getState(page)

  for (const size of [
    { width: 900, height: 900 },
    { width: 1600, height: 500 },
  ]) {
    await page.setViewportSize(size)
    await expect
      .poll(async () => (await getRenderStats(page)).canvas.cssWidth)
      .toBe(size.width)
    await expectLetterboxed(page)
  }

  const after = await getState(page)
  expect(after.world.config).toEqual(before.world.config)
  expect(after.world.player).toEqual(before.world.player)
  expect(after.world.tick).toBe(before.world.tick)
})

test.describe('on a 3× screen', () => {
  test.use({ deviceScaleFactor: 3 })

  test('the renderer resolution is capped at 2', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Device scale is set by the mobile profile')
    await openGame(page)
    const { canvas, resolution } = await getRenderStats(page)
    expect(resolution).toBe(2)
    expect(canvas.width).toBe(canvas.cssWidth * 2)
    await expectLetterboxed(page)
  })
})
