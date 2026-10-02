import type { Page } from '@playwright/test'
import type { Projectile } from '../../src/game/types'
import {
  advance,
  aliveProjectiles,
  getState,
  openGame,
  STEP_MS,
} from '../helpers/game'
import { expect, test } from '../helpers/test'

/** A real key tap followed by one simulation step. */
async function tap(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key)
  await advance(page, STEP_MS)
}

/** Steps one at a time until no projectile is alive; returns the steps taken. */
async function stepsUntilGone(
  page: Page,
  onAlive: (alive: Projectile[]) => void = () => undefined,
): Promise<number> {
  for (let steps = 1; steps <= 120; steps++) {
    await advance(page, STEP_MS)
    const alive = aliveProjectiles(await getState(page))
    if (alive.length === 0) return steps
    onAlive(alive)
  }
  throw new Error('Projectile still alive after 2 s')
}

test('front fire creates one ball and respects its cooldown', async ({
  page,
}) => {
  await openGame(page)
  const { frontGun } = (await getState(page)).world.config.player

  await tap(page, 'Space')
  const first = aliveProjectiles(await getState(page))
  expect(first).toHaveLength(1)
  const [ball] = first
  expect(ball?.owner).toBe('player')
  expect(ball?.damage).toBe(frontGun.damage)
  // Fired along the heading (up): all speed in -y.
  expect(ball?.vx).toBeCloseTo(0, 6)
  expect(ball?.vy).toBeCloseTo(-frontGun.speed, 6)

  // 100 ms later the gun is still cooling down: nothing new.
  await advance(page, 100)
  await tap(page, 'Space')
  const during = aliveProjectiles(await getState(page))
  expect(during.map((p) => p.id)).toEqual(first.map((p) => p.id))

  // Past the 0.4 s cooldown it fires again.
  await advance(page, 300)
  await tap(page, 'Space')
  expect(aliveProjectiles(await getState(page))).toHaveLength(2)
})

test('each broadside fires three parallel balls with its own cooldown', async ({
  page,
}) => {
  await openGame(page)
  const { broadside } = (await getState(page)).world.config.player

  await tap(page, 'KeyE')
  const right = aliveProjectiles(await getState(page))
  expect(right).toHaveLength(broadside.count)
  // Facing up, starboard is east: every ball flies +x, perpendicular to the
  // hull, and they sit side by side along the hull, `spacing` apart.
  for (const ball of right) {
    expect(ball.vx).toBeCloseTo(broadside.speed, 6)
    expect(ball.vy).toBeCloseTo(0, 6)
    expect(ball.x).toBeCloseTo(right[0]?.x ?? Number.NaN, 6)
  }
  const ys = right.map((ball) => ball.y).sort((a, b) => a - b)
  for (let i = 1; i < ys.length; i++) {
    expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeCloseTo(broadside.spacing, 6)
  }

  // Right side is cooling down: a second E does nothing.
  await advance(page, 500)
  await tap(page, 'KeyE')
  expect(aliveProjectiles(await getState(page))).toHaveLength(broadside.count)

  // The left side has its own cooldown and fires west.
  await tap(page, 'KeyQ')
  const all = aliveProjectiles(await getState(page))
  expect(all).toHaveLength(broadside.count * 2)
  const left = all.filter((ball) => ball.vx < 0)
  expect(left).toHaveLength(broadside.count)
})

test('a ball in open water expires exactly at its ttl', async ({ page }) => {
  await openGame(page)
  const { config } = (await getState(page)).world
  // Face east: open water for more than the 600 px a front ball can fly.
  const quarterTurnMs = (90 / config.player.turnSpeedDegPerSec) * 1000
  await page.keyboard.down('ArrowRight')
  await advance(page, quarterTurnMs)
  await page.keyboard.up('ArrowRight')

  await tap(page, 'Space')
  // The firing step already counts as one step of flight.
  const steps = 1 + (await stepsUntilGone(page))
  expect(steps).toBe(Math.round(config.player.frontGun.ttlSeconds * 60))
})

test('a ball that hits an island disappears at the coast', async ({ page }) => {
  await openGame(page, { fixture: 'island-ahead' })
  const start = await getState(page)
  const { radius } = start.world.config.projectiles
  // island-ahead faces the northwest island's east coast.
  const index = start.world.map.islands.findIndex((i) => i.id === 'northwest')
  const coast = start.world.map.colliders[index]?.maxX ?? Number.NaN

  await tap(page, 'Space')
  let lastX = Number.NaN
  const steps = await stepsUntilGone(page, ([ball]) => {
    lastX = ball?.x ?? Number.NaN
  })

  // Gone long before its 1 s ttl, last seen within one step of the coast.
  expect(steps).toBeLessThan(start.world.config.player.frontGun.ttlSeconds * 30)
  const gap = lastX - radius - coast
  const travelPerStep = start.world.config.player.frontGun.speed / 60
  expect(gap).toBeGreaterThanOrEqual(0)
  expect(gap).toBeLessThanOrEqual(travelPerStep)
})

test('a projectile damages a ship exactly once', async ({ page }) => {
  await openGame(page, { fixture: 'incoming-shot' })
  const start = await getState(page)
  const { damage } = start.world.config.shooter.gun
  expect(aliveProjectiles(start)).toHaveLength(1)

  // Far longer than the ball needs to reach the hull and pass through it.
  await advance(page, 1000)
  const end = await getState(page)
  expect(end.world.player.hp).toBe(start.world.player.maxHp - damage)
  expect(aliveProjectiles(end)).toHaveLength(0)
})

test('a ball that leaves the arena is removed at the edge', async ({
  page,
}) => {
  await openGame(page)
  // Sail north (the open column) to about 200 px from the top edge.
  await page.keyboard.down('ArrowUp')
  await advance(page, 1900)
  await page.keyboard.up('ArrowUp')
  const { world } = await getState(page)
  const { radius } = world.config.projectiles
  const ttlSteps = Math.round(world.config.player.frontGun.ttlSeconds * 60)

  await tap(page, 'Space')
  let lastY = Infinity
  const steps =
    1 +
    (await stepsUntilGone(page, ([ball]) => {
      if (ball) lastY = ball.y
    }))
  // Gone long before its ttl, last seen within one step of the edge.
  expect(steps).toBeLessThan(ttlSteps)
  const stepTravel = world.config.player.frontGun.speed / 60
  expect(lastY).toBeLessThan(radius + stepTravel)
})
