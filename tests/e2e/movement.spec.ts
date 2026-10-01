import type { Page } from '@playwright/test'
import type { Ship } from '../../src/game/types'
import { advance, getState, openGame } from '../helpers/game'
import { expect, test } from '../helpers/test'

const degToRad = (degrees: number): number => (degrees * Math.PI) / 180

/** Holds `keys` for `ms` of game time, then releases them. */
async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const key of keys) await page.keyboard.down(key)
  await advance(page, ms)
  for (const key of keys) await page.keyboard.up(key)
}

test.beforeEach(async ({ page }) => {
  await openGame(page, { seed: 1 })
})

test('holding ArrowUp for 1 s of game time moves the ship forward', async ({
  page,
}) => {
  const before = await getState(page)
  await hold(page, ['ArrowUp'], 1000)
  const after = await getState(page)

  const { speed } = before.world.config.player
  expect(after.world.tick - before.world.tick).toBe(60)
  // Starts facing up (heading -90°), so forward means y decreases.
  expect(after.world.player.y).toBeCloseTo(before.world.player.y - speed, 3)
  expect(after.world.player.x).toBeCloseTo(before.world.player.x, 3)
  expect(after.world.player.heading).toBeCloseTo(before.world.player.heading, 6)
})

test('rotating changes the heading at the configured turn speed', async ({
  page,
}) => {
  const before = await getState(page)
  const turnRate = degToRad(before.world.config.player.turnSpeedDegPerSec)

  await hold(page, ['ArrowRight'], 500)
  const afterRight = await getState(page)
  expect(afterRight.world.player.heading).toBeCloseTo(
    before.world.player.heading + turnRate * 0.5,
    6,
  )
  // Turning alone does not move the ship.
  expect(afterRight.world.player.x).toBe(before.world.player.x)
  expect(afterRight.world.player.y).toBe(before.world.player.y)

  await hold(page, ['KeyA'], 500)
  const afterLeft = await getState(page)
  expect(afterLeft.world.player.heading).toBeCloseTo(
    before.world.player.heading,
    6,
  )
})

test('moving, turning and firing work at the same time', async ({ page }) => {
  const before = await getState(page)
  await hold(page, ['ArrowUp', 'ArrowLeft', 'Space'], 500)
  const after = await getState(page)

  const turnRate = degToRad(before.world.config.player.turnSpeedDegPerSec)
  expect(after.world.player.heading).toBeCloseTo(
    before.world.player.heading - turnRate * 0.5,
    6,
  )
  const travelled = Math.hypot(
    after.world.player.x - before.world.player.x,
    after.world.player.y - before.world.player.y,
  )
  expect(travelled).toBeGreaterThan(before.world.config.player.speed * 0.4)
})

test('the ship never leaves the arena', async ({ page }) => {
  const initial = await getState(page)
  const { width, height } = initial.world.config.arena
  const r = initial.world.player.radius

  const expectInside = async (): Promise<Ship> => {
    const { world } = await getState(page)
    expect(world.player.x).toBeGreaterThanOrEqual(r)
    expect(world.player.x).toBeLessThanOrEqual(width - r)
    expect(world.player.y).toBeGreaterThanOrEqual(r)
    expect(world.player.y).toBeLessThanOrEqual(height - r)
    return world.player
  }

  // Sail up for 10 s in 100 ms slices, far longer than the arena is tall.
  await page.keyboard.down('ArrowUp')
  for (let i = 0; i < 100; i++) {
    await advance(page, 100)
    await expectInside()
  }
  await page.keyboard.up('ArrowUp')
  expect((await expectInside()).y).toBe(r)

  // Turn a quarter to face right, then sail into the right edge.
  const quarterTurnMs =
    (90 / initial.world.config.player.turnSpeedDegPerSec) * 1000
  await hold(page, ['ArrowRight'], quarterTurnMs)
  expect((await getState(page)).world.player.heading).toBeCloseTo(0, 6)

  await page.keyboard.down('ArrowUp')
  for (let i = 0; i < 100; i++) {
    await advance(page, 100)
    await expectInside()
  }
  await page.keyboard.up('ArrowUp')
  const corner = await expectInside()
  expect(corner.x).toBe(width - r)
  expect(corner.y).toBe(r)
})
