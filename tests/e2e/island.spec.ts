import type { Page } from '@playwright/test'
import { circleAabbPush, hullCircles } from '../../src/game/collision'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import { advance, getState, openGame } from '../helpers/game'
import { expect, test } from '../helpers/test'

/** Largest overlap we tolerate: floating-point noise, not visible depth. */
const MAX_PENETRATION = 1e-6
const SLICE_MS = 50

/** Fails if any hull circle overlaps any island collider. */
function expectOutsideIslands({ world }: TestStateSnapshot): void {
  for (const circle of hullCircles(world.player)) {
    for (const box of world.map.colliders) {
      const push = circleAabbPush(circle, box)
      const depth = push ? Math.hypot(push.x, push.y) : 0
      expect(
        depth,
        `hull circle inside collider ${JSON.stringify(box)}`,
      ).toBeLessThanOrEqual(MAX_PENETRATION)
    }
  }
}

/** Holds ArrowUp for `ms` of game time, checking the hull after every slice. */
async function sailForward(page: Page, ms: number): Promise<TestStateSnapshot> {
  await page.keyboard.down('ArrowUp')
  let state = await getState(page)
  for (let elapsed = 0; elapsed < ms; elapsed += SLICE_MS) {
    await advance(page, SLICE_MS)
    state = await getState(page)
    expectOutsideIslands(state)
  }
  await page.keyboard.up('ArrowUp')
  return state
}

/** The collider of the northwest island, which the fixtures aim at. */
function targetCollider({ world }: TestStateSnapshot) {
  const index = world.map.islands.findIndex(
    (island) => island.id === 'northwest',
  )
  const box = world.map.colliders[index]
  if (!box) throw new Error('northwest island collider not found')
  return box
}

test('driving straight into an island never puts the ship inside it', async ({
  page,
}) => {
  await openGame(page, { fixture: 'island-ahead' })
  const start = await getState(page)
  expectOutsideIslands(start)
  const box = targetCollider(start)
  const { hullRadius, hullOffset } = start.world.player

  // Enough time to reach the coast (~170 px away) and keep pushing.
  const pushing = await sailForward(page, 2500)
  const stopped = await sailForward(page, 500)

  // The bow rests on the east coast: blocked, not just short of it.
  expect(stopped.world.player.x).toBeCloseTo(
    box.maxX + hullOffset + hullRadius,
    3,
  )
  expect(
    Math.abs(stopped.world.player.x - pushing.world.player.x),
  ).toBeLessThan(0.5)
  expect(stopped.world.player.y).toBeCloseTo(start.world.player.y, 6)
})

test('hitting the coast at an angle slides along it', async ({ page }) => {
  await openGame(page, { fixture: 'island-glancing' })
  const start = await getState(page)
  const box = targetCollider(start)

  // Reach the coast (~1 s), then keep sailing into it.
  const contact = await sailForward(page, 1300)
  const later = await sailForward(page, 700)

  // Pinned against the east coast: the bow circle's edge rests on it...
  for (const state of [contact, later]) {
    const [bow] = hullCircles(state.world.player)
    expect(bow.x - bow.r).toBeCloseTo(box.maxX, 3)
  }
  // ...while still moving north along it instead of stopping dead.
  expect(contact.world.player.y - later.world.player.y).toBeGreaterThan(20)
})
