import { circleAabbPush, hullCircles } from '../../src/game/collision'
import type { TestStateSnapshot } from '../../src/engine/testHooks'
import type { Enemy } from '../../src/game/types'
import { advance, getState, openGame, STEP_MS } from '../helpers/game'
import { expect, test } from '../helpers/test'

const aliveEnemies = ({ world }: TestStateSnapshot): Enemy[] =>
  world.enemies.filter((enemy) => enemy.alive)

const distanceToPlayer = ({ world }: TestStateSnapshot, enemy: Enemy): number =>
  Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y)

test('a Chaser closes in, rams the player and explodes without scoring', async ({
  page,
}) => {
  await openGame(page, { fixture: 'chaser-ahead' })
  const start = await getState(page)
  const { contactDamage } = start.world.config.chaser
  let previous = distanceToPlayer(start, aliveEnemies(start)[0] as Enemy)

  let state = start
  for (let i = 0; i < 50 && aliveEnemies(state).length > 0; i++) {
    await advance(page, 100)
    state = await getState(page)
    const [chaser] = aliveEnemies(state)
    if (!chaser) break
    // Always closing in.
    const distance = distanceToPlayer(state, chaser)
    expect(distance).toBeLessThan(previous)
    previous = distance
  }

  expect(aliveEnemies(state)).toHaveLength(0)
  expect(state.world.player.hp).toBe(start.world.player.maxHp - contactDamage)
  expect(state.world.match.score).toBe(0)
  expect(
    state.world.effects.some((e) => e.alive && e.kind === 'explosion'),
  ).toBe(true)
})

test('a Chaser steers around an island to reach the player', async ({
  page,
}) => {
  await openGame(page, { fixture: 'chaser-behind-island' })
  const start = await getState(page)

  let state = start
  for (let i = 0; i < 150 && aliveEnemies(state).length > 0; i++) {
    await advance(page, 100)
    state = await getState(page)
    for (const enemy of aliveEnemies(state)) {
      for (const circle of hullCircles(enemy)) {
        for (const box of state.world.map.colliders) {
          const push = circleAabbPush(circle, box)
          expect(push ? Math.hypot(push.x, push.y) : 0).toBeLessThan(1e-6)
        }
      }
    }
  }

  // It got around the island and rammed the player.
  expect(aliveEnemies(state)).toHaveLength(0)
  expect(state.world.player.hp).toBe(
    start.world.player.maxHp - start.world.config.chaser.contactDamage,
  )
})

test('destroying a Chaser with cannon fire scores exactly one point', async ({
  page,
}) => {
  await openGame(page, { fixture: 'chaser-ahead' })
  const start = await getState(page)

  // Hold fire: the front gun auto-fires at its cooldown rate.
  await page.keyboard.down('Space')
  await advance(page, 1000)
  await page.keyboard.up('Space')
  await advance(page, 1000)

  const end = await getState(page)
  expect(aliveEnemies(end)).toHaveLength(0)
  expect(end.world.match.score).toBe(1)
  // Sunk before it could ram.
  expect(end.world.player.hp).toBe(start.world.player.maxHp)
})

test('a Shooter approaches, holds at its preferred distance and fires', async ({
  page,
}) => {
  await openGame(page, { fixture: 'shooter-far' })
  const start = await getState(page)
  const { range, stopDistance, gun } = start.world.config.shooter
  expect(
    distanceToPlayer(start, aliveEnemies(start)[0] as Enemy),
  ).toBeGreaterThan(range)

  let firstShotDistance: number | null = null
  let state = start
  for (let i = 0; i < 80; i++) {
    await advance(page, 100)
    state = await getState(page)
    const [shooter] = aliveEnemies(state)
    const fired = state.world.projectiles.some(
      (p) => p.alive && p.owner === 'enemy',
    )
    if (fired && firstShotDistance === null && shooter) {
      firstShotDistance = distanceToPlayer(state, shooter)
    }
  }

  // It only opened fire once in range...
  expect(firstShotDistance).not.toBeNull()
  expect(firstShotDistance ?? Infinity).toBeLessThanOrEqual(range)
  // ...stopped at the preferred distance (within one step of travel)...
  const [shooter] = aliveEnemies(state)
  if (!shooter) throw new Error('shooter vanished')
  const stepTravel = start.world.config.shooter.speed / 60
  const held = distanceToPlayer(state, shooter)
  expect(held).toBeLessThanOrEqual(stopDistance)
  expect(held).toBeGreaterThan(stopDistance - stepTravel - 0.01)
  // ...stays there...
  await advance(page, 1000)
  const later = aliveEnemies(await getState(page))[0]
  expect(later?.x).toBeCloseTo(shooter.x, 6)
  expect(later?.y).toBeCloseTo(shooter.y, 6)
  // ...and its shots landed, gun.damage each.
  const lost = start.world.player.hp - state.world.player.hp
  expect(lost).toBeGreaterThan(0)
  expect(lost % gun.damage).toBe(0)
})

test('enemies spawn once per interval, clear of islands and the player', async ({
  page,
}) => {
  await openGame(page, { spawn: true })
  const start = await getState(page)
  const { intervalSeconds, minDistanceFromPlayer } = start.world.config.spawn
  const intervalMs = intervalSeconds * 1000
  let elapsedMs = 0

  for (let n = 1; n <= 3; n++) {
    // Just before the n-th interval: still n − 1 spawns.
    const before = n * intervalMs - 2 * STEP_MS - elapsedMs
    await advance(page, before)
    elapsedMs += before
    expect((await getState(page)).world.spawn.spawned).toBe(n - 1)

    // Just after it: exactly n.
    await advance(page, 4 * STEP_MS)
    elapsedMs += 4 * STEP_MS
    const state = await getState(page)
    expect(state.world.spawn.spawned).toBe(n)
    // At least one Shooter among the first two spawns.
    if (n === 2) expect(state.world.spawn.shootersSpawned).toBeGreaterThan(0)

    // The newest enemy appeared far from the player and off the islands.
    const newest = aliveEnemies(state).reduce((a, b) => (b.id > a.id ? b : a))
    const drift = state.world.config[newest.kind].speed * (4 / 60)
    expect(distanceToPlayer(state, newest)).toBeGreaterThan(
      minDistanceFromPlayer - drift,
    )
    for (const circle of hullCircles(newest)) {
      for (const box of state.world.map.colliders) {
        expect(circleAabbPush(circle, box)).toBeNull()
      }
    }
  }
})
